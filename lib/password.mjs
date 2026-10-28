import argon2 from "argon2";

export const DUMMY_HASH = "$argon2id$v=19$m=19456,t=2,p=1$yxGsTQGgg2040jGx6XbTmg$kUFy4Co/E1L/LC3cr5g37+laD6KZ42bjrnCPpPEtqKM";
const options = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
export function validatePassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128 && Buffer.byteLength(password, "utf8") <= 256;
}
export async function hashPassword(password) { return argon2.hash(password, options); }
export async function verifyPassword(hash, password) {
  try { return await argon2.verify(hash, password); } catch { return false; }
}
