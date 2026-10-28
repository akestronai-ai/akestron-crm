import { Suspense } from "react";
import CRMClient from "./crm-client";
import ProtectedPage from "@/lib/protected-page";

export default function CRMPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><ProtectedPage><CRMClient /></ProtectedPage></Suspense>;
}
