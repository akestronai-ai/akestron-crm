import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail, normalizeProfileUrl } from "../lib/lead-identity.mjs";
import { DUMMY_HASH, hashPassword, validatePassword, verifyPassword } from "../lib/password.mjs";
import { expectedOrigin } from "../lib/request-origin.mjs";

test("lead identity normalization handles email and supported profile identities", () => {
  assert.equal(normalizeEmail("  Sales@Example.Test "), "sales@example.test");
  assert.equal(normalizeEmail("not-an-email"), null);
  assert.equal(normalizeProfileUrl("http://www.instagram.com/ExampleUser/?igsh=tracking"), "https://instagram.com/exampleuser");
  assert.equal(normalizeProfileUrl("https://instagram.com/exampleuser/?ref=share#bio"), "https://instagram.com/exampleuser");
  assert.equal(normalizeProfileUrl("https://m.facebook.com/AUser/?utm_source=share"), "https://facebook.com/auser");
  assert.equal(normalizeProfileUrl("https://facebook.com/profile.php?id=123&fbclid=tracking"), "https://facebook.com/profile.php?id=123");
  assert.equal(normalizeProfileUrl("https://facebook.com/profile.php?id=123&ref=bookmarks&sk=about"), "https://facebook.com/profile.php?id=123");
  assert.equal(normalizeProfileUrl("https://facebook.com/people/Example-Name/12345"), "https://facebook.com/profile.php?id=12345");
  assert.equal(normalizeProfileUrl("https://facebook.com/%45xample.Name/?ref=bookmark"), "https://facebook.com/example.name");
  assert.equal(normalizeProfileUrl("https://instagram.com/%55ser.name/?utm_source=one"), "https://instagram.com/user.name");
  assert.equal(normalizeProfileUrl("https://facebook.com/profile.php"), null);
  assert.equal(normalizeProfileUrl("https://instagram.com/someuser/reel/abc"), null);
  assert.equal(normalizeProfileUrl("javascript:alert(1)"), null);
  assert.equal(normalizeProfileUrl("https://user:pass@instagram.com/example"), null);
  assert.equal(normalizeProfileUrl("https://instagram.com:8443/example"), null);
  assert.equal(normalizeProfileUrl("https://instagram.com/user%2Fadmin"), null);
});

test("password policy and Argon2id hashes are valid", async () => {
  assert.equal(validatePassword("12345678"), true);
  assert.equal(validatePassword("Abcdef123"), true);
  assert.equal(validatePassword("1234567"), false);
  assert.equal(validatePassword("short"), false);
  assert.equal(validatePassword("x".repeat(129)), false);
  assert.equal(validatePassword("😀".repeat(65)), false);
  const password = "temporary-test-password-42";
  const hash = await hashPassword(password);
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(hash, password), true);
  assert.equal(await verifyPassword(hash, "wrong password"), false);
  assert.equal(await verifyPassword(DUMMY_HASH, password), false);
});

test("request origin follows validated Host and request protocol", () => {
  assert.equal(expectedOrigin("http://localhost:3001/api/leads", "127.0.0.1:3001"), "http://127.0.0.1:3001");
  assert.equal(expectedOrigin("http://localhost:3001/api/leads", "localhost:3001"), "http://localhost:3001");
  assert.equal(expectedOrigin("https://internal/api/leads", "crm.example.test"), "https://crm.example.test");
  assert.equal(expectedOrigin("https://internal/api/leads", "crm-preview-abc.vercel.app"), "https://crm-preview-abc.vercel.app");
  assert.throws(() => expectedOrigin("http://localhost:3001/api/leads", "attacker.test/other"));
  assert.throws(() => expectedOrigin("http://localhost:3001/api/leads", "user@attacker.test"));
});
