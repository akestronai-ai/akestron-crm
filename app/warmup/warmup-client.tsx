"use client";

import React, { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { getDailySchedule, DaySchedule } from "@/lib/warmup-schedule";
import { apiFetch } from "@/lib/client-api";
import { useSyncRefresh } from "@/lib/use-sync-refresh";

export default function WarmupPage() {
  const [currentDay, setCurrentDay] = useState<number>(1);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>("");
  const [todayStr, setTodayStr] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"both" | "facebook" | "instagram">("both");
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [error, setError] = useState("");
  const lastStartDate = useRef("");

  // Read the workspace's shared cloud schedule.
  const loadSettings = useCallback(async () => {
    try {
      const res = await apiFetch("/api/settings");
      const data = await res.json();
      if (data.success) {
        setStartDate(data.startDate);
        setCurrentDay(data.currentDay);
        if (lastStartDate.current !== data.startDate) setSelectedDay(data.currentDay);
        lastStartDate.current = data.startDate;
        setTodayStr(data.today);
        setError("");
      }
    } catch (err) {
      console.error("Error loading settings:", err);
      setError(err instanceof Error ? err.message : "Could not load your schedule.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useSyncRefresh(loadSettings);

  // Reset the shared schedule so today becomes Day 1.
  const handleResetToToday = async () => {
    try {
      const res = await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: todayStr }),
      });
      const data = await res.json();
      if (data.success) {
        setStartDate(data.startDate);
        setCurrentDay(1);
        setSelectedDay(1);
        setResetStatus("✓ Reset! Today is now Day 1.");
        setTimeout(() => setResetStatus(null), 3000);
      }
    } catch (err) {
      console.error("Error resetting warmup:", err);
      setError(err instanceof Error ? err.message : "Could not reset the schedule.");
    }
  };

  const schedule: DaySchedule = getDailySchedule(selectedDay);
  const isViewingToday = selectedDay === currentDay;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-slate-700"
              title="Back to Home"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Meta Warm-Up Daily Quotas
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium">
                    Musa Khan Protocol
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Exact Daily Actions & Anti-Spam Benchmarks • /warmup
              </p>
            </div>
          </div>

          {/* Quick Reset & Status */}
          <div className="flex items-center gap-3">
            {resetStatus && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {resetStatus}
              </span>
            )}
            <button
              onClick={handleResetToToday}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all flex items-center gap-1.5 shadow cursor-pointer"
              title="Reset start date to today (Day 1)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset Warm-Up to Today
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        {isLoading && <p className="text-sm text-slate-400">Loading your shared schedule…</p>}
        {error && <p role="alert" className="rounded-xl border border-rose-500/40 p-4 text-sm text-rose-300">{error} <button onClick={() => void loadSettings()} className="ml-3 underline">Retry</button></p>}
        {/* Status Banner: Today's Status */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">
              <span>Today&apos;s Official Schedule</span>
              <span>•</span>
              <span>Started: {startDate || "Today"}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
              You are on <span className="text-blue-400">Day {currentDay}</span> of 30+
              {isViewingToday ? (
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                  Currently Viewing Today
                </span>
              ) : (
                <button
                  onClick={() => setSelectedDay(currentDay)}
                  className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 font-medium transition-all"
                >
                  Jump Back to Today (Day {currentDay})
                </button>
              )}
            </h2>
            <p className="text-xs text-slate-400 mt-1.5">
              Current Phase: <span className="text-slate-200 font-medium">{schedule.phase}</span>
            </p>
          </div>

          {/* View Filter Switcher (Both / Facebook / Instagram) */}
          <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 self-stretch sm:self-auto justify-center">
            <button
              onClick={() => setActiveTab("both")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "both"
                  ? "bg-slate-800 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setActiveTab("facebook")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "facebook"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Facebook Only
            </button>
            <button
              onClick={() => setActiveTab("instagram")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "instagram"
                  ? "bg-pink-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Instagram Only
            </button>
          </div>
        </div>

        {/* Day Selector Navigation Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
            <span>Select Any Day to Inspect Quotas:</span>
            <span className="text-[11px] text-slate-500">
              Showing exact requirements for Day {selectedDay}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 20, 30].map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center min-w-[70px] ${
                  selectedDay === d
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105"
                    : d === currentDay
                    ? "bg-slate-800 text-emerald-400 border border-emerald-500/40"
                    : "bg-slate-950/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800"
                }`}
              >
                <span>{d >= 15 ? `Day ${d}+` : `Day ${d}`}</span>
                <span className="text-[9px] font-normal opacity-75 mt-0.5">
                  {d === currentDay ? "★ TODAY" : d <= 4 ? "Warmup" : d <= 5 ? "Prep" : d <= 14 ? "Outreach" : "Scale"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Quotas & Requirements Display */}
        <div
          className={`grid gap-6 ${
            activeTab === "both" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {/* FACEBOOK CARD */}
          {(activeTab === "both" || activeTab === "facebook") && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Facebook Quota</h3>
                      <p className="text-xs text-blue-400 font-medium">
                        {schedule.facebook.dayTitle}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                    Day {selectedDay} Target
                  </span>
                </div>

                {/* Summary */}
                <p className="text-xs text-slate-300 leading-relaxed mb-5 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                  {schedule.facebook.summary}
                </p>

                {/* Metrics Breakdown */}
                <div className="space-y-2.5 mb-6">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Exact Numbers You Should Do:
                  </div>
                  {schedule.facebook.metrics.map((metric, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        metric.warning
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                          : metric.highlight
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                          : "bg-slate-950/50 border-slate-800 text-slate-200"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold">{metric.label}</div>
                        <div className="text-[11px] text-slate-400">{metric.description}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-extrabold tracking-tight">
                          {metric.target}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Critical Rules */}
                <div className="mb-6">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-400 mb-2 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Strict Operational Rules:
                  </div>
                  <ul className="space-y-1.5">
                    {schedule.facebook.criticalRules.map((rule, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Musa Khan Pro Tip Box */}
              <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl p-3.5 text-xs text-blue-200 mt-2">
                <span className="font-bold text-blue-400 block mb-1">
                  💡 Musa Khan Strategy Note:
                </span>
                {schedule.facebook.musaProTip}
              </div>
            </div>
          )}

          {/* INSTAGRAM CARD */}
          {(activeTab === "both" || activeTab === "instagram") && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-pink-600/20 text-pink-400 rounded-xl border border-pink-500/30">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Instagram Quota</h3>
                      <p className="text-xs text-pink-400 font-medium">
                        {schedule.instagram.dayTitle}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                    Day {selectedDay} Target
                  </span>
                </div>

                {/* Summary */}
                <p className="text-xs text-slate-300 leading-relaxed mb-5 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                  {schedule.instagram.summary}
                </p>

                {/* Metrics Breakdown */}
                <div className="space-y-2.5 mb-6">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Exact Numbers You Should Do:
                  </div>
                  {schedule.instagram.metrics.map((metric, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        metric.warning
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                          : metric.highlight
                          ? "bg-pink-500/10 border-pink-500/30 text-pink-300"
                          : "bg-slate-950/50 border-slate-800 text-slate-200"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold">{metric.label}</div>
                        <div className="text-[11px] text-slate-400">{metric.description}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-extrabold tracking-tight">
                          {metric.target}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Critical Rules */}
                <div className="mb-6">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-400 mb-2 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Strict Operational Rules:
                  </div>
                  <ul className="space-y-1.5">
                    {schedule.instagram.criticalRules.map((rule, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Musa Khan Pro Tip Box */}
              <div className="bg-pink-950/30 border border-pink-800/40 rounded-xl p-3.5 text-xs text-pink-200 mt-2">
                <span className="font-bold text-pink-400 block mb-1">
                  💡 Musa Khan Strategy Note:
                </span>
                {schedule.instagram.musaProTip}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 text-center text-xs text-slate-500">
        Musa Khan 7.2 Meta Warm-Up Schedule Reference • Pure Daily Quota Guidance • /warmup
      </footer>
    </div>
  );
}
