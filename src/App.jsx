import { useState, useEffect, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";

const SUPABASE_URL = "https://lfuhmhubafgjqzuueyzw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmdWhtaHViYWZnanF6dXVleXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MjE2NjQsImV4cCI6MjA5NjM5NzY2NH0.99TD4fo6FiOWE61onuY6UHpBurZC6qUZEE55ZrATJ8U";

const api = async (method, path, body) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  if (res.status === 204) return null;
  return res.json();
};

const computeStatus = (boost) => {
  const now = new Date();
  const evento = new Date(boost.data_evento);
  if (now >= evento) return "encerrado";
  return "ativo";
};

const statusConfig = {
  ativo: { label: "Ativo", color: "var(--up)", bg: "var(--up-soft)" },
  encerrado: { label: "Encerrado", color: "var(--t3)", bg: "var(--surface-2)" },
};

const fmt = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const AVATAR_COLORS = ["#e8540f", "#11874c", "#4a52c9", "#b8770a", "#2f6f9e", "#a8456b", "#3a8a55", "#a85f8e"];

const splitConfronto = (confronto) => {
  const parts = (confronto || "").split(/\s+vs\.?\s+/i);
  return parts.length === 2 ? parts : [confronto || "", ""];
};

const initials = (name) =>
  (name || "").trim().replace(/[^a-zA-ZÀ-ÿ\s]/g, "").slice(0, 2).toUpperCase() || "?";

const colorFor = (seed) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const fmtDate = (d) =>
  new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

