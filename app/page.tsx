import { Suspense } from "react";
import HomeContent from "@/app/home-content";
import ProtectedPage from "@/lib/protected-page";

export default function HomePage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><ProtectedPage><HomeContent /></ProtectedPage></Suspense>;
}
