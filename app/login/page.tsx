"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setPending(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not sign in.");
      router.push("/");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign in."); }
    finally { setPending(false); }
  }
  return <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6"><section className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl"><p className="text-xs font-semibold uppercase tracking-widest text-blue-400">Private workspace</p><h1 className="mt-3 text-2xl font-bold">Sign in</h1><p className="mt-2 text-sm text-slate-400">Use the account created for you by an administrator.</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm text-slate-300">Email<input autoComplete="username" required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" /></label><label className="block text-sm text-slate-300">Password<input autoComplete="current-password" required type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" /></label>{error && <p role="alert" className="text-sm text-rose-300">{error}</p>}<button disabled={pending} className="w-full rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60">{pending ? "Signing in…" : "Sign in"}</button></form></section></main>;
}
