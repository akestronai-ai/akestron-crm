"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/lib/client-api";
import { useSyncRefresh } from "@/lib/use-sync-refresh";
import ReminderCenter from "@/app/crm/reminder-center";

interface Lead {
  id: string;
  pipelineId: string;
  stageId: string;
  name: string;
  company: string | null;
  niche: string | null;
  location: string | null;
  tier: "PLATINUM" | "GOLD" | "BRONZE";
  channel: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  profileUrl: string | null;
  techStack: string | null;
  dealValue: number;
  followUpCount: number;
  lastContactDate: string | null;
  nextFollowUpDate: string | null;
  notes: string | null;
  activities?: { id: string; type: string; content: string; createdAt: string }[];
}

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
  leads: Lead[];
}

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  stages: PipelineStage[];
}

export default function CRMPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState("");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedChannel, setSelectedChannel] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");

  // Modals & Drawers
  const [isAddLeadOpen, setIsAddLeadOpen] = useState<boolean>(false);
  const [leadPending, setLeadPending] = useState(false);
  const [leadReminder, setLeadReminder] = useState<{ message: string; duplicate?: { id: string; name: string; pipelineId: string; stageId: string; createdBy: string | null } } | null>(null);
  const [selectedStageForNewLead, setSelectedStageForNewLead] = useState<string>("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isPlaybookOpen, setIsPlaybookOpen] = useState<boolean>(false);
  const [isNewPipelineOpen, setIsNewPipelineOpen] = useState<boolean>(false);
  const [isAddStageOpen, setIsAddStageOpen] = useState<boolean>(false);
  const [newStageName, setNewStageName] = useState<string>("");
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState<string>("");

  // Custom In-App Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "stage" | "lead";
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // New Lead Form State (Strictly Name, Email, Platform, Profile Link, Other Description)
  const [leadForm, setLeadForm] = useState({
    name: "",
    email: "",
    channel: "FACEBOOK", // FACEBOOK | INSTAGRAM
    profileUrl: "",
    notes: "",
  });

  // New Pipeline Form State
  const [newPipelineForm, setNewPipelineForm] = useState({
    name: "",
    description: "",
  });

  // Activity Note State
  const [activityNote, setActivityNote] = useState<string>("");

  // Fetch Pipelines
  const fetchPipelines = useCallback(async () => {
    try {
      const res = await apiFetch("/api/pipelines");
      const data = await res.json();
      if (data.success) {
        const next: Pipeline[] = data.pipelines;
        next.forEach(p => p.stages.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)));
        setPipelines(next);
        setSelectedPipelineId(current => next.some(p => p.id === current) ? current : next[0]?.id || "");
        setSelectedLead(current => current ? next.flatMap(p => p.stages.flatMap(s => s.leads)).find(l => l.id === current.id) ?? null : null);
        setError("");
      }
    } catch (err) {
      console.error("Failed to load pipelines:", err);
      setError(err instanceof Error ? err.message : "Could not load your pipelines.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useSyncRefresh(fetchPipelines);

  const activePipeline =
    pipelines.find((p) => p.id === selectedPipelineId) || pipelines[0];

  // Move Lead Stage
  const handleMoveStage = async (leadId: string, targetStageId: string) => {
    try {
      const res = await apiFetch(`/api/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: targetStageId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPipelines();
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead(data.lead);
        }
      }
    } catch (err) {
      console.error("Error moving lead stage:", err);
      setError(err instanceof Error ? err.message : "Could not save your changes.");
    }
  };

  // Quick Increment Follow-up Count (Law 2: Followup in Volume)
  const handleIncrementFollowUp = async (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await apiFetch(`/api/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incrementFollowUp: true }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPipelines();
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead(data.lead);
        }
      }
    } catch (err) {
      console.error("Error incrementing follow-up:", err);
      setError(err instanceof Error ? err.message : "Could not save your changes.");
    }
  };

  // Create Lead
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePipeline || leadPending) return;
    const stageId = selectedStageForNewLead || activePipeline.stages[0]?.id;
    setLeadReminder(null);
    setLeadPending(true);
    try {
      const res = await apiFetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId: activePipeline.id,
          stageId,
          ...leadForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAddLeadOpen(false);
        setLeadReminder(null);
        setLeadForm({
          name: "",
          email: "",
          channel: "FACEBOOK",
          profileUrl: "",
          notes: "",
        });
        fetchPipelines();
      }
    } catch (err) {
      console.error("Error creating lead:", err);
      if (err instanceof ApiClientError && err.code === "DUPLICATE_LEAD" && err.duplicate) setLeadReminder({ message: err.message, duplicate: err.duplicate });
      else setLeadReminder({ message: err instanceof Error ? err.message : "Could not save your changes." });
    } finally { setLeadPending(false); }
  };

  const openLead = async (leadId: string) => {
    const response = await apiFetch(`/api/leads/${leadId}`);
    const data = await response.json();
    setSelectedPipelineId(data.lead.pipelineId);
    await fetchPipelines();
    setSelectedLead(data.lead);
    setIsAddLeadOpen(false);
  };

  const openDuplicateLead = async (leadId: string) => {
    try { await openLead(leadId); }
    catch (err) { setLeadReminder({ message: err instanceof Error ? err.message : "Could not open that lead." }); }
  };

  // Create Custom Pipeline
  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPipelineForm),
      });
      const data = await res.json();
      if (data.success) {
        setIsNewPipelineOpen(false);
        setNewPipelineForm({ name: "", description: "" });
        await fetchPipelines();
        setSelectedPipelineId(data.pipeline.id);
      }
    } catch (err) {
      console.error("Error creating pipeline:", err);
      setError(err instanceof Error ? err.message : "Could not save your changes.");
    }
  };

  // Add Stage to Pipeline
  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePipeline || !newStageName) return;
    try {
      const res = await apiFetch("/api/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId: activePipeline.id,
          name: newStageName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAddStageOpen(false);
        setNewStageName("");
        fetchPipelines();
      }
    } catch (err) {
      console.error("Error adding stage:", err);
      setError(err instanceof Error ? err.message : "Could not save your changes.");
    }
  };

  // Confirm Delete Action (Handles both stage and lead deletion via custom popup)
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === "stage") {
        const res = await apiFetch(`/api/stages/${deleteTarget.id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          fetchPipelines();
        } else {
          alert("Failed to delete stage: " + (data.error || "Unknown error"));
        }
      } else if (deleteTarget.type === "lead") {
        const res = await apiFetch(`/api/leads/${deleteTarget.id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          setSelectedLead(null);
          fetchPipelines();
        } else {
          alert("Failed to delete lead: " + (data.error || "Unknown error"));
        }
      }
    } catch (err) {
      console.error("Error executing delete:", err);
      setError(err instanceof Error ? err.message : "Could not save your changes.");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Rename Stage
  const handleRenameStage = async (stageId: string) => {
    if (!editingStageName.trim()) return;
    try {
      const res = await apiFetch(`/api/stages/${stageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingStageName }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingStageId(null);
        fetchPipelines();
      }
    } catch (err) {
      console.error("Error updating stage:", err);
      setError(err instanceof Error ? err.message : "Could not save your changes.");
    }
  };

  // Add Activity / Note to Lead
  const handleAddActivityNote = async (leadId: string) => {
    if (!activityNote.trim()) return;
    try {
      const res = await apiFetch(`/api/leads/${leadId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: activityNote, type: "NOTE" }),
      });
      const data = await res.json();
      if (data.success) {
        setActivityNote("");
        const leadRes = await apiFetch(`/api/leads/${leadId}`);
        const updated = await leadRes.json();
        if (updated.lead) setSelectedLead(updated.lead);
        fetchPipelines();
      }
    } catch (err) {
      console.error("Error adding activity:", err);
      setError(err instanceof Error ? err.message : "Could not save your changes.");
    }
  };

  // Compute Pipeline Stats
  const allLeads = activePipeline ? activePipeline.stages.flatMap((s) => s.leads) : [];
  const filteredLeads = allLeads.filter((lead) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      (lead.name || "").toLowerCase().includes(query) ||
      (lead.email || "").toLowerCase().includes(query) ||
      (lead.profileUrl || "").toLowerCase().includes(query) ||
      (lead.notes || "").toLowerCase().includes(query);
    const matchesChannel =
      selectedChannel === "ALL" || lead.channel === selectedChannel;
    return matchesSearch && matchesChannel;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-slate-700"
              title="Home"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Acquisition Pipeline CRM
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium">
                    Musa & Abdullah
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Shared customer acquisition • Updates across devices every 10 seconds
              </p>
            </div>
          </div>

          {/* Pipeline Switcher & Actions */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Pipeline Dropdown */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1">
              <span className="text-[11px] text-slate-400 font-semibold uppercase mr-2">
                Pipeline:
              </span>
              <select
                value={selectedPipelineId}
                onChange={(e) => setSelectedPipelineId(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setIsNewPipelineOpen(true)}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
              title="Create new pipeline"
            >
              <span>+ New Pipeline</span>
            </button>

            {/* Outbound Playbook Drawer Trigger */}
            <button
              onClick={() => setIsPlaybookOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>📋 Outbound Scripts</span>
            </button>

            {/* Warmup Tool Link */}
            <Link
              href="/warmup"
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <span>🔥 /warmup Quotas</span>
            </Link>

            {/* + Add Lead Button */}
            <button
              onClick={() => {
                setSelectedStageForNewLead(activePipeline?.stages[0]?.id || "");
                setLeadReminder(null);
                setIsAddLeadOpen(true);
              }}
              className="px-4 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>+ Add Lead</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main CRM Body */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-5">
        <ReminderCenter onOpenLead={openLead} />
        {error && <p role="alert" className="fixed bottom-5 left-5 right-5 z-[70] rounded-xl border border-rose-500/40 bg-slate-900 p-4 text-sm text-rose-300">{error} <button onClick={() => void fetchPipelines()} className="ml-3 underline">Retry</button></p>}
        {isLoading && <p className="text-sm text-slate-400">Loading your pipelines…</p>}
        {!isLoading && !error && pipelines.length === 0 && <p className="rounded-xl border border-slate-700 p-5 text-slate-300">Create your first pipeline to start adding leads.</p>}
        {/* KPI Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Total Prospects
            </span>
            <div className="text-2xl font-black text-white mt-1">
              {allLeads.length} <span className="text-xs font-normal text-slate-500">leads</span>
            </div>
            <span className="text-[10px] text-blue-400 mt-1">Across all pipeline stages</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Facebook (FB) Leads
            </span>
            <div className="text-2xl font-black text-blue-400 mt-1">
              {allLeads.filter((l) => l.channel === "FACEBOOK").length}
            </div>
            <span className="text-[10px] text-slate-400 mt-1">Facebook Sourced</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Instagram (Insta) Leads
            </span>
            <div className="text-2xl font-black text-pink-400 mt-1">
              {allLeads.filter((l) => l.channel === "INSTAGRAM").length}
            </div>
            <span className="text-[10px] text-slate-400 mt-1">Instagram Sourced</span>
          </div>
        </div>

        {/* Filters & Control Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center flex-wrap gap-3 flex-1">
            {/* Search */}
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <input
                type="text"
                placeholder="Search by name, email, description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pl-8"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-2.5 top-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Platform Filter (FB or Insta) */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="text-[11px] font-semibold uppercase">Platform:</span>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Platforms</option>
                <option value="FACEBOOK">Facebook (FB)</option>
                <option value="INSTAGRAM">Instagram (Insta)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Add Custom Stage */}
            <button
              onClick={() => setIsAddStageOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-1"
            >
              <span>+ Add Stage</span>
            </button>

            {/* View Mode Switcher */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setViewMode("kanban")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === "kanban" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                Kanban
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === "table" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                Table
              </button>
            </div>
          </div>
        </div>

        {/* KANBAN BOARD VIEW */}
        {viewMode === "kanban" && (
          <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-slate-700 items-start min-h-[600px]">
            {activePipeline?.stages.map((stage, stageIdx) => {
              const stageLeads = stage.leads.filter((lead) => {
                const query = searchQuery.toLowerCase();
                const matchesSearch =
                  (lead.name || "").toLowerCase().includes(query) ||
                  (lead.email || "").toLowerCase().includes(query) ||
                  (lead.profileUrl || "").toLowerCase().includes(query) ||
                  (lead.notes || "").toLowerCase().includes(query);
                const matchesChannel =
                  selectedChannel === "ALL" || lead.channel === selectedChannel;
                return matchesSearch && matchesChannel;
              });

              return (
                <div
                  key={stage.id}
                  className="w-80 flex-shrink-0 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col max-h-[750px] shadow-xl"
                >
                  {/* Stage Header */}
                  <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 rounded-t-2xl gap-2">
                    {editingStageId === stage.id ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="text"
                          value={editingStageName}
                          onChange={(e) => setEditingStageName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameStage(stage.id);
                            if (e.key === "Escape") setEditingStageId(null);
                          }}
                          autoFocus
                          className="w-full bg-slate-950 border border-blue-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                        />
                        <button
                          onClick={() => handleRenameStage(stage.id)}
                          className="px-2 py-1 text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white rounded"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setEditingStageId(null)}
                          className="px-2 py-1 text-[10px] text-slate-400 hover:text-white bg-slate-800 rounded"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                          <h3
                            className="text-xs font-bold text-white tracking-wide truncate"
                            title={stage.name}
                          >
                            {stage.name}
                          </h3>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex-shrink-0">
                            {stageLeads.length}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Edit Stage Button */}
                          <button
                            onClick={() => {
                              setEditingStageId(stage.id);
                              setEditingStageName(stage.name);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-all cursor-pointer"
                            title={`Rename stage "${stage.name}"`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>

                          {/* Delete Stage Button */}
                          <button
                            onClick={() => setDeleteTarget({ type: "stage", id: stage.id, name: stage.name })}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                            title={`Delete stage "${stage.name}"`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Stage Quick Add Button */}
                  <div className="px-3 pt-2">
                    <button
                      onClick={() => {
                        setSelectedStageForNewLead(stage.id);
                        setLeadReminder(null);
                        setIsAddLeadOpen(true);
                      }}
                      className="w-full py-1.5 rounded-xl border border-dashed border-slate-800 hover:border-slate-700 text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      + Add Lead Here
                    </button>
                  </div>

                  {/* Stage Leads Cards Container */}
                  <div className="p-3 space-y-3 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-800">
                    {stageLeads.length === 0 ? (
                      <div className="py-8 text-center text-[11px] text-slate-600 italic">
                        No leads in this stage
                      </div>
                    ) : (
                      stageLeads.map((lead) => (
                        <div
                          key={lead.id}
                          onClick={() => setSelectedLead(lead)}
                          className="bg-slate-950/80 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 shadow-md cursor-pointer transition-all hover:scale-[1.01] group space-y-2 relative"
                        >
                          {/* Top Row: Name & Platform (FB or Insta) */}
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                              {lead.name}
                            </h4>

                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1 ${
                                lead.channel === "FACEBOOK"
                                  ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                                  : "bg-pink-600/20 text-pink-300 border border-pink-500/30"
                              }`}
                            >
                              {lead.channel === "FACEBOOK" ? "Facebook (FB)" : "Instagram (Insta)"}
                            </span>
                          </div>

                          {/* Email (Optional) */}
                          {lead.email && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                              <span>✉</span>
                              <span className="truncate">{lead.email}</span>
                            </div>
                          )}

                          {/* Profile Link (FB or Insta Profile) */}
                          {lead.profileUrl && (
                            <a
                              href={
                                lead.profileUrl.startsWith("http://") || lead.profileUrl.startsWith("https://")
                                  ? lead.profileUrl
                                  : `https://${lead.profileUrl}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={`text-[11px] font-semibold flex items-center gap-1.5 truncate hover:underline ${
                                lead.channel === "FACEBOOK"
                                  ? "text-blue-400 hover:text-blue-300"
                                  : "text-pink-400 hover:text-pink-300"
                              }`}
                            >
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              <span className="truncate">
                                {lead.channel === "FACEBOOK" ? "FB Profile ↗" : "Insta Profile ↗"}
                              </span>
                            </a>
                          )}

                          {/* Other Description */}
                          {lead.notes && (
                            <p className="text-[11px] text-slate-300 line-clamp-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80 leading-relaxed">
                              {lead.notes}
                            </p>
                          )}

                          {/* Controls (Move & Delete) */}
                          <div className="flex justify-between items-center pt-1.5 border-t border-slate-900 text-[10px] text-slate-500">
                            {stageIdx > 0 ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveStage(lead.id, activePipeline.stages[stageIdx - 1].id);
                                }}
                                className="hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-800 flex items-center gap-0.5"
                                title="Move to previous stage"
                              >
                                ← Prev
                              </button>
                            ) : (
                              <span />
                            )}

                            {stageIdx < activePipeline.stages.length - 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveStage(lead.id, activePipeline.stages[stageIdx + 1].id);
                                }}
                                className="hover:text-blue-400 font-semibold px-1.5 py-0.5 rounded hover:bg-slate-800 flex items-center gap-0.5 ml-auto text-blue-300"
                                title="Advance to next stage"
                              >
                                Next Stage →
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TABLE VIEW */}
        {viewMode === "table" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-3">Lead Name</th>
                  <th className="py-3 px-3">Lead Platform</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Other Description</th>
                  <th className="py-3 px-3">Stage</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                      No leads matching filters. Click &quot;+ Add Lead&quot; to get started!
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3 font-bold text-white">
                        {lead.name}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              lead.channel === "FACEBOOK"
                                ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                                : "bg-pink-600/20 text-pink-300 border border-pink-500/30"
                            }`}
                          >
                            {lead.channel === "FACEBOOK" ? "Facebook (FB)" : "Instagram (Insta)"}
                          </span>
                          {lead.profileUrl && (
                            <a
                              href={
                                lead.profileUrl.startsWith("http://") || lead.profileUrl.startsWith("https://")
                                  ? lead.profileUrl
                                  : `https://${lead.profileUrl}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-400 hover:text-blue-300 text-[11px] font-bold inline-flex items-center gap-0.5 hover:underline"
                              title="Open profile link in new tab"
                            >
                              <span>Link</span>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {lead.email ? (
                          <span className="text-blue-400 font-medium">{lead.email}</span>
                        ) : (
                          <span className="text-slate-600 italic">None</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                        {lead.notes ? (
                          lead.notes
                        ) : (
                          <span className="text-slate-600 italic">No description</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-semibold">
                          {activePipeline?.stages.find((s) => s.id === lead.stageId)?.name || "Stage"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLead(lead);
                          }}
                          className="px-2.5 py-1 text-xs rounded bg-slate-800 text-blue-400 hover:text-white"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* LEAD DETAIL & ACTIVITY MODAL */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-xl font-extrabold text-white">{selectedLead.name}</h3>
                <span
                  className={`mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    selectedLead.channel === "FACEBOOK"
                      ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                      : "bg-pink-600/20 text-pink-300 border border-pink-500/30"
                  }`}
                >
                  {selectedLead.channel === "FACEBOOK" ? "Facebook (FB)" : "Instagram (Insta)"}
                </span>
              </div>

              <button
                onClick={() => setSelectedLead(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Email (Optional) */}
            {selectedLead.email ? (
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs">
                <span className="text-slate-400 block mb-1 font-semibold uppercase text-[10px]">
                  Email:
                </span>
                <a
                  href={`mailto:${selectedLead.email}`}
                  className="text-blue-400 hover:underline font-medium flex items-center gap-1.5"
                >
                  <span>✉</span>
                  <span>{selectedLead.email}</span>
                </a>
              </div>
            ) : (
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs text-slate-500 italic">
                No email provided (Optional)
              </div>
            )}

            {/* Profile Link (FB or Insta Profile) */}
            {selectedLead.profileUrl && (
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-slate-400 block mb-1 font-semibold uppercase text-[10px]">
                    {selectedLead.channel === "FACEBOOK" ? "Facebook" : "Instagram"} Profile Link:
                  </span>
                  <a
                    href={
                      selectedLead.profileUrl.startsWith("http://") ||
                      selectedLead.profileUrl.startsWith("https://")
                        ? selectedLead.profileUrl
                        : `https://${selectedLead.profileUrl}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline font-medium flex items-center gap-1.5 truncate"
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    <span className="truncate">{selectedLead.profileUrl}</span>
                  </a>
                </div>

                <a
                  href={
                    selectedLead.profileUrl.startsWith("http://") ||
                    selectedLead.profileUrl.startsWith("https://")
                      ? selectedLead.profileUrl
                      : `https://${selectedLead.profileUrl}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white transition-all text-xs font-bold flex-shrink-0 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Open</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            )}

            {/* Other Description */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1">
              <span className="text-slate-400 block font-semibold uppercase text-[10px]">
                Other Description / Notes:
              </span>
              <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                {selectedLead.notes || "No description provided."}
              </p>
            </div>

            {/* Current Stage & Move */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold uppercase text-[10px]">
                Current Stage:
              </span>
              <select
                value={selectedLead.stageId}
                onChange={(e) => handleMoveStage(selectedLead.id, e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                {activePipeline?.stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <section className="space-y-3 border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-bold">Activity & follow-ups</h4><button className="rounded-lg bg-blue-600 px-3 py-2 text-xs" onClick={e => void handleIncrementFollowUp(selectedLead.id, e)}>Log follow-up ({selectedLead.followUpCount})</button></div>
              <ul className="max-h-48 space-y-2 overflow-y-auto text-xs text-slate-300">{[...(selectedLead.activities ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(a => <li key={a.id} className="rounded-lg bg-slate-950 p-3"><p>{a.content}</p><time className="mt-1 block text-slate-500">{new Date(a.createdAt).toLocaleString()}</time></li>)}</ul>
              <label className="block text-xs text-slate-400">Add a note<textarea value={activityNote} onChange={e => setActivityNote(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white" /></label>
              <button onClick={() => void handleAddActivityNote(selectedLead.id)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs">Save note</button>
            </section>
            {/* Footer / Delete */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <button
                onClick={() => setDeleteTarget({ type: "lead", id: selectedLead.id, name: selectedLead.name })}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
              >
                Delete Lead
              </button>
              <button
                onClick={() => setSelectedLead(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD LEAD MODAL (ONLY NAME, EMAIL, PLATFORM, & DESCRIPTION) */}
      {isAddLeadOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-h-[90vh] overflow-y-auto max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Add New Prospect
              </h3>
              <button
                onClick={() => { setIsAddLeadOpen(false); setLeadReminder(null); }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4 text-xs">
              {leadReminder && <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-100"><p className="font-semibold">{leadReminder.message}</p>{leadReminder.duplicate && <><p className="mt-1 text-amber-200/80">{leadReminder.duplicate.name}{leadReminder.duplicate.createdBy ? ` · added by ${leadReminder.duplicate.createdBy}` : ""}</p><button type="button" onClick={() => openDuplicateLead(leadReminder.duplicate!.id)} className="mt-2 font-bold text-blue-300 underline">Open existing lead</button></>}</div>}
              {/* 1. Name */}
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Amy Wiese or Avery Jenkins"
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 2. Email (Optional) */}
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Email <span className="text-slate-500 font-normal">(Email or profile URL required)</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g., owner@company.com"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 3. Lead Platform (FB or Insta) */}
              <div>
                <label className="text-slate-300 block mb-1.5 font-semibold">
                  Lead Platform <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLeadForm({ ...leadForm, channel: "FACEBOOK" })}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      leadForm.channel === "FACEBOOK"
                        ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Facebook (FB)
                  </button>

                  <button
                    type="button"
                    onClick={() => setLeadForm({ ...leadForm, channel: "INSTAGRAM" })}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      leadForm.channel === "INSTAGRAM"
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 border-pink-500 text-white shadow-lg shadow-pink-600/30"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                    Instagram (Insta)
                  </button>
                </div>
              </div>

              {/* 4. Profile Link (FB or Insta Profile) */}
              <div>
                <label className="text-slate-300 block mb-1 font-semibold flex items-center justify-between">
                  <span>
                    {leadForm.channel === "FACEBOOK" ? "Facebook (FB)" : "Instagram (Insta)"} Profile Link{" "}
                    <span className="text-slate-500 font-normal">(Email or profile URL required)</span>
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={
                      leadForm.channel === "FACEBOOK"
                        ? "https://facebook.com/username or profile URL"
                        : "https://instagram.com/username"
                    }
                    value={leadForm.profileUrl}
                    onChange={(e) => setLeadForm({ ...leadForm, profileUrl: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pl-8"
                  />
                  <svg
                    className="w-4 h-4 text-slate-500 absolute left-2.5 top-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                </div>
              </div>

              {/* 5. Other Description */}
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Other Description
                </label>
                <textarea
                  rows={4}
                  placeholder="Add any notes, background, offer context, or observations..."
                  value={leadForm.notes}
                  onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsAddLeadOpen(false); setLeadReminder(null); }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={leadPending}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/30 cursor-pointer disabled:opacity-60"
                >
                  {leadPending ? "Saving…" : "Save Lead to Pipeline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW CUSTOM PIPELINE MODAL */}
      {isNewPipelineOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Create New Customer Pipeline</h3>
            <p className="text-xs text-slate-400">
              Build a custom acquisition funnel for different niches (e.g. Solar, MedSpas, E-commerce).
            </p>

            <form onSubmit={handleCreatePipeline} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Pipeline Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., High-Ticket Solar Client Acquisition"
                  value={newPipelineForm.name}
                  onChange={(e) => setNewPipelineForm({ ...newPipelineForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Description</label>
                <input
                  type="text"
                  placeholder="e.g., Cold calling & Meta Ads lead pipeline"
                  value={newPipelineForm.description}
                  onChange={(e) =>
                    setNewPipelineForm({ ...newPipelineForm, description: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewPipelineOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Create Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD STAGE MODAL */}
      {isAddStageOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Add New Funnel Stage</h3>
            <form onSubmit={handleAddStage} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Stage Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Audit Video Sent / Proposal Review"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddStageOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Add Stage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MUSA KHAN OUTBOUND PLAYBOOK & SCRIPTS DRAWER */}
      {isPlaybookOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="bg-slate-900 border-l border-slate-800 max-w-xl w-full h-full p-6 shadow-2xl space-y-6 overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Musa Khan Outbound Scripts & Laws
                </h3>
                <p className="text-xs text-slate-400">
                  Ready-to-use copy templates based on 7.2, 7.3 & the 12 Outbound Laws.
                </p>
              </div>
              <button
                onClick={() => setIsPlaybookOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Script 1: Facebook Day 2 Workflow */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-blue-400">1. Facebook Day 2 Workflow DM</span>
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `Hey {{Name}}, saw your post in {{GroupName}} regarding {{Topic}} and really resonated with your point. Noticed you run {{CompanyName}}—quick question, are you guys currently taking on new clients this quarter or at full capacity?`
                    )
                  }
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  Copy Script
                </button>
              </div>
              <p className="text-slate-300 bg-slate-900 p-2.5 rounded-lg font-mono text-[11px] leading-relaxed">
                &quot;Hey &#123;&#123;Name&#125;&#125;, saw your post in &#123;&#123;GroupName&#125;&#125; regarding &#123;&#123;Topic&#125;&#125; and really resonated with your point. Noticed you run &#123;&#123;CompanyName&#125;&#125;—quick question, are you guys currently taking on new clients this quarter or at full capacity?&quot;
              </p>
              <span className="text-[10px] text-slate-500 block">
                Rule: Send ONLY after they accept your friend request (Green Light).
              </span>
            </div>

            {/* Script 2: The Give-First Loom Video Micro-Commitment */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-emerald-400">2. Give-First Loom Audit (Micro-Commitment)</span>
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `Hey {{Name}}, I put together a quick 90-second video breaking down 2 specific bottlenecks on {{CompanyName}}'s landing page that are costing you appointment bookings. Would you be open to me sending over the link? No pitch or sales call required.`
                    )
                  }
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  Copy Script
                </button>
              </div>
              <p className="text-slate-300 bg-slate-900 p-2.5 rounded-lg font-mono text-[11px] leading-relaxed">
                &quot;Hey &#123;&#123;Name&#125;&#125;, I put together a quick 90-second video breaking down 2 specific bottlenecks on &#123;&#123;CompanyName&#125;&#125;&apos;s landing page that are costing you appointment bookings. Would you be open to me sending over the link? No pitch or sales call required.&quot;
              </p>
              <span className="text-[10px] text-slate-500 block">
                Law: Small ask. Getting an easy &apos;yes&apos; before presenting any offer.
              </span>
            </div>

            {/* Script 3: Law 2 Followup In Volume */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-amber-400">3. The Non-Pushy Value Follow-Up</span>
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `Hey {{Name}}, know you're super busy running the shop! Just wanted to share this quick case study of how another {{Niche}} owner fixed their booking conversion rate last week: [Link]. Hope it helps!`
                    )
                  }
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  Copy Script
                </button>
              </div>
              <p className="text-slate-300 bg-slate-900 p-2.5 rounded-lg font-mono text-[11px] leading-relaxed">
                &quot;Hey &#123;&#123;Name&#125;&#125;, know you&apos;re super busy running the shop! Just wanted to share this quick case study of how another &#123;&#123;Niche&#125;&#125; owner fixed their booking conversion rate last week: [Link]. Hope it helps!&quot;
              </p>
              <span className="text-[10px] text-slate-500 block">
                Law 2: &quot;Follow-up isn&apos;t bothering someone. Most appointments book after 5-8 followups.&quot;
              </span>
            </div>

            {/* 7 Iron Principles of Influence */}
            <div className="bg-indigo-950/30 p-4 rounded-2xl border border-indigo-800/40 space-y-2 text-xs text-indigo-200">
              <h4 className="font-bold text-indigo-400 text-sm">
                Robert Cialdini&apos;s 7 Iron Principles (Musa Khan 7.3)
              </h4>
              <ul className="space-y-1.5 text-[11px] list-disc list-inside text-slate-300">
                <li><strong>1. Give First:</strong> Lead with genuine value before asking for anything.</li>
                <li><strong>2. Micro-Commitment:</strong> Start with a tiny, frictionless ask.</li>
                <li><strong>3. Social Proof:</strong> Use specific numbers over vague claims.</li>
                <li><strong>4. Authority:</strong> Demonstrate domain expertise, direct language.</li>
                <li><strong>5. Rapport:</strong> Speak their niche language and reference observables.</li>
                <li><strong>6. Scarcity:</strong> Create legitimate time or capacity constraints.</li>
                <li><strong>7. Shared Identity:</strong> Align with their peer reference group.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION POPUP MODAL (REPLACES BROWSER ALERT) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {deleteTarget.type === "stage" ? "Delete Funnel Stage" : "Delete Lead"}
                </h3>
                <p className="text-xs text-slate-400">
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              {deleteTarget.type === "stage" ? (
                <>
                  Are you sure you want to delete the stage{" "}
                  <span className="font-bold text-white">&quot;{deleteTarget.name}&quot;</span>?
                  <span className="block text-rose-400 mt-1.5 text-[11px] font-medium">
                    ⚠️ Any leads currently in this stage will also be permanently deleted.
                  </span>
                </>
              ) : (
                <>
                  Are you sure you want to delete lead{" "}
                  <span className="font-bold text-white">&quot;{deleteTarget.name}&quot;</span> from this pipeline?
                </>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 text-center text-xs text-slate-500">
        Musa Khan Full Customer Acquisition CRM • End-to-End Meta Lead Sourcing & Pipeline Management
      </footer>
    </div>
  );
}

