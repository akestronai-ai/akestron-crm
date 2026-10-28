import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans selection:bg-blue-600 selection:text-white">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Musa Khan & Abdullah · Outbound Client Acquisition
        </div>

        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Customer Acquisition Workspace
          </h1>
          <p className="text-sm text-slate-400 mt-2.5 max-w-lg mx-auto leading-relaxed">
            Engineered from the ground up based on the <strong className="text-slate-200">7.2 Meta Lead Sourcing</strong> framework, <strong className="text-slate-200">7.3 Copywriting & DMs</strong>, and the <strong className="text-slate-200">12 Outbound Laws</strong>.
          </p>
        </div>

        {/* Dual Cards for /crm and /warmup */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left pt-2">
          {/* Card 1: Acquisition Pipeline CRM */}
          <Link
            href="/crm"
            className="group p-5 rounded-2xl bg-slate-950/80 hover:bg-slate-850 border border-slate-800 hover:border-blue-500/50 transition-all shadow-lg flex flex-col justify-between space-y-4 cursor-pointer"
          >
            <div>
              <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                Customer Acquisition CRM
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Full visual Kanban funnel, custom pipeline builder, Lead Tiers (Platinum/Gold/Bronze), Law 2 Follow-up tracker, and copy scripts.
              </p>
            </div>
            <span className="text-xs font-semibold text-blue-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Launch CRM (/crm) →
            </span>
          </Link>

          {/* Card 2: Warmup Daily Quotas */}
          <Link
            href="/warmup"
            className="group p-5 rounded-2xl bg-slate-950/80 hover:bg-slate-850 border border-slate-800 hover:border-pink-500/50 transition-all shadow-lg flex flex-col justify-between space-y-4 cursor-pointer"
          >
            <div>
              <div className="h-10 w-10 rounded-xl bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400 mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-white group-hover:text-pink-400 transition-colors">
                Meta Warm-Up Quotas
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Day-by-day anti-spam schedules for Facebook & Instagram. Exact posts, likes, comments, and connection limits.
              </p>
            </div>
            <span className="text-xs font-semibold text-pink-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              View Warm-Up (/warmup) →
            </span>
          </Link>
        </div>

        <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
          Shared workspace • PostgreSQL storage
        </div>
      </div>
    </div>
  );
}
