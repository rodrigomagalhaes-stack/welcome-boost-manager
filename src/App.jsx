import { useState, useEffect, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";

const SUPABASE_URL = "https://lfuhmhubafgjqzuueyzw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmdWhtaHViYWZnanF6dXVleXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MjE2NjQsImV4cCI6MjA5NjM5NzY2NH0.99TD4fo6FiOWE61onuY6UHpBurZC6qUZEE55ZrATJ8U";

const api = async (method, path, body, extraHeaders = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "",
      ...extraHeaders,
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

// Mantém apenas o relatório mais recente de cada boost (assume `reports` ordenado por created_at desc).
// Usado em todas as telas para evitar somar/duplicar quando uma boost teve relatório salvo mais de uma vez.
const dedupLatestByBoost = (reports) => {
  const latest = {};
  for (const r of reports || []) {
    const k = r.boost_id ?? r.id;
    if (!latest[k]) latest[k] = r;
  }
  return Object.values(latest);
};

// Busca todos os relatórios (com dados da boost) já deduplicados pelo mais recente de cada boost.
// Compartilhado por "Relatórios Gerais" e "Ids Repetidos" para garantir que ambos somem
// exatamente o mesmo conjunto de dados.
const fetchLatestReports = () =>
  api("GET", "boost_relatorios?select=*,welcome_boosts(confronto,data_evento,mercado)&order=created_at.desc")
    .then(dedupLatestByBoost);

// Filtra relatórios pela data do evento (welcome_boosts.data_evento). Compartilhado entre
// "Relatórios Gerais" e "Ids Repetidos" para que os dois usem o mesmo critério de período.
const filterReportsByEventDate = (reports, from, to) => {
  const fromD = from ? new Date(from + "T00:00:00") : null;
  const toD = to ? new Date(to + "T23:59:59") : null;
  return (reports || []).filter((r) => {
    const ds = r.welcome_boosts?.data_evento;
    if (!ds) return !from && !to;
    const d = new Date(ds);
    if (fromD && d < fromD) return false;
    if (toD && d > toD) return false;
    return true;
  });
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

// Converte uma data ISO (UTC) para o valor que um <input type="datetime-local"> espera
// (YYYY-MM-DDTHH:mm em horário LOCAL). Usado para pré-preencher o formulário ao editar.
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

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
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
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
function FormModal({ onClose, onSave, loading, initial }) {
  const isEdit = !!initial;
  const [form, setForm] = useState(() => initial ? {
    confronto: initial.confronto || "",
    id_jogo: initial.id_jogo || "",
    feito_por: initial.feito_por || "Neto",
    pedido_por: initial.pedido_por || "",
    data_evento: toLocalInput(initial.data_evento),
    data_welcome: toLocalInput(initial.data_welcome),
    odd_antiga: initial.odd_antiga != null ? String(initial.odd_antiga) : "",
    odd_nova: initial.odd_nova != null ? String(initial.odd_nova) : "",
    max_stake: initial.max_stake != null ? String(initial.max_stake) : "",
    mercado: initial.mercado || "",
    feito_em: toLocalInput(initial.feito_em),
  } : {
    confronto: "", id_jogo: "", feito_por: "Neto", pedido_por: "",
    data_evento: "", data_welcome: "", odd_antiga: "", odd_nova: "", max_stake: "", mercado: "",
    feito_em: "",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.confronto || !form.id_jogo || !form.data_evento || !form.data_welcome || !form.odd_antiga || !form.odd_nova || !form.max_stake || !form.pedido_por) {
      alert("Preencha todos os campos.");
      return;
    }
    await onSave({
      ...form,
      odd_antiga: parseFloat(form.odd_antiga),
      odd_nova: parseFloat(form.odd_nova),
      max_stake: parseFloat(form.max_stake),
      data_evento: new Date(form.data_evento).toISOString(),
      data_welcome: new Date(form.data_welcome).toISOString(),
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
              <span style={S.label}>Data e Hora da Welcome</span>
              <input type="datetime-local" style={inputStyle} value={form.data_welcome} onChange={set("data_welcome")} />
              <span style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>A partir de quando novos cadastros conseguem pegar a promoção (data do outro sistema).</span>
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

// ─── IDS REPETIDOS — DASHBOARD ───────────────────────────────────────────────
// Cruza os jogadores entre os Welcome Boosts cadastrados e mostra, por faixa de
// repetição, quantos IDs pegaram N welcomes e o prejuízo (GGR) que geraram.
// Filtrável pela data do evento (welcome_boosts.data_evento).
const fmtR = (v) => {
  if (v === undefined || v === null || isNaN(v)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
};
const fmtRk = (v) => {
  if (!v || isNaN(v)) return "0";
  const a = Math.abs(v);
  if (a >= 1000) return (v / 1000).toFixed(1).replace(".", ",") + "k";
  return Math.round(v).toString();
};

// Recebe os relatórios já filtrados por período e devolve toda a análise cruzada.
function computeIdsAnalysis(reports) {
  const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
  // Arredonda cada valor a centavos garantindo que a soma bata EXATAMENTE com o total
  // (distribui o resíduo de arredondamento pelas maiores frações). Evita divergência
  // de centavos entre a soma das linhas e o total exibido.
  const roundToSum = (vals, target) => {
    const cents = vals.map((v) => Math.round(v * 100));
    const targetCents = Math.round(target * 100);
    let diff = targetCents - cents.reduce((a, c) => a + c, 0);
    if (diff !== 0 && vals.length > 0) {
      const order = vals.map((v, i) => ({ i, frac: v * 100 - Math.floor(v * 100) }));
      if (diff > 0) order.sort((a, b) => b.frac - a.frac);
      else order.sort((a, b) => a.frac - b.frac);
      const step = diff > 0 ? 1 : -1;
      for (let k = 0; k < Math.abs(diff); k++) cents[order[k % order.length].i] += step;
    }
    return cents.map((c) => c / 100);
  };
  const boosts = new Map();
  for (const r of reports) {
    const confronto = r.welcome_boosts?.confronto || "Sem nome";
    const mercado = r.welcome_boosts?.mercado || "";
    const label = mercado ? `${confronto} · ${mercado}` : confronto;
    const key = r.boost_id ?? r.id;
    if (!boosts.has(key)) boosts.set(key, {
      label, confronto, mercado, ids: new Set(), shared: new Set(),
      stake: 0, ggr: 0,
      welcomeDate: r.welcome_boosts?.data_evento ?? null,
      data_evento: r.welcome_boosts?.data_evento ?? null,
    });
    const b = boosts.get(key);
    for (const pid of (r.player_ids ?? [])) { if (pid) b.ids.add(pid); }
    b.stake += r.total_stake ?? 0;
    b.ggr += r.ggr ?? 0;
  }
  for (const [, b] of boosts) {
    b.avgStake = b.ids.size > 0 ? b.stake / b.ids.size : 0;
    b.avgGGR = b.ids.size > 0 ? b.ggr / b.ids.size : 0;
  }

  const crossRef = new Map();
  for (const [k, b] of boosts)
    for (const pid of b.ids) { if (!crossRef.has(pid)) crossRef.set(pid, new Set()); crossRef.get(pid).add(k); }
  for (const [pid, ks] of crossRef)
    if (ks.size > 1) for (const k of ks) boosts.get(k)?.shared.add(pid);

  let totalStake = 0, totalGGR = 0;
  for (const [, b] of boosts) { totalStake += b.stake; totalGGR += b.ggr; }

  const stats = [];
  for (const [, b] of boosts) {
    const total = b.ids.size, shared = b.shared.size;
    stats.push({
      label: b.label, confronto: b.confronto, mercado: b.mercado,
      welcomeDate: b.welcomeDate,
      total_ids: total, shared_ids: shared,
      pct_shared: total > 0 ? Math.round((shared / total) * 100) : 0,
      total_stake: b.stake, total_ggr: b.ggr, avg_stake: b.avgStake,
    });
  }
  stats.sort((a, b) => (b.welcomeDate || "").localeCompare(a.welcomeDate || ""));

  // pares de boosts
  const pairCount = new Map();
  for (const [, ks] of crossRef) {
    if (ks.size < 2) continue;
    const arr = [...ks];
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++) {
        const pk = [arr[i], arr[j]].sort().join("|||");
        pairCount.set(pk, (pairCount.get(pk) || 0) + 1);
      }
  }
  const pairwise = [];
  for (const [pk, shared] of pairCount) {
    const [a, b] = pk.split("|||");
    const bA = boosts.get(a), bB = boosts.get(b);
    if (!bA || !bB) continue;
    const affinity = Math.round((shared / Math.min(bA.ids.size, bB.ids.size)) * 100);
    const sharedStake = shared * (bA.avgStake + bB.avgStake) / 2;
    pairwise.push({
      a: bA.label, b: bB.label, shared, affinity, shared_stake: sharedStake,
      total_a: bA.ids.size, total_b: bB.ids.size,
      pct_a: bA.ids.size ? Math.round((shared / bA.ids.size) * 100) : 0,
      pct_b: bB.ids.size ? Math.round((shared / bB.ids.size) * 100) : 0,
    });
  }
  pairwise.sort((x, y) => y.shared_stake - x.shared_stake);

  // ── combinações EXATAS de welcomes ──────────────────────────────────────────
  // Assinatura = o conjunto exato de boosts que o jogador pegou. É o nível mais
  // granular do "Comparativo de Repetição": detalha cada faixa combinação por combinação.
  const comboMap = new Map();
  for (const [pid, ks] of crossRef) {
    const arr = [...ks].sort();
    const key = arr.join("|||");
    if (!comboMap.has(key)) comboMap.set(key, { boostKeys: arr, count: 0, ids: [] });
    const c = comboMap.get(key);
    c.count++;
    if (c.ids.length < 20000) c.ids.push(pid);
  }
  const rawCombos = [...comboMap.values()].map((c) => {
    const avgStakeSum = c.boostKeys.reduce((s, k) => s + (boosts.get(k)?.avgStake ?? 0), 0);
    const avgGGRSum = c.boostKeys.reduce((s, k) => s + (boosts.get(k)?.avgGGR ?? 0), 0);
    return {
      freq: c.boostKeys.length,
      labels: c.boostKeys.map((k) => boosts.get(k)?.label ?? k),
      confrontos: c.boostKeys.map((k) => boosts.get(k)?.confronto ?? k),
      count: c.count, _stake: c.count * avgStakeSum, _ggr: c.count * avgGGRSum, ids: c.ids,
    };
  });

  const totalStakeR = round2(totalStake), totalGGRR = round2(totalGGR);
  // Arredonda no nível mais granular (combinação) preservando soma exata = totais reais.
  // Assim: combinações somam às faixas, e faixas somam aos totais — tudo bate ao centavo.
  const comboStakeAdj = roundToSum(rawCombos.map((c) => c._stake), totalStakeR);
  const comboGGRAdj = roundToSum(rawCombos.map((c) => c._ggr), totalGGRR);
  const combos = rawCombos.map((c, i) => ({
    freq: c.freq, labels: c.labels, confrontos: c.confrontos, count: c.count, ids: c.ids,
    stake_est: comboStakeAdj[i], ggr_est: comboGGRAdj[i],
  })).sort((a, b) => a.freq - b.freq || b.count - a.count);

  // faixas = agregação das combinações por nº de welcomes (consistente por construção)
  const tierAgg = new Map();
  for (const c of combos) {
    if (!tierAgg.has(c.freq)) tierAgg.set(c.freq, { count: 0, stake: 0, ggr: 0 });
    const t = tierAgg.get(c.freq);
    t.count += c.count; t.stake += c.stake_est; t.ggr += c.ggr_est;
  }
  const tiers = [...tierAgg.entries()].map(([freq, t]) => ({
    freq, count: t.count,
    stake_est: round2(t.stake), ggr_est: round2(t.ggr),
    avg_stake: round2(t.count > 0 ? t.stake / t.count : 0),
    ids: combos.filter((c) => c.freq === freq).flatMap((c) => c.ids),
  })).sort((a, b) => a.freq - b.freq);

  const maxFreq = tiers.length ? tiers[tiers.length - 1].freq : 0;
  const totalUnique = crossRef.size;
  const totalRepeated = [...crossRef.values()].filter(s => s.size > 1).length;
  // Participações somadas (Σ por welcome) — mesmo número de "Relatórios Gerais".
  // Identidade: participações = distintos + repetições (entradas extras).
  const totalParticipacoes = tiers.reduce((s, t) => s + t.freq * t.count, 0);
  const extraEntries = totalParticipacoes - totalUnique;

  // "dos repetidos" = soma exata das faixas 2+ (já reconciliadas com os totais).
  const repTiers = tiers.filter(t => t.freq >= 2);
  const stakeRepEst = round2(repTiers.reduce((acc, t) => acc + t.stake_est, 0));
  const ggrRepEst = round2(repTiers.reduce((acc, t) => acc + t.ggr_est, 0));

  return {
    numBoosts: boosts.size, totalUnique, totalRepeated,
    totalParticipacoes, extraEntries,
    totalStake: totalStakeR, totalGGR: totalGGRR,
    stakeRepEst, ggrRepEst,
    stats, pairwise, tiers, combos, maxFreq,
  };
}

function RepeatedIdsPage({ onBack }) {
  const [phase, setPhase] = useState("loading"); // loading | ready | no_data | error
  const [rawReports, setRawReports] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchRaw = useCallback(async () => {
    setPhase("loading");
    try {
      // Mesma busca (já deduplicada pelo relatório mais recente de cada boost) usada em
      // "Relatórios Gerais", para que os dois dashboards somem exatamente os mesmos dados.
      const reports = await fetchLatestReports();
      if (!reports.length) { setRawReports([]); setPhase("no_data"); return; }
      setRawReports(reports);
      setPhase("ready");
    } catch (e) { console.error(e); setPhase("error"); }
  }, []);

  useEffect(() => { fetchRaw(); }, [fetchRaw]);

  // filtro por data do evento
  const filtered = useMemo(() => {
    if (!rawReports) return null;
    return filterReportsByEventDate(rawReports, dateFrom, dateTo);
  }, [rawReports, dateFrom, dateTo]);

  const a = useMemo(() => filtered ? computeIdsAnalysis(filtered) : null, [filtered]);

  // welcomes dentro do período
  const welcomesInRange = useMemo(() => {
    if (!filtered) return [];
    const seen = new Map();
    for (const r of filtered) {
      const key = r.boost_id ?? r.id;
      if (!seen.has(key)) {
        const c = r.welcome_boosts?.confronto || "Sem nome";
        const m = r.welcome_boosts?.mercado || "";
        seen.set(key, { label: m ? `${c} · ${m}` : c, date: r.welcome_boosts?.data_evento });
      }
    }
    return [...seen.values()].sort((x, y) => (y.date || "").localeCompare(x.date || ""));
  }, [filtered]);

  const downloadTierIds = (tier) => {
    if (!tier?.ids?.length) return;
    const lines = ["ID do Jogador", ...tier.ids.map(String)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url; el.download = `ids_${tier.freq}_welcomes.csv`; el.click();
    URL.revokeObjectURL(url);
  };

  const pct = (n, d) => d > 0 ? ((n / d) * 100).toFixed(1) + "%" : "0%";

  // gráfico interativo de sobreposições (pares de welcomes)
  const [pairMetric, setPairMetric] = useState("shared_stake"); // shared_stake | shared | affinity
  const [hoverPair, setHoverPair] = useState(null);
  const metricGet = (key) => key === "shared" ? (p => p.shared) : key === "affinity" ? (p => p.affinity) : (p => p.shared_stake);
  const metricFmt = (key, v) => key === "shared" ? v.toLocaleString("pt-BR") : key === "affinity" ? v + "%" : fmtR(v);
  const sortedPairs = useMemo(() => {
    if (!a?.pairwise) return [];
    const g = metricGet(pairMetric);
    return [...a.pairwise].sort((x, y) => g(y) - g(x));
  }, [a, pairMetric]);
  const maxPairVal = useMemo(() => {
    const g = metricGet(pairMetric);
    return Math.max(1, ...sortedPairs.map(g));
  }, [sortedPairs, pairMetric]);

  // gráfico interativo do "Comparativo de Repetição" detalhado (combinação por combinação)
  const [comboMetric, setComboMetric] = useState("count"); // count | stake_est | ggr_est
  const [comboMinFreq, setComboMinFreq] = useState(2);      // 1 = inclui exclusivos, 2 = só repetidos
  const [hoverCombo, setHoverCombo] = useState(null);
  const comboGet = (key) => key === "stake_est" ? (c => c.stake_est) : key === "ggr_est" ? (c => Math.abs(c.ggr_est)) : (c => c.count);
  const comboFmt = (key, c) => {
    if (key === "stake_est") return fmtR(c.stake_est);
    if (key === "ggr_est") return (c.ggr_est < 0 ? "-" : "") + fmtR(Math.abs(c.ggr_est));
    return c.count.toLocaleString("pt-BR");
  };
  const shownCombos = useMemo(() => {
    if (!a?.combos) return [];
    const g = comboGet(comboMetric);
    return a.combos.filter(c => c.freq >= comboMinFreq).sort((x, y) => g(y) - g(x));
  }, [a, comboMetric, comboMinFreq]);
  const maxComboVal = useMemo(() => {
    const g = comboGet(comboMetric);
    return Math.max(1, ...shownCombos.map(g));
  }, [shownCombos, comboMetric]);
  const downloadComboIds = (c) => {
    if (!c?.ids?.length) return;
    const lines = ["ID do Jogador", ...c.ids.map(String)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url; el.download = `ids_combo_${c.confrontos.join("_").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60)}.csv`; el.click();
    URL.revokeObjectURL(url);
  };

  const sec = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", marginBottom: 24, overflow: "hidden", boxShadow: "var(--shadow)" };
  const secHead = { fontSize: 12, fontWeight: 700, color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "13px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, background: "var(--surface-2)" };

  const repeatedTiers = a ? a.tiers.filter(t => t.freq >= 2).sort((x, y) => y.freq - x.freq) : [];
  const topTier = repeatedTiers.find(t => t.freq === a?.maxFreq && a?.maxFreq > 1);

  const tierLabel = (freq) => {
    if (!a) return `${freq} welcomes`;
    if (freq === 1) return "1 welcome (exclusivos)";
    if (freq === a.numBoosts) return `Todas as ${freq} welcomes`;
    return `${freq} welcomes`;
  };

  return (
    <div style={S.reportPage}>
      <div style={S.reportHeader} className="report-header">
        <button style={S.btnBack} onClick={onBack}><IconArrow left /> Voltar</button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>IDs Repetidos</div>
          <div style={{ fontSize: 11, color: "var(--t3)" }}>Quem pegou várias welcomes e quanto de prejuízo gerou</div>
        </div>
      </div>
      <div style={S.reportContent} className="report-content">

        {/* Filtro por data/hora da welcome */}
        <div style={S.filterBar} className="filter-bar">
          <div style={{ fontSize: 12, color: "var(--t3)", marginRight: 4 }}>Período (data do evento):</div>
          <input type="date" style={S.input} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span style={{ color: "var(--t3)", fontSize: 13 }}>até</span>
          <input type="date" style={S.input} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          {(dateFrom || dateTo) && (
            <button style={{ ...S.btnDelete, padding: "8px 14px", fontSize: 12 }} onClick={() => { setDateFrom(""); setDateTo(""); }}>Limpar</button>
          )}
          <button style={{ ...S.btnSecondary, padding: "8px 14px", fontSize: 12, marginLeft: "auto", display: "flex", alignItems: "center", gap: 7 }} onClick={fetchRaw} disabled={phase === "loading"}>
            <IconChart /> Atualizar dados
          </button>
        </div>

        {phase === "loading" && <div style={{ textAlign: "center", padding: 80, color: "var(--t3)", fontSize: 14 }}>Carregando relatórios...</div>}
        {phase === "error" && <div style={S.empty}><div style={S.emptyTitle}>Erro ao carregar</div><div style={{ fontSize: 13, color: "var(--t3)" }}>Tente "Atualizar dados".</div></div>}
        {phase === "no_data" && <div style={S.empty}><div style={S.emptyTitle}>Nenhum dado disponível</div><div style={{ fontSize: 13, color: "var(--t3)" }}>Gere e salve relatórios para que os IDs sejam cruzados aqui.</div></div>}

        {phase === "ready" && a && a.numBoosts === 0 && (
          <div style={S.empty}><div style={S.emptyTitle}>Nenhuma welcome no período</div><div style={{ fontSize: 13, color: "var(--t3)" }}>Ajuste o filtro de datas acima.</div></div>
        )}

        {phase === "ready" && a && a.numBoosts > 0 && (<>

          {/* welcomes comparadas */}
          <div style={{ marginBottom: 24, padding: "14px 18px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              {a.numBoosts} welcome{a.numBoosts !== 1 ? "s" : ""} comparada{a.numBoosts !== 1 ? "s" : ""} no período
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {welcomesInRange.map((w, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, background: "var(--surface-2)", border: "1px solid var(--line)", fontSize: 11.5, color: "var(--t2)" }}>
                  {w.label}
                  {w.date && <span style={{ color: "var(--t3)", fontSize: 10 }}>· {fmtDate(w.date)}</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Reconciliação com "Relatórios Gerais" */}
          <div style={{ marginBottom: 24, padding: "14px 18px", background: "var(--info-soft)", border: "1px solid var(--info)", borderRadius: "var(--r-md)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>🧮</div>
            <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.5 }}>
              <strong style={{ color: "var(--t1)" }}>{a.totalParticipacoes.toLocaleString("pt-BR")} participações</strong> somando todas as welcomes
              <span style={{ color: "var(--t3)" }}> (é o número de "Relatórios Gerais")</span>
              {" − "}
              <strong style={{ color: "var(--warn)" }}>{a.extraEntries.toLocaleString("pt-BR")} repetições</strong>
              {" = "}
              <strong style={{ color: "var(--info)" }}>{a.totalUnique.toLocaleString("pt-BR")} jogadores distintos</strong>.
              <span style={{ color: "var(--t3)" }}> Um jogador em várias welcomes conta 1× aqui, mas é somado em Relatórios Gerais.</span>
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(186px, 1fr))", gap: 14, marginBottom: 28 }}>
            <div style={S.statCard}>
              <div style={S.statCardTop}><div style={S.statLabel}>Jogadores Distintos</div><div style={S.statIconWrap("var(--info)")}><IconUser /></div></div>
              <div style={{ ...S.statValue, color: "var(--info)" }}>{a.totalUnique.toLocaleString("pt-BR")}</div>
              <div style={S.statSub}>cada um conta 1× · {a.totalParticipacoes.toLocaleString("pt-BR")} participações</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statCardTop}><div style={S.statLabel}>Pegaram 2+ Welcomes</div><div style={S.statIconWrap("var(--warn)")}><IconChart /></div></div>
              <div style={{ ...S.statValue, color: "var(--warn)" }}>{a.totalRepeated.toLocaleString("pt-BR")}</div>
              <div style={S.statSub}>{pct(a.totalRepeated, a.totalUnique)} dos apostadores</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statCardTop}><div style={S.statLabel}>Stake Total</div><div style={S.statIconWrap("var(--t2)")}><IconCoin /></div></div>
              <div style={{ ...S.statValue, color: "var(--t1)", fontSize: 18 }}>{fmtR(a.totalStake)}</div>
              <div style={S.statSub}>~{fmtR(a.stakeRepEst)} dos repetidos</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statCardTop}><div style={S.statLabel}>GGR Total</div><div style={S.statIconWrap(a.totalGGR >= 0 ? "var(--up)" : "var(--down)")}><IconTrophy /></div></div>
              <div style={{ ...S.statValue, fontSize: 18, color: a.totalGGR >= 0 ? "var(--up)" : "var(--down)" }}>{fmtR(a.totalGGR)}</div>
              <div style={S.statSub}>~{fmtR(a.ggrRepEst)} vindo dos repetidos</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statCardTop}><div style={S.statLabel}>Resultado dos Repetidos</div><div style={S.statIconWrap(a.ggrRepEst >= 0 ? "var(--up)" : "var(--down)")}><IconHistory /></div></div>
              <div style={{ ...S.statValue, fontSize: 18, color: a.ggrRepEst >= 0 ? "var(--up)" : "var(--down)" }}>{a.ggrRepEst >= 0 ? fmtR(a.ggrRepEst) : "-" + fmtR(Math.abs(a.ggrRepEst))}</div>
              <div style={S.statSub}>{a.ggrRepEst >= 0 ? "lucro estimado" : "prejuízo estimado"}</div>
            </div>
          </div>

          {/* Destaque: top tier */}
          {topTier && (
            <div style={{ marginBottom: 24, padding: "20px 22px", borderRadius: "var(--r-lg)", border: `1px solid ${topTier.ggr_est < 0 ? "var(--down)" : "var(--up)"}`, background: topTier.ggr_est < 0 ? "var(--down-soft)" : "var(--up-soft)", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
              <div style={{ fontSize: 34, lineHeight: 1 }}>{topTier.ggr_est < 0 ? "⚠️" : "🏆"}</div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--t1)" }}>
                  {topTier.count.toLocaleString("pt-BR")} jogador{topTier.count !== 1 ? "es" : ""} {topTier.count !== 1 ? "pegaram" : "pegou"} {a.maxFreq === a.numBoosts ? `as ${a.maxFreq} welcomes (todas)` : `${a.maxFreq} de ${a.numBoosts} welcomes (o máximo)`} do período
                </div>
                <div style={{ fontSize: 12.5, color: "var(--t2)", marginTop: 3 }}>
                  Stake estimado de {fmtR(topTier.stake_est)} ·{" "}
                  {topTier.ggr_est < 0
                    ? <span style={{ color: "var(--down)", fontWeight: 700 }}>prejuízo estimado de {fmtR(Math.abs(topTier.ggr_est))}</span>
                    : <span style={{ color: "var(--up)", fontWeight: 700 }}>GGR estimado de {fmtR(topTier.ggr_est)}</span>}
                </div>
              </div>
              <button style={{ ...S.btnSecondary, padding: "9px 16px", fontSize: 12, display: "flex", alignItems: "center", gap: 7 }} onClick={() => downloadTierIds(topTier)}>
                <IconDownload /> Baixar {topTier.count} IDs
              </button>
            </div>
          )}

          {/* Comparativo por faixa de repetição */}
          <div style={sec}>
            <div style={secHead}>
              <span>Comparativo de Repetição</span>
              <span style={{ fontSize: 10.5, fontWeight: 400, color: "var(--t3)", textTransform: "none" }}>quantos IDs pegaram N welcomes e o resultado gerado</span>
            </div>
            <div style={{ overflowX: "auto" }} className="table-wrap">
              <table style={S.table}>
                <thead><tr>
                  {["Participação", "Jogadores", "%", "Stake estimado", "Resultado estimado", ""].map(h => <th key={h} style={{ ...S.th, padding: "9px 11px", whiteSpace: "nowrap" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {[...a.tiers].sort((x, y) => y.freq - x.freq).map(t => {
                    const isRep = t.freq >= 2;
                    const isTop = t.freq === a.maxFreq && a.maxFreq > 1;
                    const accent = !isRep ? "var(--t3)" : isTop ? "var(--down)" : t.freq >= 3 ? "var(--warn)" : "var(--info)";
                    const cell = { ...S.td, padding: "9px 11px" };
                    return (
                      <tr key={t.freq} style={{ background: isTop ? "var(--down-soft)" : "transparent" }}>
                        <td style={cell}>
                          <span style={{ fontWeight: isRep ? 700 : 500, color: accent }}>{tierLabel(t.freq)}</span>
                        </td>
                        <td style={{ ...cell, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--t1)", whiteSpace: "nowrap" }}>{t.count.toLocaleString("pt-BR")}</td>
                        <td style={{ ...cell, fontFamily: "var(--mono)", color: "var(--t3)", whiteSpace: "nowrap" }}>{pct(t.count, a.totalUnique)}</td>
                        <td style={{ ...cell, fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>{fmtR(t.stake_est)}</td>
                        <td style={{ ...cell, fontFamily: "var(--mono)", fontWeight: 700, whiteSpace: "nowrap", color: t.ggr_est >= 0 ? "var(--up)" : "var(--down)" }}>
                          {t.ggr_est >= 0 ? fmtR(t.ggr_est) : "-" + fmtR(Math.abs(t.ggr_est))}
                          {t.ggr_est < 0 && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 5, color: "var(--down)" }}>prej.</span>}
                        </td>
                        <td style={cell}>
                          {isRep && t.ids.length > 0 && (
                            <button style={{ ...S.btnSecondary, padding: "5px 10px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => downloadTierIds(t)}>
                              <IconDownload /> IDs
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comparativo Detalhado — combinação por combinação (visualização em barras) */}
          {shownCombos.length > 0 && (
            <div style={sec}>
              <div style={secHead}>
                <span>Comparativo Detalhado — Combinação por Combinação</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => setComboMinFreq(comboMinFreq === 2 ? 1 : 2)}
                    style={{ padding: "6px 12px", fontSize: 11, fontWeight: 700, borderRadius: 8, cursor: "pointer", textTransform: "none", letterSpacing: 0, border: "1px solid var(--line)", background: comboMinFreq === 1 ? "var(--acc)" : "var(--surface)", color: comboMinFreq === 1 ? "#fff" : "var(--t2)" }}>
                    {comboMinFreq === 1 ? "✓ " : ""}Incluir exclusivos
                  </button>
                  <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
                    {[["count", "Jogadores"], ["stake_est", "Stake"], ["ggr_est", "Resultado"]].map(([k, lbl], idx) => (
                      <button key={k} onClick={() => setComboMetric(k)}
                        style={{ padding: "6px 12px", fontSize: 11, fontWeight: 700, border: "none", borderLeft: idx > 0 ? "1px solid var(--line)" : "none", cursor: "pointer", textTransform: "none", letterSpacing: 0, background: comboMetric === k ? "var(--acc)" : "var(--surface)", color: comboMetric === k ? "#fff" : "var(--t2)" }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                {[...new Set(shownCombos.map(c => c.freq))].sort((x, y) => y - x).map((freq) => {
                  const group = shownCombos.filter(c => c.freq === freq);
                  const tier = a.tiers.find(t => t.freq === freq);
                  const groupLabel = freq === 1 ? "Pegaram 1 welcome (exclusivos)" : freq === a.numBoosts ? `Pegaram TODAS as ${freq} welcomes` : `Pegaram ${freq} welcomes`;
                  const tierColor = freq === a.maxFreq && a.maxFreq > 1 ? "var(--down)" : freq >= 3 ? "var(--warn)" : freq === 2 ? "var(--info)" : "var(--t3)";
                  return (
                    <div key={freq}>
                      <div style={{ padding: "10px 20px", background: "var(--surface-2)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: tierColor }}>{groupLabel}</span>
                        <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)" }}>
                          {tier?.count.toLocaleString("pt-BR")} jogadores · {fmtR(tier?.stake_est ?? 0)} · <span style={{ color: (tier?.ggr_est ?? 0) < 0 ? "var(--down)" : "var(--up)" }}>{(tier?.ggr_est ?? 0) < 0 ? "-" : ""}{fmtR(Math.abs(tier?.ggr_est ?? 0))}</span>
                        </span>
                      </div>
                      {group.map((c, gi) => {
                        const val = comboGet(comboMetric)(c);
                        const w = Math.max(2, Math.round((val / maxComboVal) * 100));
                        const key = `${freq}-${c.labels.join("|")}`;
                        const active = hoverCombo === key;
                        const barColor = comboMetric === "ggr_est" ? (c.ggr_est < 0 ? "var(--down)" : "var(--up)") : tierColor;
                        return (
                          <div key={key}
                            onMouseEnter={() => setHoverCombo(key)} onMouseLeave={() => setHoverCombo(null)}
                            onClick={() => setHoverCombo(active ? null : key)}
                            style={{ padding: "11px 20px", cursor: "pointer", background: active ? "var(--surface-2)" : "transparent", borderBottom: "1px solid var(--line)", transition: "background .15s" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14, marginBottom: 7 }}>
                              <div style={{ fontSize: 12.5, color: "var(--t1)", fontWeight: 600, lineHeight: 1.4, wordBreak: "break-word" }}>
                                {c.labels.map((lb, li) => (
                                  <span key={li}>{li > 0 && <span style={{ color: "var(--t3)", margin: "0 7px", fontWeight: 400 }}>+</span>}{lb}</span>
                                ))}
                              </div>
                              <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: barColor, fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}>{comboFmt(comboMetric, c)}</div>
                            </div>
                            <div style={{ background: "var(--surface-2)", borderRadius: 6, height: 18, overflow: "hidden" }}>
                              <div style={{ width: `${w}%`, height: "100%", background: barColor, opacity: active ? 1 : 0.82, borderRadius: 6, transition: "width .35s ease, opacity .15s" }} />
                            </div>
                            {active && (
                              <div style={{ marginTop: 9, display: "flex", gap: "6px 18px", fontSize: 11.5, color: "var(--t3)", flexWrap: "wrap", alignItems: "center" }}>
                                <span><strong style={{ color: "var(--t2)" }}>{c.count.toLocaleString("pt-BR")}</strong> jogadores ({pct(c.count, a.totalUnique)})</span>
                                <span>Stake estimado: <strong style={{ color: "var(--t2)" }}>{fmtR(c.stake_est)}</strong></span>
                                <span>Resultado: <strong style={{ color: c.ggr_est < 0 ? "var(--down)" : "var(--up)" }}>{c.ggr_est < 0 ? "-" : ""}{fmtR(Math.abs(c.ggr_est))}</strong>{c.ggr_est < 0 ? " (prejuízo)" : ""}</span>
                                <button style={{ ...S.btnSecondary, padding: "4px 9px", fontSize: 10.5, display: "inline-flex", alignItems: "center", gap: 5 }} onClick={(e) => { e.stopPropagation(); downloadComboIds(c); }}>
                                  <IconDownload /> Baixar IDs
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: "10px 20px", fontSize: 10.5, color: "var(--t3)" }}>
                {shownCombos.length} combinaç{shownCombos.length !== 1 ? "ões" : "ão"} · cada barra é um grupo que pegou exatamente aquelas welcomes · a soma de cada grupo bate com o "Comparativo de Repetição"
              </div>
            </div>
          )}

          {/* Gráfico interativo de sobreposições */}
          {sortedPairs.length > 0 && (
            <div style={sec}>
              <div style={secHead}>
                <span>Sobreposições entre Welcomes</span>
                <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
                  {[["shared_stake", "Stake"], ["shared", "Jogadores"], ["affinity", "Afinidade"]].map(([k, lbl], idx) => (
                    <button key={k} onClick={() => setPairMetric(k)}
                      style={{ padding: "6px 13px", fontSize: 11, fontWeight: 700, border: "none", borderLeft: idx > 0 ? "1px solid var(--line)" : "none", cursor: "pointer", textTransform: "none", letterSpacing: 0, background: pairMetric === k ? "var(--acc)" : "var(--surface)", color: pairMetric === k ? "#fff" : "var(--t2)" }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ padding: "6px 0" }}>
                {sortedPairs.map((p, i) => {
                  const val = metricGet(pairMetric)(p);
                  const w = Math.max(2, Math.round((val / maxPairVal) * 100));
                  const active = hoverPair === i;
                  const barColor = pairMetric === "shared" ? "var(--warn)" : pairMetric === "affinity" ? "var(--down)" : "var(--info)";
                  return (
                    <div key={i}
                      onMouseEnter={() => setHoverPair(i)}
                      onMouseLeave={() => setHoverPair(null)}
                      onClick={() => setHoverPair(active ? null : i)}
                      style={{ padding: "11px 20px", cursor: "pointer", background: active ? "var(--surface-2)" : "transparent", transition: "background .15s", borderBottom: i < sortedPairs.length - 1 ? "1px solid var(--line)" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14, marginBottom: 7 }}>
                        <div style={{ fontSize: 12.5, color: "var(--t1)", fontWeight: 600, lineHeight: 1.4, wordBreak: "break-word" }}>
                          {p.a}<span style={{ color: "var(--t3)", margin: "0 8px", fontWeight: 400 }}>↔</span>{p.b}
                        </div>
                        <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: barColor, fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}>{metricFmt(pairMetric, val)}</div>
                      </div>
                      <div style={{ background: "var(--surface-2)", borderRadius: 6, height: 20, overflow: "hidden" }}>
                        <div style={{ width: `${w}%`, height: "100%", background: barColor, opacity: active ? 1 : 0.82, borderRadius: 6, transition: "width .35s ease, opacity .15s" }} />
                      </div>
                      {active && (
                        <div style={{ marginTop: 9, display: "flex", gap: "6px 18px", fontSize: 11.5, color: "var(--t3)", flexWrap: "wrap" }}>
                          <span><strong style={{ color: "var(--t2)" }}>{p.shared.toLocaleString("pt-BR")}</strong> jogadores em comum</span>
                          <span><strong style={{ color: "var(--t2)" }}>{p.pct_a}%</strong> da audiência de "{p.a}"</span>
                          <span><strong style={{ color: "var(--t2)" }}>{p.pct_b}%</strong> da audiência de "{p.b}"</span>
                          <span>Stake compartilhado: <strong style={{ color: "var(--t2)" }}>{fmtR(p.shared_stake)}</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: "10px 20px", borderTop: "1px solid var(--line)", fontSize: 10.5, color: "var(--t3)" }}>
                {sortedPairs.length} par{sortedPairs.length !== 1 ? "es" : ""} de welcomes com sobreposição · passe o mouse para detalhes · troque a métrica no topo
              </div>
            </div>
          )}

        </>)}
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
        // Mesma busca (já deduplicada pelo relatório mais recente de cada boost) usada em
        // "Ids Repetidos", para que os dois dashboards somem exatamente os mesmos dados.
        const data = await fetchLatestReports();
        if (!cancelled) setReports(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) setReports([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => filterReportsByEventDate(reports || [], periodFrom, periodTo), [reports, periodFrom, periodTo]);

  const totals = filtered.reduce(
    (acc, r) => {
      acc.totalStake += Number(r.total_stake) || 0;
      acc.ggr += Number(r.ggr) || 0;
      acc.qtdApostas += Number(r.qtd_apostas) || 0;
      acc.wins += Number(r.wins) || 0;
      acc.lost += Number(r.lost) || 0;
      acc.cashout += Number(r.cashout) || 0;
      return acc;
    },
    { totalStake: 0, ggr: 0, qtdApostas: 0, wins: 0, lost: 0, cashout: 0 }
  );
  const ticketMedio = totals.qtdApostas > 0 ? totals.totalStake / totals.qtdApostas : 0;
  const maxAbsGgr = Math.max(1, ...filtered.map((r) => Math.abs(Number(r.ggr) || 0)));
  // Mesma análise cruzada de IDs usada em "Ids Repetidos" — garante que "Participações" e
  // "Jogadores Distintos" aqui batam exatamente com aquela tela.
  const a = useMemo(() => computeIdsAnalysis(filtered), [filtered]);

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

        <div style={S.filterBar} className="filter-bar">
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
                { label: "Participações", value: a.totalParticipacoes.toLocaleString("pt-BR"), sub: "soma por welcome (repete entre welcomes) · ver distintos em Ids Repetidos", color: "var(--info)" },
                { label: "Jogadores Distintos", value: a.totalUnique.toLocaleString("pt-BR"), sub: `${a.totalRepeated.toLocaleString("pt-BR")} pegaram 2+ welcomes · ver Ids Repetidos`, color: "var(--info)" },
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
            <span style={S.metaRowLabel}>Data e hora da welcome</span>
            <span style={S.metaRowValue}>{boost.data_welcome ? fmtDate(boost.data_welcome) : "—"}</span>
          </span>
        </div>
        <div style={S.metaRowItem}>
          <span style={S.metaRowIconWrap}><IconClock /></span>
          <span style={S.metaRowText}>
            <span style={S.metaRowLabel}>Cadastrado em</span>
            <span style={{ ...S.metaRowValue, color: "var(--t3)" }}>{fmtDate(boost.created_at)}</span>
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
      // Já deduplicado pelo relatório mais recente de cada boost — mesma fonte usada
      // em "Relatórios Gerais" e "Ids Repetidos".
      const data = await fetchLatestReports();
      setReports(data);
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
    if (filterFrom && evDate < new Date(filterFrom + "T00:00:00")) return false;
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
