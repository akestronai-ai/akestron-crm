/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");

async function main() {
  if (process.stdin.isTTY) {
    console.error("Pipe a JSON array of account objects to this command. Each object needs name, email, and password.");
    process.stdin.pause();
    process.exitCode = 2;
    return;
  }

  await import("./scripts/load-env.mjs");
  const { databaseUrl } = await import("./lib/database-url.mjs");
  const { hashPassword, validatePassword } = await import("./lib/password.mjs");
  if (!process.env.DATABASE_URL) throw new Error("Database configuration is missing.");

  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 128 * 1024) throw new Error("Input is too large.");
    chunks.push(chunk);
  }

  let input;
  try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("Input must be a valid JSON array."); }
  if (!Array.isArray(input) || input.length < 1 || input.length > 20) throw new Error("Provide between one and twenty accounts.");

  const accounts = input.map(account => {
    if (!account || typeof account !== "object" || Array.isArray(account)) throw new Error("Each account needs a name, email, and password.");
    if (typeof account.name !== "string" || typeof account.email !== "string" || typeof account.password !== "string") throw new Error("Each account needs a name, email, and password.");
    const name = account.name.normalize("NFC").trim();
    const email = account.email.trim().toLowerCase();
    if (!name || name.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) throw new Error("An account name or email is invalid.");
    if (!validatePassword(account.password)) throw new Error("A password does not meet the 8–128 character policy.");
    return { name, email, password: account.password };
  });
  if (new Set(accounts.map(account => account.email)).size !== accounts.length) throw new Error("The input contains duplicate account emails.");

  const prepared = [];
  for (const account of accounts) prepared.push({ ...account, passwordHash: await hashPassword(account.password) });
  prepared.sort((left, right) => left.email.localeCompare(right.email));
  const db = new PrismaClient({ datasourceUrl: databaseUrl() });
  try {
    const results = await db.$transaction(async tx => {
      const statuses = [];
      for (const account of prepared) {
        // Serialize concurrent create/reset runs for the same email before checking existence.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${account.email})::bigint)::text`;
        const [existing] = await tx.$queryRaw`SELECT id FROM app_users WHERE email = ${account.email} FOR UPDATE`;
        if (existing) {
          await tx.appSession.deleteMany({ where: { userId: existing.id } });
          await tx.appUser.update({ where: { id: existing.id }, data: { name: account.name, passwordHash: account.passwordHash } });
          statuses.push({ name: account.name, email: account.email, status: "updated; sessions revoked" });
        } else {
          await tx.appUser.create({ data: { name: account.name, email: account.email, passwordHash: account.passwordHash } });
          statuses.push({ name: account.name, email: account.email, status: "created" });
        }
      }
      return statuses;
    }, { timeout: 30000, maxWait: 10000 });
    for (const account of results) console.log(`${account.status}: ${account.name} <${account.email}>`);
  } finally { await db.$disconnect(); }
}

main().catch(() => {
  console.error("Account seeding failed. Check the JSON input and database configuration.");
  process.exitCode = 1;
});
