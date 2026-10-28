import { redirect } from "next/navigation";
import { getRequestUser } from "@/lib/auth";
import LogoutButton from "@/app/logout-button";
import SessionRedirect from "@/app/session-redirect";

export default async function ProtectedPage({ children }: { children: React.ReactNode }) {
  const user = await getRequestUser();
  if (!user) redirect("/login");
  return <><SessionRedirect /><div className="bg-slate-950 text-slate-300 border-b border-slate-800 text-xs"><div className="max-w-7xl mx-auto px-4 py-2 flex justify-end items-center gap-3"><span>{user.name} · {user.email}</span><LogoutButton /></div></div>{children}</>;
}
