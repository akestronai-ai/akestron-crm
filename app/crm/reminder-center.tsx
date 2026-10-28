"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { useSyncRefresh } from "@/lib/use-sync-refresh";

interface LeadReminder {
  leadId: string;
  leadName: string;
  stageEnteredAt: string;
  lastRemindedAt: string;
  stageName: string;
  pipelineName: string;
  pipelineId: string;
  stageId: string;
}

export default function ReminderCenter({ onOpenLead }: { onOpenLead: (leadId: string) => Promise<void> }) {
  const [reminders, setReminders] = useState<LeadReminder[]>([]);
  const [hasChecked, setHasChecked] = useState(false);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState("");
  const [dismissingId, setDismissingId] = useState("");

  const sync = useCallback(async () => {
    try {
      const response = await apiFetch("/api/reminders/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json();
      setReminders(data.reminders);
      setHasChecked(true);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not check reminders.");
    }
  }, []);

  useSyncRefresh(sync);

  const open = async (leadId: string) => {
    setOpeningId(leadId);
    try { await onOpenLead(leadId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open that lead."); }
    finally { setOpeningId(""); }
  };

  const dismiss = async (reminder: LeadReminder) => {
    setDismissingId(reminder.leadId);
    try {
      await apiFetch(`/api/reminders/${reminder.leadId}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode: reminder.stageEnteredAt, lastRemindedAt: reminder.lastRemindedAt }),
      });
      await sync();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not dismiss this reminder.");
    } finally { setDismissingId(""); }
  };

  return (
    <section aria-live="polite" className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-amber-100">Stage reminders <span className="ml-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-200">{reminders.length}</span></h2>
          <p className="mt-1 text-xs text-slate-400">Leads stay here after 24 hours in a stage and repeat every 6 hours until moved.</p>
        </div>
        {error && <button type="button" onClick={() => void sync()} className="text-xs font-semibold text-amber-200 underline">Retry</button>}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
      {hasChecked && !reminders.length && !error && <p className="mt-3 text-xs text-slate-400">No stage reminders due.</p>}
      {reminders.length > 0 && <ul className="mt-3 divide-y divide-amber-500/15">{reminders.map(reminder => (
        <li key={`${reminder.leadId}:${reminder.lastRemindedAt}`} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{reminder.leadName}</p>
            <p className="mt-0.5 text-xs text-slate-400">{reminder.pipelineName} · {reminder.stageName} · {formatTimeInStage(reminder.stageEnteredAt)}</p>
            <p className="mt-0.5 text-[11px] text-amber-200/80">Reminder shown {formatElapsed(reminder.lastRemindedAt)} · repeats {formatUntilNext(reminder.lastRemindedAt)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button type="button" disabled={openingId === reminder.leadId} onClick={() => void open(reminder.leadId)} className="text-xs font-semibold text-blue-300 underline disabled:opacity-50">{openingId === reminder.leadId ? "Opening…" : "Open lead"}</button>
            <button type="button" disabled={dismissingId === reminder.leadId} onClick={() => void dismiss(reminder)} className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50">{dismissingId === reminder.leadId ? "Dismissing…" : "Dismiss"}</button>
          </div>
        </li>
      ))}</ul>}
    </section>
  );
}

function formatTimeInStage(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const hours = Math.floor(elapsed / 3600000);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return days ? `${days}d ${remainingHours}h in stage` : `${hours}h in stage`;
}

function formatElapsed(value: string) {
  const minutes = Math.floor(Math.max(0, Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  const hours = Math.floor(minutes / 60);
  return hours < 1 ? `${minutes}m ago` : `${Math.floor(hours / 24) ? `${Math.floor(hours / 24)}d ` : ""}${hours % 24}h ago`;
}

function formatUntilNext(value: string) {
  const minutes = Math.ceil(Math.max(0, new Date(value).getTime() + 6 * 3600000 - Date.now()) / 60000);
  if (!minutes) return "due now";
  const hours = Math.floor(minutes / 60);
  return hours < 1 ? `in ${minutes}m` : `in ${Math.floor(hours / 24) ? `${Math.floor(hours / 24)}d ` : ""}${hours % 24}h`;
}
