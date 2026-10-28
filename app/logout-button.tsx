"use client";
import { useState } from "react";

export default function LogoutButton() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      // A full navigation clears the cached protected route tree.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign out."); setPending(false); }
  }
  return <span className="flex items-center gap-2">{error && <span role="alert" className="text-rose-300">{error}</span>}<button type="button" disabled={pending} onClick={logout} className="text-blue-400 hover:text-white disabled:opacity-60" aria-label="Sign out">{pending ? "Signing out…" : "Sign out"}</button></span>;
}
