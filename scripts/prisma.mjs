import "./load-env.mjs";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { databaseUrl } from "../lib/database-url.mjs";

const args = process.argv.slice(2);
const ifNeeded = args.indexOf("--if-needed");
if (ifNeeded !== -1) {
  args.splice(ifNeeded, 1);
  const generated = "node_modules/.prisma/client/schema.prisma";
  const normalized = path => readFileSync(path, "utf8").replaceAll("\r\n", "\n").trim();
  if (args[0] === "generate" && existsSync(generated) && normalized(generated) === normalized("prisma/schema.prisma")) {
    console.log("Prisma Client already matches the schema.");
    process.exit(0);
  }
}
const url = databaseUrl();
if (url) process.env.DATABASE_URL = url;
const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], { stdio: "inherit", env: process.env });
process.exitCode = result.status ?? 1;
