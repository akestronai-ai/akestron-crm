import { resolve } from "node:path";

export function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) return undefined;
  const url = new URL(value);
  if (process.env.POSTGRES_CA_CERT) {
    url.searchParams.set("sslmode", "require");
    url.searchParams.set("sslaccept", "strict");
    url.searchParams.set("sslcert", resolve(process.env.POSTGRES_CA_CERT));
  }
  return url.toString();
}