// Gera e baixa um .csv com a lista de IDs de jogadores processados em um relatório
const downloadIds = (ids, boost) => {
  if (!ids || !ids.length) return;
  const lines = ["ID do Jogador", ...ids.map((id) => String(id))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug = (boost?.id_jogo || boost?.confronto || "relatorio").toString().replace(/[^a-zA-Z0-9_-]+/g, "_");
  a.download = `ids_processados_${slug}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── ICONS ───────────────────────────────────────────────────────────────────
const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconArrow = ({ left }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {left ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
  </svg>
);
const IconUpload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
);
const IconChart = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);
const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconHistory = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4" /><path d="M12 8v4l3 3" />
  </svg>
);
const IconCalendar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconClock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
  </svg>
);
const IconUser = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const IconTag = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);
const IconSave = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </svg>
);
const IconChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 6 15 12 9 18" />
  </svg>
);
const IconTrophy = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" />
    <path d="M7 5H4a1 1 0 0 0-1 1 5 5 0 0 0 4 4.9M17 5h3a1 1 0 0 1 1 1 5 5 0 0 1-4 4.9" />
  </svg>
);
const IconCashout = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);
const IconTicket = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <line x1="13" y1="5" x2="13" y2="19" strokeDasharray="2 2" />
  </svg>
);
const IconCoin = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><path d="M14.8 9a2.7 2.7 0 0 0-2.3-1c-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2a2.7 2.7 0 0 1-2.3-1M12 6.5v11" />
  </svg>
);
const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// ─── STYLES ──────────────────────────────────────────────────────────────────
const v = (name) => `var(--${name})`;
const S = {
  app: {
    minHeight: "100vh",
    background: v("bg"),
    color: v("t1"),
    fontFamily: "var(--font)",
    position: "relative",
  },
  main: { position: "relative", zIndex: 1, maxWidth: 1240, margin: "0 auto", padding: "0 30px 60px" },
  // shell com sidebar (inspirado no layout do shadcn-admin)
  shell: { display: "flex", alignItems: "flex-start", minHeight: "100vh" },
  sidebar: {
    width: 240, flexShrink: 0, background: v("surface"), borderRight: `1px solid ${v("line")}`,
    padding: "22px 14px", display: "flex", flexDirection: "column", gap: 2,
    position: "sticky", top: 0, height: "100vh", boxSizing: "border-box",
  },
  sidebarLogo: { display: "flex", alignItems: "center", gap: 11, padding: "4px 10px", marginBottom: 22 },
  sidebarNavLabel: {
    fontFamily: "var(--mono)", fontSize: 9.5, color: v("t3"), textTransform: "uppercase",
    letterSpacing: "0.12em", padding: "16px 12px 7px", fontWeight: 500,
  },
  sidebarNavItem: (active) => ({
    display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: "var(--r-sm)",
    fontSize: 13.5, fontWeight: active ? 700 : 500,
    color: active ? v("acc") : v("t2"),
    background: active ? v("acc-soft") : "transparent",
    border: `1px solid ${active ? v("acc-line") : "transparent"}`,
    cursor: "pointer", transition: "background .12s, border-color .12s, color .12s",
    width: "100%", textAlign: "left", fontFamily: "var(--font)",
  }),
  contentArea: { flex: 1, minWidth: 0, padding: "30px 36px 60px" },
  pageTitle: { fontSize: 20, fontWeight: 800, letterSpacing: -0.4, color: v("t1"), marginBottom: 2 },
  pageSub: { fontFamily: "var(--mono)", fontSize: 11.5, color: v("t3"), marginBottom: 24 },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "26px 0", borderBottom: `1px solid ${v("line")}`,
    marginBottom: 28, position: "sticky", top: 0, background: v("bg"), zIndex: 5,
  },
  logo: { display: "flex", alignItems: "center", gap: 12 },
  logoMark: {
    width: 38, height: 38, borderRadius: 10,
    background: "#ffffff", border: `1px solid ${v("line-2")}`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "var(--mono)", fontSize: 16, fontWeight: 800, color: v("t1"), letterSpacing: -0.5,
    boxShadow: "0 1px 2px rgba(27,24,20,0.12), inset 0 1px 0 rgba(255,255,255,0.6)",
  },
  logoText: { fontSize: 18, fontWeight: 800, letterSpacing: -0.4, color: v("t1") },
  logoSub: { fontFamily: "var(--mono)", fontSize: 10.5, color: v("t3"), letterSpacing: "0.12em", textTransform: "uppercase" },
  btnPrimary: {
    display: "flex", alignItems: "center", gap: 8,
    background: "#ffffff", border: `1px solid ${v("line-2")}`,
    color: v("t1"), borderRadius: "var(--r-sm)",
    padding: "10px 17px", fontSize: 14.5, fontWeight: 600,
    cursor: "pointer", transition: "background .12s, border-color .12s",
    boxShadow: "0 1px 2px rgba(27,24,20,0.10), inset 0 1px 0 rgba(255,255,255,0.6)",
    fontFamily: "var(--font)",
  },
  tabs: { display: "flex", gap: 6, marginBottom: 28 },
  tab: (active) => ({
    display: "inline-flex", alignItems: "center", gap: 7,
    padding: "9px 18px", borderRadius: "var(--r-sm)", cursor: "pointer",
    fontSize: 13.5, fontWeight: active ? 700 : 500,
    background: active ? v("acc-soft") : "transparent",
    color: active ? v("acc") : v("t2"),
    border: `1px solid ${active ? v("acc-line") : "transparent"}`,
    transition: "all 0.12s", fontFamily: "var(--font)",
  }),
  filterBar: {
    display: "flex", gap: 12, marginBottom: 24, alignItems: "center", flexWrap: "wrap",
  },
  input: {
    background: v("surface"), border: `1px solid ${v("line-2")}`,
    borderRadius: "var(--r-sm)", padding: "10px 14px", color: v("t1"), fontSize: 13.5,
    outline: "none", transition: "border-color .12s, box-shadow .12s",
    fontFamily: "var(--font)",
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(376px, 1fr))", gap: 16 },
  card: {
    background: v("surface"), border: `1px solid ${v("line")}`,
    borderRadius: "var(--r-lg)", padding: 22, position: "relative", overflow: "hidden",
    transition: "border-color 0.15s, box-shadow 0.15s",
    boxShadow: "var(--shadow)",
    cursor: "default",
  },
  cardAccent: (color) => ({
    position: "absolute", top: 0, left: 0, right: 0, height: 3,
    background: color,
  }),
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 14 },
  matchup: { display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 },
  avatar: (color) => ({
    width: 44, height: 44, borderRadius: 13, flexShrink: 0,
    background: `${color}1F`, border: `1px solid ${color}40`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, color, letterSpacing: 0,
  }),
  matchupCenter: { minWidth: 0 },
  confronto: {
    fontSize: 16, fontWeight: 700, letterSpacing: -0.3, color: v("t1"), lineHeight: 1.3,
    overflowWrap: "anywhere", wordBreak: "break-word",
  },
  confrontoVs: { color: v("acc") },
  idJogo: { fontFamily: "var(--mono)", fontSize: 11, color: v("t3"), marginTop: 3 },
  // faixa de destaque (odd antiga -> nova)
  oddRow: {
    display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
    padding: "12px 14px", background: v("surface-2"), borderRadius: "var(--r-md)",
    border: `1px solid ${v("line")}`,
  },
  oddOld: { fontFamily: "var(--mono)", fontSize: 13, color: v("t3"), textDecoration: "line-through" },
  oddArrow: { fontSize: 13, color: v("acc"), fontWeight: 700 },
  oddNew: { fontFamily: "var(--mono)", fontSize: 18, fontWeight: 800, color: v("acc"), letterSpacing: "-0.02em" },
  maxStake: { fontFamily: "var(--mono)", fontSize: 12, marginLeft: "auto", color: v("t2"), fontWeight: 600 },
  // grade de info 2-col com ícones
  metaRow: { display: "flex", flexWrap: "wrap", gap: "10px 24px", marginBottom: 16 },
  metaRowItem: { display: "flex", alignItems: "center", gap: 9 },
  metaRowIconWrap: {
    width: 26, height: 26, borderRadius: 8, flexShrink: 0,
    background: v("surface-2"), color: v("t3"), border: `1px solid ${v("line")}`,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  metaRowText: { display: "flex", flexDirection: "column", gap: 1 },
  metaRowLabel: { fontFamily: "var(--mono)", fontSize: 9.5, color: v("t3"), textTransform: "uppercase", letterSpacing: "0.1em" },
  metaRowValue: { fontFamily: "var(--mono)", fontSize: 12.5, fontWeight: 600, color: v("t1") },
  marketTag: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 600,
    background: v("info-soft"), color: v("info"),
    border: "1px solid transparent",
  },
  badge: (color, bg) => ({
    display: "inline-flex", alignItems: "center", gap: 7,
    padding: "5px 11px", borderRadius: 8, fontSize: 11.5, fontWeight: 700,
    color, background: bg, letterSpacing: "0.04em", textTransform: "uppercase",
    whiteSpace: "nowrap",
  }),
  cardActions: { display: "flex", gap: 8, marginTop: 4 },
  btnReport: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 7,
    background: v("surface-2"), border: `1px solid ${v("line")}`,
    color: v("acc"), borderRadius: "var(--r-sm)", padding: "12px 16px", fontSize: 13.5,
    fontWeight: 700, cursor: "pointer", transition: "background .12s, border-color .12s",
    fontFamily: "var(--font)",
  },
  btnReportLeft: { display: "flex", alignItems: "center", gap: 8 },
  // bloco "Mercado" em destaque
  marketBox: {
    display: "flex", alignItems: "center", gap: 13, marginBottom: 16,
    padding: "12px 14px", background: v("surface-2"), borderRadius: "var(--r-md)",
    border: `1px solid ${v("line")}`,
  },
  marketBoxIcon: {
    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
    background: v("info-soft"), color: v("info"),
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  marketBoxLabel: { fontFamily: "var(--mono)", fontSize: 9.5, color: v("t3"), textTransform: "uppercase", letterSpacing: "0.1em" },
  marketBoxValue: { fontSize: 15, fontWeight: 700, color: v("t1"), marginTop: 2 },
  // estatística do bloco de resultado: ícone + label + valor + barrinha de destaque
  resultStat: { display: "flex", flexDirection: "column", gap: 9 },
  resultStatLabel: { fontFamily: "var(--mono)", fontSize: 9.5, color: v("t3"), textTransform: "uppercase", letterSpacing: "0.1em" },
  resultStatValue: { fontFamily: "var(--mono)", fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em", color: v("t1") },
  resultStatBar: (color) => ({ width: 26, height: 3, borderRadius: 2, background: color }),
  btnDelete: {
    display: "flex", alignItems: "center", justifyContent: "center",
    background: v("down-soft"), border: "1px solid transparent",
    color: v("down"), borderRadius: "var(--r-sm)", padding: "9px 12px", fontSize: 12,
    fontWeight: 600, cursor: "pointer", transition: "all 0.12s",
    fontFamily: "var(--font)",
  },
  empty: {
    textAlign: "center", padding: "80px 20px", color: v("t3"),
  },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: v("t2"), marginBottom: 8 },
  // MODAL
  overlay: {
    position: "fixed", inset: 0, background: "rgba(27,24,20,0.45)", zIndex: 100,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    backdropFilter: "blur(3px)",
  },
  modal: {
    background: v("surface"), border: `1px solid ${v("line")}`,
    borderRadius: "var(--r-lg)", width: "100%", maxWidth: 540, maxHeight: "90vh",
    overflowY: "auto", position: "relative", boxShadow: "0 20px 60px -20px rgba(40,32,20,0.35)",
  },
  modalHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "24px 28px 0",
  },
  modalTitle: { fontSize: 18, fontWeight: 800, letterSpacing: -0.3, color: v("t1") },
  modalBody: { padding: "24px 28px 28px" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  formGroup: { display: "flex", flexDirection: "column", gap: 6 },
  formGroupFull: { display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" },
  label: { fontFamily: "var(--mono)", fontSize: 10, color: v("t3"), textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 },
  select: {
    background: v("surface"), border: `1px solid ${v("line-2")}`,
    borderRadius: "var(--r-sm)", padding: "10px 14px", color: v("t1"), fontSize: 13.5,
    outline: "none", fontFamily: "var(--font)",
    appearance: "none",
  },
  btnSubmit: {
    width: "100%", padding: "13px", borderRadius: "var(--r-sm)", border: `1px solid ${v("line-2")}`,
    background: "#ffffff",
    color: v("t1"), fontSize: 15, fontWeight: 700, cursor: "pointer",
    marginTop: 8, letterSpacing: -0.2,
    boxShadow: "0 1px 2px rgba(27,24,20,0.10), inset 0 1px 0 rgba(255,255,255,0.6)",
    fontFamily: "var(--font)",
  },
  // RELATÓRIO
  reportPage: {
    position: "fixed", inset: 0, background: v("bg"), zIndex: 200,
    overflowY: "auto",
  },
  reportHeader: {
    background: v("surface"), borderBottom: `1px solid ${v("line")}`,
    padding: "18px 32px", display: "flex", alignItems: "center", gap: 16,
  },
  btnBack: {
    display: "flex", alignItems: "center", gap: 7,
    background: v("surface"), border: `1px solid ${v("line-2")}`,
    color: v("t2"), borderRadius: "var(--r-sm)", padding: "9px 15px", fontSize: 13,
    cursor: "pointer", fontFamily: "var(--font)", fontWeight: 600,
  },
  reportContent: { maxWidth: 980, margin: "0 auto", padding: "36px 24px" },
  reportTitle: { fontSize: 22, fontWeight: 800, letterSpacing: -0.4, marginBottom: 4, color: v("t1") },
  reportSub: { fontSize: 13.5, color: v("t3"), marginBottom: 28 },
  uploadZone: {
    border: `1.5px dashed ${v("line-2")}`, borderRadius: "var(--r-lg)",
    padding: "48px 32px", textAlign: "center", cursor: "pointer",
    transition: "all 0.15s", marginBottom: 28,
    background: v("surface"),
  },
  uploadTitle: { fontSize: 15, fontWeight: 700, color: v("t1"), marginBottom: 6 },
  uploadSub: { fontSize: 13, color: v("t3") },
  // KPI compactos — ícone no canto, número grande, contexto pequeno embaixo (estilo shadcn-admin)
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 28 },
  statCard: {
    background: v("surface"), border: `1px solid ${v("line")}`, borderRadius: "var(--r-lg)",
    padding: "18px 20px", boxShadow: "var(--shadow)", position: "relative",
  },
  statCardTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
  statIconWrap: (color) => ({
    width: 30, height: 30, borderRadius: 9, flexShrink: 0,
    background: `${color}1F`, color,
    display: "flex", alignItems: "center", justifyContent: "center",
  }),
  statLabel: { fontFamily: "var(--mono)", fontSize: 10, color: v("t3"), textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 500 },
  statValue: { fontFamily: "var(--mono)", fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: v("t1"), lineHeight: 1 },
  statSub: { fontSize: 11.5, color: v("t3"), marginTop: 7 },
  tableWrap: {
    background: v("surface"), border: `1px solid ${v("line")}`,
    borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "var(--shadow)",
  },
  tableHeader: { padding: "16px 20px", borderBottom: `1px solid ${v("line")}`, fontSize: 13.5, fontWeight: 700, color: v("t1") },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12.5 },
  th: { padding: "10px 18px", textAlign: "left", color: v("t3"), fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: `1px solid ${v("line")}`, fontWeight: 500 },
  td: { padding: "10px 18px", borderBottom: `1px solid ${v("line")}`, color: v("t2") },
  btnSecondary: {
    display: "flex", alignItems: "center", gap: 8,
    background: v("surface"), border: `1px solid ${v("line-2")}`,
    color: v("t1"), borderRadius: "var(--r-sm)", padding: "10px 18px", fontSize: 13.5,
    fontWeight: 600, cursor: "pointer", transition: "background .12s",
    fontFamily: "var(--font)",
  },
  reportBox: {
    marginTop: 14, padding: "14px 16px", borderRadius: "var(--r-md)",
    background: v("up-soft"), border: "1px solid transparent",
  },
  reportBoxTitle: {
    fontFamily: "var(--mono)", fontSize: 10, color: v("up"), textTransform: "uppercase",
    letterSpacing: "0.1em", fontWeight: 600, marginBottom: 12,
    display: "flex", alignItems: "center", gap: 7,
  },
  reportBoxGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 },
  reportBoxItem: { display: "flex", flexDirection: "column", gap: 3 },
  reportBoxLabel: { fontFamily: "var(--mono)", fontSize: 9, color: v("t3"), textTransform: "uppercase", letterSpacing: "0.08em" },
  reportBoxValue: { fontFamily: "var(--mono)", fontSize: 14, fontWeight: 700, color: v("t1") },
  barRow: { marginBottom: 14 },
  barTrack: { height: 8, borderRadius: 6, background: v("surface-2"), overflow: "hidden", border: `1px solid ${v("line")}` },
  btnSaveReport: {
    display: "flex", alignItems: "center", gap: 8,
    background: "#ffffff", border: `1px solid ${v("line-2")}`,
    color: v("t1"), borderRadius: "var(--r-sm)",
    padding: "10px 18px", fontSize: 13.5, fontWeight: 600,
    cursor: "pointer", marginBottom: 20,
    boxShadow: "0 1px 2px rgba(27,24,20,0.10), inset 0 1px 0 rgba(255,255,255,0.6)",
    fontFamily: "var(--font)",
  },
};

// ─── FORM MODAL ──────────────────────────────────────────────────────────────
function FormModal({ onClose, onSave, loading }) {
  const [form, setForm] = useState({
    confronto: "", id_jogo: "", feito_por: "Neto", pedido_por: "",
    data_evento: "", odd_antiga: "", odd_nova: "", max_stake: "", mercado: "",
    feito_em: "",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.confronto || !form.id_jogo || !form.data_evento || !form.odd_antiga || !form.odd_nova || !form.max_stake || !form.pedido_por) {
      alert("Preencha todos os campos.");
      return;
    }
    await onSave({
      ...form,
      odd_antiga: parseFloat(form.odd_antiga),
      odd_nova: parseFloat(form.odd_nova),
      max_stake: parseFloat(form.max_stake),
      data_evento: new Date(form.data_evento).toISOString(),
      feito_em: form.feito_em ? new Date(form.feito_em).toISOString() : null,
    });
  };

  const inputStyle = { ...S.input, width: "100%", boxSizing: "border-box" };

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal} className="modal">
        <div style={S.modalHeader} className="modal-header">
          <span style={S.modalTitle}>Nova Welcome Boost</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer" }}>
            <IconClose />
          </button>
        </div>
        <div style={S.modalBody} className="modal-body">
          <div style={S.formGrid} className="form-grid">
            <div style={S.formGroupFull} className="form-group-full">
              <span style={S.label}>Confronto</span>
              <input style={inputStyle} placeholder="Ex: Brazil vs. Egypt" value={form.confronto} onChange={set("confronto")} />
            </div>
            <div style={S.formGroup}>
              <span style={S.label}>ID do Jogo</span>
              <input style={inputStyle} placeholder="Ex: 5024247122" value={form.id_jogo} onChange={set("id_jogo")} />
            </div>
            <div style={S.formGroup}>
              <span style={S.label}>Mercado</span>
              <input style={inputStyle} placeholder="Ex: Resultado Final, Over/Under..." value={form.mercado} onChange={set("mercado")} />
            </div>
            <div style={S.formGroup}>
              <span style={S.label}>Feito por</span>
              <select style={{ ...S.select, width: "100%", boxSizing: "border-box" }} value={form.feito_por} onChange={set("feito_por")}>
                <option>Neto</option>
                <option>Rodrigo</option>
              </select>
            </div>
            <div style={S.formGroupFull} className="form-group-full">
              <span style={S.label}>Pedido por</span>
              <input style={inputStyle} placeholder="Nome de quem solicitou" value={form.pedido_por} onChange={set("pedido_por")} />
            </div>
            <div style={S.formGroupFull} className="form-group-full">
              <span style={S.label}>Data e Hora do Evento</span>
              <input type="datetime-local" style={inputStyle} value={form.data_evento} onChange={set("data_evento")} />
            </div>
            <div style={S.formGroupFull} className="form-group-full">
              <span style={S.label}>Feito em (data e horário)</span>
              <input type="datetime-local" style={inputStyle} value={form.feito_em} onChange={set("feito_em")} />
            </div>
            <div style={S.formGroup}>
              <span style={S.label}>Odd Antiga</span>
              <input style={inputStyle} type="number" step="0.01" placeholder="Ex: 1.80" value={form.odd_antiga} onChange={set("odd_antiga")} />
            </div>
            <div style={S.formGroup}>
              <span style={S.label}>Odd Nova (Boost)</span>
              <input style={inputStyle} type="number" step="0.01" placeholder="Ex: 2.00" value={form.odd_nova} onChange={set("odd_nova")} />
            </div>
            <div style={S.formGroupFull} className="form-group-full">
              <span style={S.label}>Max Stake (R$)</span>
              <input style={inputStyle} type="number" step="0.01" placeholder="Ex: 100.00" value={form.max_stake} onChange={set("max_stake")} />
            </div>
          </div>
          <button style={{ ...S.btnSubmit, opacity: loading ? 0.6 : 1 }} onClick={submit} disabled={loading}>
            {loading ? "Salvando..." : "Cadastrar Boost"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RELATÓRIO ───────────────────────────────────────────────────────────────
function ReportPage({ boost, onBack, onSaveReport }) {
  const [rows, setRows] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [savedReport, setSavedReport] = useState(false);
  const [selectedMarkets, setSelectedMarkets] = useState(null); // null = ainda não inicializado
  const [tableLimit, setTableLimit] = useState(100);

  const processFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
      setRows(data);
      setSelectedMarkets(null);
    };
    reader.readAsArrayBuffer(file);
  };

  // Lista os mercados (Market types) presentes no arquivo, com a contagem de apostas de cada um
  // (memoizado: só recalcula quando o arquivo muda, não a cada clique na caixinha)
  const marketOptions = useMemo(() => {
    if (!rows) return [];
    const counts = new Map();
    for (const r of rows) {
      const m = r["Market types"] || "(sem mercado informado)";
      counts.set(m, (counts.get(m) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }));
  }, [rows]);

  // Na primeira leitura do arquivo, seleciona automaticamente os mercados que batem
  // com o texto cadastrado em "Mercado" da boost (ou todos, se não houver match / não houver mercado definido)
  useEffect(() => {
    if (!rows || selectedMarkets !== null || marketOptions.length === 0) return;
    const wanted = (boost.mercado || "").trim().toLowerCase();
    let initial;
    if (wanted) {
      const matches = marketOptions.filter((m) => m.value.toLowerCase().includes(wanted));
      initial = matches.length > 0 ? matches.map((m) => m.value) : marketOptions.map((m) => m.value);
    } else {
      initial = marketOptions.map((m) => m.value);
    }
    setSelectedMarkets(new Set(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, marketOptions]);

  const toggleMarket = useCallback((value) => {
    setTableLimit(100);
    setSelectedMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const onInput = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  // Métricas — tudo memoizado e calculado em uma única passada pelas linhas,
  // recalculando somente quando o arquivo ou a seleção de mercados mudar
  // (evita travamentos ao marcar/desmarcar caixinhas em arquivos grandes)
  const { marketFiltered, removedByMarket, stats } = useMemo(() => {
    if (!rows) return { marketFiltered: null, removedByMarket: 0, stats: null };
    const filtered = selectedMarkets
      ? rows.filter((r) => selectedMarkets.has(r["Market types"] || "(sem mercado informado)"))
      : rows;

    const idGetter = (r) => r["Player"] || r["Player Id"] || r["External User Id"];
    const idsTodas = new Set();
    const idsValidas = new Set();
    let totalStake = 0, totalWin = 0, qtdApostas = 0, wins = 0, lost = 0, cashout = 0;
    const valid = [];

    for (const r of filtered) {
      const status = (r["Status"] || "").toLowerCase();
      idsTodas.add(idGetter(r));
      if (status === "voidcashout" || status === "void") continue;

      valid.push(r);
      idsValidas.add(idGetter(r));
      qtdApostas++;
      totalStake += parseFloat(r["Stake"]) || 0;
      totalWin += parseFloat(r["Winnings"]) || 0;
      if (status === "win") wins++;
      else if (status === "lost") lost++;
      else if (status === "cashout") cashout++;
    }

    const ggr = totalStake - totalWin;
    const ticketMedio = qtdApostas > 0 ? totalStake / qtdApostas : 0;

    const computedStats = {
      totalStake, ggr, qtdApostas,
      idsUnicos: idsTodas.size,
      idsUnicosValidas: idsValidas.size,
      idsProcessados: [...idsTodas].filter((id) => id !== undefined && id !== null && id !== ""),
      totalApostasGeral: filtered.length,
      ticketMedio, wins, lost, cashout, valid,
    };

    return {
      marketFiltered: filtered,
      removedByMarket: rows.length - filtered.length,
      stats: computedStats,
    };
  }, [rows, selectedMarkets]);

  const saveReport = async () => {
    if (!stats) return;
    setSavingReport(true);
    try {
      await onSaveReport({
        boost_id: boost.id,
        total_stake: stats.totalStake,
        ggr: stats.ggr,
        ids_unicos: stats.idsUnicos,
        ticket_medio: stats.ticketMedio,
        qtd_apostas: stats.qtdApostas,
        wins: stats.wins,
        lost: stats.lost,
        cashout: stats.cashout,
        player_ids: stats.idsProcessados,
      });
      setSavedReport(true);
    } catch (e) {
      alert("Erro ao salvar relatório: " + e.message);
    }
    setSavingReport(false);
  };

  const statusColor = (s) => {
    const sl = (s || "").toLowerCase();
    if (sl === "win") return "var(--up)";
    if (sl === "lost") return "var(--down)";
    if (sl === "cashout") return "var(--warn)";
    return "var(--t3)";
  };

  return (
    <div style={S.reportPage}>
      <div style={S.reportHeader} className="report-header">
        <button style={S.btnBack} onClick={onBack}>
          <IconArrow left /> Voltar
        </button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>{boost.confronto}</div>
          <div style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)" }}>ID {boost.id_jogo}</div>
        </div>
      </div>

      <div style={S.reportContent} className="report-content">
        <div style={S.reportTitle} className="report-title">Relatório de Resultado</div>
        <div style={S.reportSub}>
          Odd: {boost.odd_antiga} → {boost.odd_nova} &nbsp;·&nbsp; Max Stake: {fmt(boost.max_stake)} &nbsp;·&nbsp; Evento: {fmtDate(boost.data_evento)}
        </div>

        {!rows ? (
          <div
            style={{ ...S.uploadZone, borderColor: dragging ? "var(--acc)" : "var(--line-2)" }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById("xlsxInput").click()}
          >
            <input id="xlsxInput" type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={onInput} />
            <div style={{ color: "var(--acc)", marginBottom: 12 }}><IconUpload /></div>
            <div style={S.uploadTitle}>Solte o arquivo xlsx aqui</div>
            <div style={S.uploadSub}>ou clique para selecionar — relatório do Altenar</div>
          </div>
        ) : (
          <>
            <div style={{ ...S.uploadZone, padding: "16px 20px", textAlign: "left", marginBottom: 24, cursor: "default", background: "var(--surface-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)", textTransform: "uppercase", letterSpacing: 0.6 }}>
                  Mercados encontrados no arquivo ({marketOptions.length})
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={{ ...S.btnSecondary, padding: "6px 14px", fontSize: 11 }}
                    onClick={() => setSelectedMarkets(new Set(marketOptions.map((m) => m.value)))}
                  >
                    Selecionar todos
                  </button>
                  <button
                    style={{ ...S.btnDelete, padding: "6px 14px", fontSize: 11 }}
                    onClick={() => setSelectedMarkets(new Set())}
                  >
                    Limpar seleção
                  </button>
                </div>
              </div>

              <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 10 }}>
                Marque os mercados que devem entrar no cálculo do relatório (ex: apenas "Vencedor do encontro" / "1x2") e desmarque o restante (ex: apostas combinadas / Bet Builder com condições extras).
              </div>

              <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 6 }}>
                {marketOptions.map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--t2)",
                      cursor: "pointer", padding: "7px 10px", borderRadius: 8,
                      background: selectedMarkets?.has(opt.value) ? "var(--acc-soft)" : "var(--surface)",
                      border: `1px solid ${selectedMarkets?.has(opt.value) ? "var(--acc-line)" : "var(--line)"}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMarkets?.has(opt.value) || false}
                      onChange={() => toggleMarket(opt.value)}
                    />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={opt.value}>
                      {opt.value}
                    </span>
                    <span style={{ color: "var(--t3)", fontSize: 11, flexShrink: 0 }}>{opt.count} apostas</span>
                  </label>
                ))}
              </div>

              <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 12 }}>
                {selectedMarkets ? (
                  removedByMarket > 0
                    ? `${selectedMarkets.size} de ${marketOptions.length} mercados selecionados — ${removedByMarket} de ${rows.length} apostas foram ignoradas, restaram ${marketFiltered.length} para o cálculo.`
                    : `${selectedMarkets.size} de ${marketOptions.length} mercados selecionados — todas as ${rows.length} apostas entram no cálculo.`
                ) : "Carregando mercados..."}
              </div>
            </div>

            <div style={S.statsGrid} className="stats-grid">
              {[
                { label: "Total Stakes", value: fmt(stats.totalStake), sub: `${stats.qtdApostas} apostas válidas de ${stats.totalApostasGeral}`, color: "var(--t1)" },
                { label: "GGR", value: fmt(stats.ggr), sub: "Stake − Winnings", color: stats.ggr >= 0 ? "var(--up)" : "var(--down)" },
                { label: "Usuários", value: stats.idsUnicos, sub: `únicos no total · ${stats.idsUnicosValidas} em apostas válidas`, color: "var(--info)" },
                { label: "Ticket Médio", value: fmt(stats.ticketMedio), sub: "por aposta", color: "var(--warn)" },
                { label: "Wins", value: stats.wins, sub: `${stats.qtdApostas > 0 ? ((stats.wins / stats.qtdApostas) * 100).toFixed(1) : 0}% do total`, color: "var(--up)" },
                { label: "Lost", value: stats.lost, sub: `${stats.qtdApostas > 0 ? ((stats.lost / stats.qtdApostas) * 100).toFixed(1) : 0}% do total`, color: "var(--down)" },
                { label: "Cashout", value: stats.cashout, sub: "apostas encerradas", color: "var(--warn)" },
              ].map((s) => (
                <div key={s.label} style={S.statCard}>
                  <div style={S.statCardTop}>
                    <div style={S.statLabel}>{s.label}</div>
                    <div style={S.statIconWrap(s.color)}><IconChart /></div>
                  </div>
                  <div style={{ ...S.statValue, color: s.color }}>{s.value}</div>
                  <div style={S.statSub}>{s.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                style={{ ...S.btnSaveReport, opacity: savingReport ? 0.6 : 1 }}
                onClick={saveReport}
                disabled={savingReport || savedReport}
              >
                <IconSave /> {savedReport ? "Relatório Salvo ✓" : savingReport ? "Salvando..." : "Salvar Relatório"}
              </button>
              <button
                style={{ ...S.btnSecondary, display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", fontSize: 13.5, marginBottom: 20 }}
                onClick={() => downloadIds(stats.idsProcessados, boost)}
                disabled={!stats.idsProcessados.length}
                title="Baixa em .csv a lista de IDs de jogadores que entraram no cálculo deste relatório"
              >
                <IconDownload /> Baixar Ids ({stats.idsProcessados.length})
              </button>
            </div>

            <div style={S.tableWrap} className="table-wrap">
              <div style={S.tableHeader}>
                Apostas ({stats.valid.length}){stats.valid.length > tableLimit ? ` — exibindo ${Math.min(tableLimit, stats.valid.length)}` : ""}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      {["Player", "Stake", "Winnings", "GGR", "Status", "Data Aposta"].map((h) => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.valid.slice(0, tableLimit).map((r, i) => {
                      const stake = parseFloat(r["Stake"]) || 0;
                      const win = parseFloat(r["Winnings"]) || 0;
                      const rowGgr = stake - win;
                      const player = r["Player"] || r["External User Id"] || "-";
                      return (
                        <tr key={i}>
                          <td style={{ ...S.td, fontFamily: "var(--mono)", fontSize: 11.5 }}>{player}</td>
                          <td style={S.td}>{fmt(stake)}</td>
                          <td style={S.td}>{fmt(win)}</td>
                          <td style={{ ...S.td, color: rowGgr >= 0 ? "var(--up)" : "var(--down)", fontWeight: 600 }}>{fmt(rowGgr)}</td>
                          <td style={S.td}>
                            <span style={{ color: statusColor(r["Status"]), fontWeight: 600 }}>{r["Status"] || "-"}</span>
                          </td>
                          <td style={{ ...S.td, color: "var(--t3)" }}>{r["Bet date"] || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {stats.valid.length > tableLimit && (
                <div style={{ padding: "14px 20px", textAlign: "center", borderTop: "1px solid var(--line)" }}>
                  <button
                    style={{ ...S.btnSecondary, padding: "8px 18px", fontSize: 12 }}
                    onClick={() => setTableLimit((n) => n + 100)}
                  >
                    Carregar mais ({stats.valid.length - tableLimit} restantes)
                  </button>
                </div>
              )}
            </div>

            <button
              style={{ ...S.btnReport, marginTop: 20, width: "auto", padding: "10px 20px" }}
              onClick={() => { setRows(null); setSavedReport(false); setTableLimit(100); }}
            >
              Carregar outro arquivo
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── IDS REPETIDOS ───────────────────────────────────────────────────────────
// Cruza os IDs de jogadores guardados em cada relatório salvo e aponta quais
// IDs aparecem em mais de um relatório (possível indício de reaproveitamento
// da mesma conta em diferentes Welcome Boosts).
function RepeatedIdsPage({ onBack }) {
  const [reports, setReports] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api(
          "GET",
          "boost_relatorios?select=id,boost_id,player_ids,created_at,welcome_boosts(confronto,data_evento)&order=created_at.desc"
        );
        if (!cancelled) setReports(data || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) setReports([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const hasIdData = reports ? reports.some((r) => Array.isArray(r.player_ids) && r.player_ids.length > 0) : false;

  // Agrupa ocorrências por ID de jogador e filtra os que aparecem em mais de um relatório
  const repeated = useMemo(() => {
    if (!reports) return null;
    const byId = new Map();
    for (const r of reports) {
      const ids = Array.isArray(r.player_ids) ? r.player_ids : [];
      for (const pid of ids) {
        if (pid === undefined || pid === null || pid === "") continue;
        if (!byId.has(pid)) byId.set(pid, []);
        byId.get(pid).push({
          reportId: r.id,
          confronto: r.welcome_boosts?.confronto || "-",
          data_evento: r.welcome_boosts?.data_evento,
          created_at: r.created_at,
        });
      }
    }
    const result = [];
    for (const [pid, occurrences] of byId.entries()) {
      if (occurrences.length > 1) result.push({ id: pid, occurrences });
    }
    result.sort((a, b) => b.occurrences.length - a.occurrences.length);
    return result;
  }, [reports]);

  const downloadRepeated = () => {
    if (!repeated || repeated.length === 0) return;
    const lines = ["ID;Quantidade de relatorios;Confrontos"];
    for (const item of repeated) {
      const confrontos = item.occurrences.map((o) => o.confronto).join(" | ");
      lines.push(`${item.id};${item.occurrences.length};"${confrontos}"`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ids_repetidos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={S.reportPage}>
      <div style={S.reportHeader} className="report-header">
        <button style={S.btnBack} onClick={onBack}>
          <IconArrow left /> Voltar
        </button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>IDs Repetidos</div>
          <div style={{ fontSize: 11, color: "var(--t3)" }}>Jogadores que aparecem em mais de um relatório salvo</div>
        </div>
      </div>

      <div style={S.reportContent} className="report-content">
        <div style={S.reportTitle} className="report-title">IDs Repetidos</div>
        <div style={S.reportSub}>Cruzamento dos IDs de jogadores entre todos os relatórios salvos no Supabase</div>

        {reports === null ? (
          <div style={{ textAlign: "center", padding: 80, color: "var(--t3)", fontSize: 14 }}>Carregando...</div>
        ) : !hasIdData ? (
          <div style={S.empty}>
            <div style={S.emptyTitle}>Nenhum dado de IDs disponível ainda</div>
            <div style={{ fontSize: 13, color: "var(--t3)", maxWidth: 460, margin: "0 auto" }}>
              Relatórios salvos antes desta atualização não guardam a lista de IDs processados.
              Gere e salve novos relatórios a partir de agora para que eles entrem nesse cruzamento.
            </div>
          </div>
        ) : repeated === null || repeated.length === 0 ? (
          <div style={S.empty}>
            <div style={S.emptyTitle}>Nenhum ID repetido encontrado</div>
            <div style={{ fontSize: 13, color: "var(--t3)" }}>Nenhum jogador aparece em mais de um relatório salvo até o momento</div>
          </div>
        ) : (
          <div style={S.tableWrap} className="table-wrap">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
              <div style={S.tableHeader}>IDs repetidos ({repeated.length})</div>
              <button style={{ ...S.btnSecondary, padding: "8px 16px", fontSize: 12 }} onClick={downloadRepeated}>
                <IconDownload /> Baixar lista (CSV)
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {["ID do Jogador", "Aparece em", "Relatórios (Confronto)"].map((h) => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {repeated.map((item) => (
                    <tr key={item.id}>
                      <td style={{ ...S.td, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--t1)" }}>{item.id}</td>
                      <td style={S.td}>{item.occurrences.length} relatórios</td>
                      <td style={{ ...S.td, color: "var(--t2)" }}>
                        {item.occurrences.map((o, i) => (
                          <span key={i} style={{ display: "inline-block", marginRight: 10 }}>
                            {o.confronto}{i < item.occurrences.length - 1 ? " ·" : ""}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── RELATÓRIOS GERAIS (DASHBOARD) ───────────────────────────────────────────
function DashboardPage({ onBack }) {
  const [reports, setReports] = useState(null);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api(
          "GET",
          "boost_relatorios?select=*,welcome_boosts(confronto,data_evento,mercado)&order=created_at.desc"
        );
        if (!cancelled) setReports(data || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) setReports([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Considera apenas o relatório mais recente de cada boost (reports vem ordenado
  // por created_at desc), para ficar consistente com o que é exibido nos cards —
  // evita somar em duplicidade quando uma mesma boost teve o relatório salvo mais de uma vez.
  const latestByBoost = {};
  for (const r of reports || []) {
    if (!latestByBoost[r.boost_id]) latestByBoost[r.boost_id] = r;
  }
  const uniqueReports = Object.values(latestByBoost);

  const filtered = uniqueReports.filter((r) => {
    const ev = r.welcome_boosts?.data_evento ? new Date(r.welcome_boosts.data_evento) : null;
    if (periodFrom && (!ev || ev < new Date(periodFrom))) return false;
    if (periodTo && (!ev || ev > new Date(periodTo + "T23:59:59"))) return false;
    return true;
  });

  const totals = filtered.reduce(
    (acc, r) => {
      acc.totalStake += Number(r.total_stake) || 0;
      acc.ggr += Number(r.ggr) || 0;
      acc.idsUnicos += Number(r.ids_unicos) || 0;
      acc.qtdApostas += Number(r.qtd_apostas) || 0;
      acc.wins += Number(r.wins) || 0;
      acc.lost += Number(r.lost) || 0;
      acc.cashout += Number(r.cashout) || 0;
      return acc;
    },
    { totalStake: 0, ggr: 0, idsUnicos: 0, qtdApostas: 0, wins: 0, lost: 0, cashout: 0 }
  );
  const ticketMedio = totals.qtdApostas > 0 ? totals.totalStake / totals.qtdApostas : 0;
  const maxAbsGgr = Math.max(1, ...filtered.map((r) => Math.abs(Number(r.ggr) || 0)));

  return (
    <div style={S.reportPage}>
      <div style={S.reportHeader} className="report-header">
        <button style={S.btnBack} onClick={onBack}>
          <IconArrow left /> Voltar
        </button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Relatórios Gerais</div>
          <div style={{ fontSize: 11, color: "var(--t3)" }}>Dashboard interativo de resultados</div>
        </div>
      </div>

      <div style={S.reportContent} className="report-content">
        <div style={S.reportTitle} className="report-title">Relatórios Gerais</div>
        <div style={S.reportSub}>Visão consolidada de todos os relatórios salvos — filtre pelo período do evento</div>

        <div style={S.filterBar}>
          <div style={{ fontSize: 12, color: "var(--t3)", marginRight: 4 }}>Período do evento:</div>
          <input type="date" style={S.input} value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
          <span style={{ color: "var(--t3)", fontSize: 13 }}>até</span>
          <input type="date" style={S.input} value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
          {(periodFrom || periodTo) && (
            <button
              style={{ ...S.btnDelete, padding: "8px 14px", fontSize: 12 }}
              onClick={() => { setPeriodFrom(""); setPeriodTo(""); }}
            >
              Limpar
            </button>
          )}
        </div>

        {reports === null ? (
          <div style={{ textAlign: "center", padding: 80, color: "var(--t3)", fontSize: 14 }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={S.empty}>
            <div style={S.emptyTitle}>Nenhum relatório no período</div>
            <div style={{ fontSize: 13, color: "var(--t3)" }}>Ajuste o filtro ou salve novos relatórios a partir de uma boost</div>
          </div>
        ) : (
          <>
            <div style={S.statsGrid} className="stats-grid">
              {[
                { label: "Relatórios", value: filtered.length, sub: "no período selecionado", color: "var(--t1)" },
                { label: "Total Stakes", value: fmt(totals.totalStake), sub: `${totals.qtdApostas} apostas`, color: "var(--t1)" },
                { label: "GGR", value: fmt(totals.ggr), sub: "Stake − Winnings", color: totals.ggr >= 0 ? "var(--up)" : "var(--down)" },
                { label: "Usuários", value: totals.idsUnicos, sub: "soma de usuários únicos", color: "var(--info)" },
                { label: "Ticket Médio", value: fmt(ticketMedio), sub: "médio geral", color: "var(--warn)" },
                { label: "Wins", value: totals.wins, sub: "apostas ganhas", color: "var(--up)" },
                { label: "Lost", value: totals.lost, sub: "apostas perdidas", color: "var(--down)" },
                { label: "Cashout", value: totals.cashout, sub: "apostas encerradas", color: "var(--warn)" },
              ].map((s) => (
                <div key={s.label} style={S.statCard}>
                  <div style={S.statCardTop}>
                    <div style={S.statLabel}>{s.label}</div>
                    <div style={S.statIconWrap(s.color)}><IconChart /></div>
                  </div>
                  <div style={{ ...S.statValue, color: s.color }}>{s.value}</div>
                  <div style={S.statSub}>{s.sub}</div>
                </div>
              ))}
            </div>

            <div style={S.tableWrap} className="table-wrap">
              <div style={S.tableHeader}>GGR por Confronto ({filtered.length})</div>
              <div style={{ padding: "20px" }}>
                {filtered.map((r) => {
                  const ggr = Number(r.ggr) || 0;
                  const pct = Math.min(100, (Math.abs(ggr) / maxAbsGgr) * 100);
                  return (
                    <div key={r.id} style={S.barRow}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
                        <span style={{ color: "var(--t1)", fontWeight: 600 }}>
                          {r.welcome_boosts?.confronto || "-"}
                          {r.welcome_boosts?.data_evento && (
                            <span style={{ color: "var(--t3)", fontWeight: 400, marginLeft: 8 }}>{fmtDate(r.welcome_boosts.data_evento)}</span>
                          )}
                        </span>
                        <span style={{ color: ggr >= 0 ? "var(--up)" : "var(--down)", fontWeight: 700 }}>{fmt(ggr)}</span>
                      </div>
                      <div style={S.barTrack}>
                        <div
                          style={{
                            height: "100%", borderRadius: 6, width: `${pct}%`,
                            background: ggr >= 0 ? "var(--up)" : "var(--down)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── CARD ─────────────────────────────────────────────────────────────────────
function BoostCard({ boost, report, onReport, onDelete }) {
  const status = computeStatus(boost);
  const cfg = statusConfig[status] || statusConfig.ativo;
  const boost_pct = boost.odd_antiga > 0
    ? (((boost.odd_nova - boost.odd_antiga) / (boost.odd_antiga - 1)) * 100).toFixed(0)
    : 0;
  const [teamA, teamB] = splitConfronto(boost.confronto);
  const colorA = colorFor(teamA || "A");
  const colorB = colorFor((teamB || "B") + "·");

  return (
    <div style={S.card}>
      <div style={S.cardAccent(cfg.color)} />
      <div style={S.cardHeader} className="card-header">
        <div style={S.matchup} className="matchup">
          <div style={S.avatar(colorA)} className="avatar-circle">{initials(teamA)}</div>
          <div style={S.matchupCenter}>
            <div style={S.confronto} className="confronto">
              {teamA}{teamB && <> <span style={S.confrontoVs}>vs</span> {teamB}</>}
            </div>
            <div style={S.idJogo}>ID {boost.id_jogo}</div>
          </div>
          {teamB && <div style={S.avatar(colorB)} className="avatar-circle">{initials(teamB)}</div>}
        </div>
        <span style={S.badge(cfg.color, cfg.bg)}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: cfg.color, display: "inline-block" }} />
          {cfg.label}
        </span>
      </div>

      {boost.mercado && (
        <div style={S.marketBox}>
          <div style={S.marketBoxIcon}><IconTag /></div>
          <div>
            <div style={S.marketBoxLabel}>Mercado</div>
            <div style={S.marketBoxValue}>{boost.mercado}</div>
          </div>
        </div>
      )}

      <div style={S.oddRow}>
        <span style={S.oddOld}>{boost.odd_antiga}</span>
        <span style={S.oddArrow}>→</span>
        <span style={S.oddNew}>{boost.odd_nova}</span>
        <span style={{ ...S.badge("var(--up)", "var(--up-soft)"), marginLeft: 2 }}>+{boost_pct}%</span>
        <span style={S.maxStake}>Max <span className="num" style={{ fontWeight: 800, color: "var(--t1)" }}>{fmt(boost.max_stake)}</span></span>
      </div>

      {report && (
        <div style={S.reportBox}>
          <div style={S.reportBoxTitle}><IconChart /> Resultado do Relatório</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 16 }} className="result-stats-grid">
            <div style={S.resultStat}>
              <div style={S.statIconWrap("var(--up)")}><IconChart /></div>
              <div>
                <div style={S.resultStatLabel}>GGR</div>
                <div style={{ ...S.resultStatValue, color: report.ggr >= 0 ? "var(--up)" : "var(--down)" }}>{fmt(report.ggr)}</div>
              </div>
              <div style={S.resultStatBar(report.ggr >= 0 ? "var(--up)" : "var(--down)")} />
            </div>
            <div style={S.resultStat}>
              <div style={S.statIconWrap("var(--info)")}><IconCoin /></div>
              <div>
                <div style={S.resultStatLabel}>Total Stakes</div>
                <div style={S.resultStatValue}>{fmt(report.total_stake)}</div>
              </div>
              <div style={S.resultStatBar("var(--info)")} />
            </div>
            <div style={S.resultStat}>
              <div style={S.statIconWrap("var(--info)")}><IconUser /></div>
              <div>
                <div style={S.resultStatLabel}>Usuários</div>
                <div style={S.resultStatValue}>{report.ids_unicos}</div>
              </div>
              <div style={S.resultStatBar("var(--info)")} />
            </div>
          </div>

          <div style={{ height: 1, background: "var(--line)", margin: "16px 0" }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 16 }} className="result-stats-grid">
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={S.statIconWrap("var(--warn)")}><IconTicket /></div>
              <div>
                <div style={S.resultStatLabel}>Ticket Médio</div>
                <div style={{ ...S.resultStatValue, fontSize: 14 }}>{fmt(report.ticket_medio)}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={S.statIconWrap("var(--up)")}><IconTrophy /></div>
              <div>
                <div style={S.resultStatLabel}>Wins / Lost</div>
                <div style={{ ...S.resultStatValue, fontSize: 14 }}>{report.wins} / {report.lost}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={S.statIconWrap("var(--down)")}><IconCashout /></div>
              <div>
                <div style={S.resultStatLabel}>Cashout</div>
                <div style={{ ...S.resultStatValue, fontSize: 14 }}>{report.cashout}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={S.metaRow} className="meta-row">
        <div style={S.metaRowItem}>
          <span style={S.metaRowIconWrap}><IconCalendar /></span>
          <span style={S.metaRowText}>
            <span style={S.metaRowLabel}>Evento</span>
            <span style={S.metaRowValue}>{fmtDate(boost.data_evento)}</span>
          </span>
        </div>
        <div style={S.metaRowItem}>
          <span style={S.metaRowIconWrap}><IconClock /></span>
          <span style={S.metaRowText}>
            <span style={S.metaRowLabel}>Criado</span>
            <span style={S.metaRowValue}>{fmtDate(boost.created_at)}</span>
          </span>
        </div>
        {boost.feito_em && (
          <div style={S.metaRowItem}>
            <span style={S.metaRowIconWrap}><IconClock /></span>
            <span style={S.metaRowText}>
              <span style={S.metaRowLabel}>Feito em</span>
              <span style={S.metaRowValue}>{fmtDate(boost.feito_em)}</span>
            </span>
          </div>
        )}
        <div style={S.metaRowItem}>
          <span style={S.metaRowIconWrap}><IconUser /></span>
          <span style={S.metaRowText}>
            <span style={S.metaRowLabel}>Feito por</span>
            <span style={{ ...S.metaRowValue, color: "var(--warn)" }}>{boost.feito_por}</span>
          </span>
        </div>
        <div style={S.metaRowItem}>
          <span style={S.metaRowIconWrap}><IconUser /></span>
          <span style={S.metaRowText}>
            <span style={S.metaRowLabel}>Pedido por</span>
            <span style={S.metaRowValue}>{boost.pedido_por}</span>
          </span>
        </div>
      </div>

      <div style={S.cardActions}>
        <button style={S.btnReport} onClick={() => onReport(boost)}>
          <span style={S.btnReportLeft}><IconChart /> Ver relatório completo</span>
          <IconChevronRight />
        </button>
        {Array.isArray(report?.player_ids) && report.player_ids.length > 0 && (
          <button
            style={{ ...S.btnSecondary, display: "flex", alignItems: "center", gap: 7, padding: "12px 16px", fontSize: 13.5 }}
            onClick={() => downloadIds(report.player_ids, boost)}
            title="Baixa em .csv os IDs (coluna Player) processados no relatório salvo desta boost"
          >
            <IconDownload /> Baixar Ids
          </button>
        )}
        <button style={S.btnDelete} onClick={() => onDelete(boost.id)} title="Excluir">
          <IconTrash />
        </button>
      </div>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [boosts, setBoosts] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [reportBoost, setReportBoost] = useState(null);
  const [showRepeatedIds, setShowRepeatedIds] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [tab, setTab] = useState("todos");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("GET", "welcome_boosts?order=data_evento.desc");
      setBoosts(data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  const loadReports = useCallback(async () => {
    try {
      const data = await api("GET", "boost_relatorios?order=created_at.desc");
      setReports(data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { load(); loadReports(); }, [load, loadReports]);

  // último relatório salvo de cada boost (reports já vem ordenado por created_at desc)
  const latestReportByBoost = {};
  for (const r of reports) {
    if (!latestReportByBoost[r.boost_id]) latestReportByBoost[r.boost_id] = r;
  }

  const save = async (form) => {
    setSaving(true);
    try {
      await api("POST", "welcome_boosts", form);
      setShowForm(false);
      await load();
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    }
    setSaving(false);
  };

  const saveReport = async (report) => {
    await api("POST", "boost_relatorios", report);
    await loadReports();
  };

  const remove = async (id) => {
    if (!confirm("Excluir este boost?")) return;
    try {
      // remove relatórios vinculados primeiro (evita erro de chave estrangeira)
      await api("DELETE", `boost_relatorios?boost_id=eq.${id}`);
      await api("DELETE", `welcome_boosts?id=eq.${id}`);
      await load();
      await loadReports();
    } catch (err) {
      alert("Não foi possível excluir esta boost: " + err.message);
    }
  };

  const filtered = boosts.filter((b) => {
    const status = computeStatus(b);
    if (tab !== "todos" && status !== tab) return false;
    const evDate = new Date(b.data_evento);
    if (filterFrom && evDate < new Date(filterFrom)) return false;
    if (filterTo && evDate > new Date(filterTo + "T23:59:59")) return false;
    return true;
  });

  const counts = {
    todos: boosts.length,
    ativo: boosts.filter((b) => computeStatus(b) === "ativo").length,
    encerrado: boosts.filter((b) => computeStatus(b) === "encerrado").length,
  };

  if (reportBoost) {
    return <ReportPage boost={reportBoost} onBack={() => setReportBoost(null)} onSaveReport={saveReport} />;
  }

  if (showRepeatedIds) {
    return <RepeatedIdsPage onBack={() => setShowRepeatedIds(false)} />;
  }

  if (showDashboard) {
    return <DashboardPage onBack={() => setShowDashboard(false)} />;
  }

  return (
    <>
      <div style={S.app}>
        <div style={S.shell} className="app-shell">
          <aside style={S.sidebar} className="app-sidebar">
            <div style={S.sidebarLogo}>
              <div style={S.logoMark}>W</div>
              <div>
                <div style={S.logoText}>Welcome Boost</div>
                <div style={S.logoSub}>Esportivabet · Manager</div>
              </div>
            </div>

            <button style={S.btnPrimary} className="btn-primary" onClick={() => setShowForm(true)}>
              <IconPlus /> Nova Boost
            </button>

            <div style={S.sidebarNavLabel}>Navegação</div>
            <button style={S.sidebarNavItem(true)}>
              <IconHistory /> Welcome Boosts
            </button>
            <button style={S.sidebarNavItem(false)} onClick={() => setShowDashboard(true)}>
              <IconChart /> Relatórios Gerais
            </button>
            <button style={S.sidebarNavItem(false)} onClick={() => setShowRepeatedIds(true)}>
              <IconUser /> Ids Repetidos
            </button>
          </aside>

          <div style={S.contentArea} className="app-content">
            <div style={S.pageTitle}>Welcome Boosts</div>
            <div style={S.pageSub}>{counts.todos} cadastradas · {counts.ativo} ativas agora</div>

            <div style={S.tabs} className="app-tabs">
              {[
                { key: "todos", label: `Todos (${counts.todos})` },
                { key: "ativo", label: `Ativos (${counts.ativo})` },
                { key: "encerrado", label: `Encerrados (${counts.encerrado})` },
              ].map((t) => (
                <button key={t.key} style={S.tab(tab === t.key)} onClick={() => setTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={S.filterBar} className="filter-bar">
            <div style={{ fontSize: 12, color: "var(--t3)", marginRight: 4 }}>Filtrar por evento:</div>
            <input
              type="date" style={S.input}
              value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
            />
            <span style={{ color: "var(--t3)", fontSize: 13 }}>até</span>
            <input
              type="date" style={S.input}
              value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
            />
            {(filterFrom || filterTo) && (
              <button
                style={{ ...S.btnDelete, padding: "8px 14px", fontSize: 12 }}
                onClick={() => { setFilterFrom(""); setFilterTo(""); }}
              >
                Limpar
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 80, color: "var(--t3)", fontSize: 14 }}>Carregando...</div>
          ) : filtered.length === 0 ? (
            <div style={S.empty}>
              <div style={S.emptyTitle}>Nenhuma boost encontrada</div>
              <div style={{ fontSize: 13, color: "var(--t3)" }}>Cadastre uma nova ou ajuste os filtros</div>
            </div>
          ) : (
            <div style={S.grid} className="app-grid">
              {filtered.map((b) => (
                <BoostCard key={b.id} boost={b} report={latestReportByBoost[b.id]} onReport={setReportBoost} onDelete={remove} />
              ))}
            </div>
          )}
          </div>
        </div>

        {showForm && (
          <FormModal onClose={() => setShowForm(false)} onSave={save} loading={saving} />
        )}
      </div>
    </>
  );
}
