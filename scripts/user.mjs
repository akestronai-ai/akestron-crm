import "./load-env.mjs";
import { PrismaClient } from "@prisma/client";
import { hashPassword, validatePassword } from "../lib/password.mjs";
import { databaseUrl } from "../lib/database-url.mjs";
import { AccountNotFoundError, resetAccountPassword } from "../lib/account-admin.mjs";

if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in .env first.");
const action = process.argv[2];
if (!['create', 'reset'].includes(action)) throw new Error("Use: node scripts/user.mjs create|reset");
if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Run this account command in an interactive terminal so passwords can be hidden.");
const db = new PrismaClient({ datasourceUrl: databaseUrl() });
class CliInputError extends Error {}
function line(prompt, hidden = false) {
  return new Promise(resolve => {
    process.stdout.write(prompt);
    if (!hidden) {
      import("node:readline/promises").then(async ({ createInterface }) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const value = await rl.question("");
        rl.close(); resolve(value);
      });
      return;
    }
    let value = "";
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    const onData = chunk => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") process.exit(130);
        if (char === "\r" || char === "\n") {
          stdin.off("data", onData);
          if (stdin.isTTY) stdin.setRawMode(Boolean(wasRaw));
          stdin.pause();
          process.stdout.write("\n"); resolve(value); return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on("data", onData);
  });
}
try {
  const email = (await line("Email: ")).trim().toLowerCase();
  const name = action === "create" ? (await line("Name: ")).trim() : null;
  const password = await line("Password (input hidden): ", true);
  const confirm = await line("Confirm password (input hidden): ", true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) throw new CliInputError("Enter a valid email.");
  if (action === "create" && (!name || name.length > 160)) throw new CliInputError("Name is required and must be under 160 characters.");
  if (!validatePassword(password)) throw new CliInputError("Password must be 8–128 characters and at most 256 UTF-8 bytes.");
  if (password !== confirm) throw new CliInputError("Passwords do not match.");
  const passwordHash = await hashPassword(password);
  if (action === "create") {
    await db.appUser.create({ data: { email, name, passwordHash } });
    console.log("Private CRM account created.");
  } else {
    await resetAccountPassword(db, email, passwordHash);
    console.log("Password changed and active sessions revoked.");
  }
} catch (error) {
  console.error(error?.code === "P2002" ? "An account already exists for that email." : error instanceof CliInputError || error instanceof AccountNotFoundError ? error.message : "Account operation failed. Check the database connection and account setup.");
  process.exitCode = 1;
} finally { process.stdin.pause(); await db.$disconnect(); }
