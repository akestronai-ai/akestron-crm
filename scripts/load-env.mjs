import { existsSync } from "node:fs";

// Keep externally supplied environment values; load local settings from .env.
if (existsSync(".env")) process.loadEnvFile(".env");
