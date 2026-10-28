import { Suspense } from "react";
import WarmupClient from "./warmup-client";
import ProtectedPage from "@/lib/protected-page";

export default function WarmupPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><ProtectedPage><WarmupClient /></ProtectedPage></Suspense>;
}
