import { useState, useEffect, useCallback } from "react";
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
  ativo: { label: "Ativo", color: "#00E5A0", bg: "rgba(0,229,160,0.12)" },
  encerrado: { label: "Encerrado", color: "#888", bg: "rgba(136,136,136,0.1)" },
};

const fmt = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const fmtDate = (d) =>
  new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

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
const IconSave = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </svg>
);

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S = {
  app: {
    minHeight: "100vh",
    background: "#0A0A0F",
    color: "#E8E8EE",
    fontFamily: "'DM Sans', sans-serif",
    position: "relative",
  },
  noise: {
    position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E")`,
    opacity: 0.4,
  },
  glow: {
    position: "fixed", top: -200, left: "50%", transform: "translateX(-50%)",
    width: 800, height: 400, borderRadius: "50%", pointerEvents: "none", zIndex: 0,
    background: "radial-gradient(ellipse, rgba(255,58,0,0.08) 0%, transparent 70%)",
  },
  main: { position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "0 24px 60px" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "32px 0 40px", borderBottom: "1px solid rgba(255,255,255,0.06)",
    marginBottom: 36,
  },
  logo: {
    display: "flex", alignItems: "center", gap: 12,
  },
  logoMark: {
    width: 38, height: 38, borderRadius: 10,
    background: "linear-gradient(135deg, #FF3A00, #FF7A00)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: -1,
  },
  logoText: { fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: "#fff" },
  logoSub: { fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase" },
  btnPrimary: {
    display: "flex", alignItems: "center", gap: 8,
    background: "linear-gradient(135deg, #FF3A00, #FF6A00)",
    color: "#fff", border: "none", borderRadius: 10,
    padding: "10px 20px", fontSize: 14, fontWeight: 600,
    cursor: "pointer", letterSpacing: -0.2, transition: "all 0.2s",
    boxShadow: "0 4px 20px rgba(255,58,0,0.3)",
  },
  tabs: { display: "flex", gap: 4, marginBottom: 32, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4 },
  tab: (active) => ({
    padding: "8px 20px", borderRadius: 9, border: "none", cursor: "pointer",
    fontSize: 13, fontWeight: active ? 600 : 400,
    background: active ? "rgba(255,58,0,0.15)" : "transparent",
    color: active ? "#FF5A20" : "#666",
    transition: "all 0.2s", letterSpacing: -0.1,
  }),
  filterBar: {
    display: "flex", gap: 12, marginBottom: 28, alignItems: "center", flexWrap: "wrap",
  },
  input: {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10, padding: "9px 14px", color: "#E8E8EE", fontSize: 13,
    outline: "none", transition: "border 0.2s",
    fontFamily: "'DM Sans', sans-serif",
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 },
  card: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16, padding: 22, position: "relative", overflow: "hidden",
    transition: "border-color 0.2s, transform 0.2s",
    cursor: "default",
  },
  cardAccent: (color) => ({
    position: "absolute", top: 0, left: 0, right: 0, height: 2,
    background: `linear-gradient(90deg, ${color}, transparent)`,
  }),
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  confronto: { fontSize: 16, fontWeight: 700, letterSpacing: -0.4, color: "#fff", lineHeight: 1.3 },
  idJogo: { fontSize: 11, color: "#444", marginTop: 3, fontFamily: "monospace" },
  badge: (color, bg) => ({
    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
    color, background: bg, border: `1px solid ${color}33`, whiteSpace: "nowrap",
  }),
  cardMeta: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 },
  metaItem: { display: "flex", flexDirection: "column", gap: 2 },
  metaLabel: { fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: 0.8 },
  metaValue: { fontSize: 13, fontWeight: 600, color: "#ccc" },
  oddRow: {
    display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
    padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10,
  },
  oddOld: { fontSize: 13, color: "#555", textDecoration: "line-through" },
  oddArrow: { fontSize: 12, color: "#FF5A20" },
  oddNew: { fontSize: 16, fontWeight: 800, color: "#00E5A0" },
  maxStake: { fontSize: 12, marginLeft: "auto", color: "#FF9500", fontWeight: 600 },
  cardActions: { display: "flex", gap: 8, marginTop: 4 },
  btnReport: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    background: "rgba(255,90,32,0.1)", border: "1px solid rgba(255,90,32,0.2)",
    color: "#FF5A20", borderRadius: 9, padding: "8px 12px", fontSize: 12,
    fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
    fontFamily: "'DM Sans', sans-serif",
  },
  btnDelete: {
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.15)",
    color: "#FF3B30", borderRadius: 9, padding: "8px 12px", fontSize: 12,
    fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
    fontFamily: "'DM Sans', sans-serif",
  },
  empty: {
    textAlign: "center", padding: "80px 20px", color: "#333",
  },
  emptyTitle: { fontSize: 18, fontWeight: 600, color: "#444", marginBottom: 8 },
  // MODAL
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    backdropFilter: "blur(4px)",
  },
  modal: {
    background: "#13131A", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20, width: "100%", maxWidth: 540, maxHeight: "90vh",
    overflowY: "auto", position: "relative",
  },
  modalHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "24px 28px 0",
  },
  modalTitle: { fontSize: 18, fontWeight: 700, letterSpacing: -0.4 },
  modalBody: { padding: "24px 28px 28px" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  formGroup: { display: "flex", flexDirection: "column", gap: 6 },
  formGroupFull: { display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" },
  label: { fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 },
  select: {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10, padding: "9px 14px", color: "#E8E8EE", fontSize: 13,
    outline: "none", fontFamily: "'DM Sans', sans-serif",
    appearance: "none",
  },
  btnSubmit: {
    width: "100%", padding: "13px", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #FF3A00, #FF6A00)",
    color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
    marginTop: 8, letterSpacing: -0.3,
    boxShadow: "0 4px 20px rgba(255,58,0,0.3)",
    fontFamily: "'DM Sans', sans-serif",
  },
  // RELATÓRIO
  reportPage: {
    position: "fixed", inset: 0, background: "#0A0A0F", zIndex: 200,
    overflowY: "auto",
  },
  reportHeader: {
    background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)",
    padding: "20px 32px", display: "flex", alignItems: "center", gap: 16,
  },
  btnBack: {
    display: "flex", alignItems: "center", gap: 6,
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#ccc", borderRadius: 9, padding: "8px 14px", fontSize: 13,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  reportContent: { maxWidth: 900, margin: "0 auto", padding: "40px 24px" },
  reportTitle: { fontSize: 28, fontWeight: 800, letterSpacing: -0.8, marginBottom: 4 },
  reportSub: { fontSize: 14, color: "#444", marginBottom: 36 },
  uploadZone: {
    border: "2px dashed rgba(255,90,32,0.3)", borderRadius: 16,
    padding: "48px 32px", textAlign: "center", cursor: "pointer",
    transition: "all 0.2s", marginBottom: 36,
    background: "rgba(255,90,32,0.03)",
  },
  uploadTitle: { fontSize: 16, fontWeight: 600, color: "#ccc", marginBottom: 6 },
  uploadSub: { fontSize: 13, color: "#444" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 32 },
  statCard: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14, padding: "20px 18px",
  },
  statLabel: { fontSize: 11, color: "#444", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  statValue: { fontSize: 26, fontWeight: 800, letterSpacing: -1 },
  statSub: { fontSize: 11, color: "#555", marginTop: 4 },
  tableWrap: {
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14, overflow: "hidden",
  },
  tableHeader: { padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 600 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: { padding: "10px 16px", textAlign: "left", color: "#444", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, borderBottom: "1px solid rgba(255,255,255,0.04)" },
  td: { padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)", color: "#bbb" },
  btnSecondary: {
    display: "flex", alignItems: "center", gap: 8,
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#ccc", borderRadius: 10, padding: "10px 20px", fontSize: 14,
    fontWeight: 600, cursor: "pointer", letterSpacing: -0.2,
    fontFamily: "'DM Sans', sans-serif",
  },
  reportBox: {
    marginTop: 14, padding: "12px 14px", borderRadius: 10,
    background: "rgba(0,229,160,0.04)", border: "1px solid rgba(0,229,160,0.15)",
  },
  reportBoxTitle: {
    fontSize: 10, color: "#00E5A0", textTransform: "uppercase",
    letterSpacing: 0.8, fontWeight: 700, marginBottom: 10,
    display: "flex", alignItems: "center", gap: 6,
  },
  reportBoxGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 },
  reportBoxItem: { display: "flex", flexDirection: "column", gap: 2 },
  reportBoxLabel: { fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: 0.6 },
  reportBoxValue: { fontSize: 13, fontWeight: 700, color: "#ccc" },
  barRow: { marginBottom: 14 },
  barTrack: { height: 8, borderRadius: 6, background: "rgba(255,255,255,0.05)", overflow: "hidden" },
  btnSaveReport: {
    display: "flex", alignItems: "center", gap: 8,
    background: "linear-gradient(135deg, #FF3A00, #FF6A00)",
    color: "#fff", border: "none", borderRadius: 10,
    padding: "10px 20px", fontSize: 13, fontWeight: 600,
    cursor: "pointer", letterSpacing: -0.2, marginBottom: 20,
    boxShadow: "0 4px 20px rgba(255,58,0,0.3)",
    fontFamily: "'DM Sans', sans-serif",
  },
};

// ─── FORM MODAL ──────────────────────────────────────────────────────────────
function FormModal({ onClose, onSave, loading }) {
  const [form, setForm] = useState({
    confronto: "", id_jogo: "", feito_por: "Neto", pedido_por: "",
    data_evento: "", odd_antiga: "", odd_nova: "", max_stake: "", mercado: "",
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
    });
  };

  const inputStyle = { ...S.input, width: "100%", boxSizing: "border-box" };

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <span style={S.modalTitle}>Nova Welcome Boost</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}>
            <IconClose />
          </button>
        </div>
        <div style={S.modalBody}>
          <div style={S.formGrid}>
            <div style={S.formGroupFull}>
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
            <div style={S.formGroupFull}>
              <span style={S.label}>Pedido por</span>
              <input style={inputStyle} placeholder="Nome de quem solicitou" value={form.pedido_por} onChange={set("pedido_por")} />
            </div>
            <div style={S.formGroupFull}>
              <span style={S.label}>Data e Hora do Evento</span>
              <input type="datetime-local" style={inputStyle} value={form.data_evento} onChange={set("data_evento")} />
            </div>
            <div style={S.formGroup}>
              <span style={S.label}>Odd Antiga</span>
              <input style={inputStyle} type="number" step="0.01" placeholder="Ex: 1.80" value={form.odd_antiga} onChange={set("odd_antiga")} />
            </div>
            <div style={S.formGroup}>
              <span style={S.label}>Odd Nova (Boost)</span>
              <input style={inputStyle} type="number" step="0.01" placeholder="Ex: 2.00" value={form.odd_nova} onChange={set("odd_nova")} />
            </div>
            <div style={S.formGroupFull}>
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

  const processFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
      setRows(data);
    };
    reader.readAsArrayBuffer(file);
  };

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

  // Métricas
  const stats = rows
    ? (() => {
        const valid = rows.filter((r) => {
          const status = (r["Status"] || "").toLowerCase();
          return status !== "voidcashout";
        });
        const totalStake = valid.reduce((s, r) => s + (parseFloat(r["Stake"]) || 0), 0);
        const totalWin = valid.reduce((s, r) => s + (parseFloat(r["Winnings"]) || 0), 0);
        const ggr = totalStake - totalWin;
        const qtdApostas = valid.length;
        const ids = new Set(valid.map((r) => r["Player"] || r["Player Id"] || r["External User Id"]));
        const ticketMedio = qtdApostas > 0 ? totalStake / qtdApostas : 0;
        const wins = valid.filter((r) => (r["Status"] || "").toLowerCase() === "win").length;
        const lost = valid.filter((r) => (r["Status"] || "").toLowerCase() === "lost").length;
        const cashout = valid.filter((r) => (r["Status"] || "").toLowerCase() === "cashout").length;
        return { totalStake, ggr, qtdApostas, idsUnicos: ids.size, ticketMedio, wins, lost, cashout, valid };
      })()
    : null;

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
      });
      setSavedReport(true);
    } catch (e) {
      alert("Erro ao salvar relatório: " + e.message);
    }
    setSavingReport(false);
  };

  const statusColor = (s) => {
    const sl = (s || "").toLowerCase();
    if (sl === "win") return "#00E5A0";
    if (sl === "lost") return "#FF5A20";
    if (sl === "cashout") return "#FF9500";
    return "#555";
  };

  return (
    <div style={S.reportPage}>
      <div style={S.reportHeader}>
        <button style={S.btnBack} onClick={onBack}>
          <IconArrow left /> Voltar
        </button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{boost.confronto}</div>
          <div style={{ fontSize: 11, color: "#444", fontFamily: "monospace" }}>ID {boost.id_jogo}</div>
        </div>
      </div>

      <div style={S.reportContent}>
        <div style={S.reportTitle}>Relatório de Resultado</div>
        <div style={S.reportSub}>
          Odd: {boost.odd_antiga} → {boost.odd_nova} &nbsp;·&nbsp; Max Stake: {fmt(boost.max_stake)} &nbsp;·&nbsp; Evento: {fmtDate(boost.data_evento)}
        </div>

        {!rows ? (
          <div
            style={{ ...S.uploadZone, borderColor: dragging ? "#FF5A20" : "rgba(255,90,32,0.3)" }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById("xlsxInput").click()}
          >
            <input id="xlsxInput" type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={onInput} />
            <div style={{ color: "#FF5A20", marginBottom: 12 }}><IconUpload /></div>
            <div style={S.uploadTitle}>Solte o arquivo xlsx aqui</div>
            <div style={S.uploadSub}>ou clique para selecionar — relatório do Altenar</div>
          </div>
        ) : (
          <>
            <div style={S.statsGrid}>
              {[
                { label: "Total Stakes", value: fmt(stats.totalStake), sub: `${stats.qtdApostas} apostas`, color: "#E8E8EE" },
                { label: "GGR", value: fmt(stats.ggr), sub: "Stake − Winnings", color: stats.ggr >= 0 ? "#00E5A0" : "#FF5A20" },
                { label: "IDs Únicos", value: stats.idsUnicos, sub: "jogadores distintos", color: "#A78BFA" },
                { label: "Ticket Médio", value: fmt(stats.ticketMedio), sub: "por aposta", color: "#FF9500" },
                { label: "Wins", value: stats.wins, sub: `${stats.qtdApostas > 0 ? ((stats.wins / stats.qtdApostas) * 100).toFixed(1) : 0}% do total`, color: "#00E5A0" },
                { label: "Lost", value: stats.lost, sub: `${stats.qtdApostas > 0 ? ((stats.lost / stats.qtdApostas) * 100).toFixed(1) : 0}% do total`, color: "#FF5A20" },
                { label: "Cashout", value: stats.cashout, sub: "apostas encerradas", color: "#FF9500" },
              ].map((s) => (
                <div key={s.label} style={S.statCard}>
                  <div style={S.statLabel}>{s.label}</div>
                  <div style={{ ...S.statValue, color: s.color }}>{s.value}</div>
                  <div style={S.statSub}>{s.sub}</div>
                </div>
              ))}
            </div>

            <button
              style={{ ...S.btnSaveReport, opacity: savingReport ? 0.6 : 1 }}
              onClick={saveReport}
              disabled={savingReport || savedReport}
            >
              <IconSave /> {savedReport ? "Relatório Salvo ✓" : savingReport ? "Salvando..." : "Salvar Relatório"}
            </button>

            <div style={S.tableWrap}>
              <div style={S.tableHeader}>Apostas ({stats.valid.length})</div>
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
                    {stats.valid.map((r, i) => {
                      const stake = parseFloat(r["Stake"]) || 0;
                      const win = parseFloat(r["Winnings"]) || 0;
                      const rowGgr = stake - win;
                      const player = r["Player"] || r["External User Id"] || "-";
                      return (
                        <tr key={i}>
                          <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11 }}>{player}</td>
                          <td style={S.td}>{fmt(stake)}</td>
                          <td style={S.td}>{fmt(win)}</td>
                          <td style={{ ...S.td, color: rowGgr >= 0 ? "#00E5A0" : "#FF5A20", fontWeight: 600 }}>{fmt(rowGgr)}</td>
                          <td style={S.td}>
                            <span style={{ color: statusColor(r["Status"]), fontWeight: 600 }}>{r["Status"] || "-"}</span>
                          </td>
                          <td style={{ ...S.td, color: "#555" }}>{r["Bet date"] || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              style={{ ...S.btnReport, marginTop: 20, width: "auto", padding: "10px 20px" }}
              onClick={() => { setRows(null); setSavedReport(false); }}
            >
              Carregar outro arquivo
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── HISTÓRICO DE RELATÓRIOS ─────────────────────────────────────────────────
function HistoryPage({ onBack }) {
  const [reports, setReports] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api(
          "GET",
          "boost_relatorios?select=*,welcome_boosts(confronto,data_evento)&order=created_at.desc"
        );
        if (!cancelled) setReports(data || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) setReports([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={S.reportPage}>
      <div style={S.reportHeader}>
        <button style={S.btnBack} onClick={onBack}>
          <IconArrow left /> Voltar
        </button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Histórico de Relatórios</div>
          <div style={{ fontSize: 11, color: "#444" }}>Relatórios salvos das Welcome Boosts</div>
        </div>
      </div>

      <div style={S.reportContent}>
        <div style={S.reportTitle}>Histórico de Relatórios</div>
        <div style={S.reportSub}>Relatórios de resultado salvos no Supabase</div>

        {reports === null ? (
          <div style={{ textAlign: "center", padding: 80, color: "#333", fontSize: 14 }}>Carregando...</div>
        ) : reports.length === 0 ? (
          <div style={S.empty}>
            <div style={S.emptyTitle}>Nenhum relatório salvo</div>
            <div style={{ fontSize: 13, color: "#333" }}>Salve um relatório a partir da tela de uma Welcome Boost</div>
          </div>
        ) : (
          <div style={S.tableWrap}>
            <div style={S.tableHeader}>Relatórios ({reports.length})</div>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {["Confronto", "Data do Evento", "GGR", "Total Stakes", "IDs Únicos", "Salvo em"].map((h) => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td style={{ ...S.td, color: "#fff", fontWeight: 600 }}>{r.welcome_boosts?.confronto || "-"}</td>
                      <td style={S.td}>{r.welcome_boosts?.data_evento ? fmtDate(r.welcome_boosts.data_evento) : "-"}</td>
                      <td style={{ ...S.td, color: r.ggr >= 0 ? "#00E5A0" : "#FF5A20", fontWeight: 600 }}>{fmt(r.ggr)}</td>
                      <td style={S.td}>{fmt(r.total_stake)}</td>
                      <td style={S.td}>{r.ids_unicos}</td>
                      <td style={{ ...S.td, color: "#555" }}>{fmtDate(r.created_at)}</td>
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

  const filtered = (reports || []).filter((r) => {
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
      <div style={S.reportHeader}>
        <button style={S.btnBack} onClick={onBack}>
          <IconArrow left /> Voltar
        </button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Relatórios Gerais</div>
          <div style={{ fontSize: 11, color: "#444" }}>Dashboard interativo de resultados</div>
        </div>
      </div>

      <div style={S.reportContent}>
        <div style={S.reportTitle}>Relatórios Gerais</div>
        <div style={S.reportSub}>Visão consolidada de todos os relatórios salvos — filtre pelo período do evento</div>

        <div style={S.filterBar}>
          <div style={{ fontSize: 12, color: "#555", marginRight: 4 }}>Período do evento:</div>
          <input type="date" style={S.input} value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
          <span style={{ color: "#444", fontSize: 13 }}>até</span>
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
          <div style={{ textAlign: "center", padding: 80, color: "#333", fontSize: 14 }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={S.empty}>
            <div style={S.emptyTitle}>Nenhum relatório no período</div>
            <div style={{ fontSize: 13, color: "#333" }}>Ajuste o filtro ou salve novos relatórios a partir de uma boost</div>
          </div>
        ) : (
          <>
            <div style={S.statsGrid}>
              {[
                { label: "Relatórios", value: filtered.length, sub: "no período selecionado", color: "#E8E8EE" },
                { label: "Total Stakes", value: fmt(totals.totalStake), sub: `${totals.qtdApostas} apostas`, color: "#E8E8EE" },
                { label: "GGR", value: fmt(totals.ggr), sub: "Stake − Winnings", color: totals.ggr >= 0 ? "#00E5A0" : "#FF5A20" },
                { label: "IDs Únicos", value: totals.idsUnicos, sub: "soma dos relatórios", color: "#A78BFA" },
                { label: "Ticket Médio", value: fmt(ticketMedio), sub: "médio geral", color: "#FF9500" },
                { label: "Wins", value: totals.wins, sub: "apostas ganhas", color: "#00E5A0" },
                { label: "Lost", value: totals.lost, sub: "apostas perdidas", color: "#FF5A20" },
                { label: "Cashout", value: totals.cashout, sub: "apostas encerradas", color: "#FF9500" },
              ].map((s) => (
                <div key={s.label} style={S.statCard}>
                  <div style={S.statLabel}>{s.label}</div>
                  <div style={{ ...S.statValue, color: s.color }}>{s.value}</div>
                  <div style={S.statSub}>{s.sub}</div>
                </div>
              ))}
            </div>

            <div style={S.tableWrap}>
              <div style={S.tableHeader}>GGR por Confronto ({filtered.length})</div>
              <div style={{ padding: "20px" }}>
                {filtered.map((r) => {
                  const ggr = Number(r.ggr) || 0;
                  const pct = Math.min(100, (Math.abs(ggr) / maxAbsGgr) * 100);
                  return (
                    <div key={r.id} style={S.barRow}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
                        <span style={{ color: "#ccc", fontWeight: 600 }}>
                          {r.welcome_boosts?.confronto || "-"}
                          {r.welcome_boosts?.data_evento && (
                            <span style={{ color: "#444", fontWeight: 400, marginLeft: 8 }}>{fmtDate(r.welcome_boosts.data_evento)}</span>
                          )}
                        </span>
                        <span style={{ color: ggr >= 0 ? "#00E5A0" : "#FF5A20", fontWeight: 700 }}>{fmt(ggr)}</span>
                      </div>
                      <div style={S.barTrack}>
                        <div
                          style={{
                            height: "100%", borderRadius: 6, width: `${pct}%`,
                            background: ggr >= 0
                              ? "linear-gradient(90deg, #00E5A0, #00B583)"
                              : "linear-gradient(90deg, #FF5A20, #FF3A00)",
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

  return (
    <div style={S.card}>
      <div style={S.cardAccent(cfg.color)} />
      <div style={S.cardHeader}>
        <div>
          <div style={S.confronto}>{boost.confronto}</div>
          <div style={S.idJogo}>ID {boost.id_jogo}</div>
        </div>
        <span style={S.badge(cfg.color, cfg.bg)}>{cfg.label}</span>
      </div>

      <div style={S.oddRow}>
        <span style={S.oddOld}>{boost.odd_antiga}</span>
        <span style={S.oddArrow}>→</span>
        <span style={S.oddNew}>{boost.odd_nova}</span>
        <span style={{ ...S.oddArrow, fontSize: 11, color: "#00E5A0", marginLeft: 4 }}>+{boost_pct}%</span>
        <span style={S.maxStake}>Max {fmt(boost.max_stake)}</span>
      </div>

      <div style={S.cardMeta}>
        <div style={S.metaItem}>
          <span style={S.metaLabel}>Evento</span>
          <span style={S.metaValue}>{fmtDate(boost.data_evento)}</span>
        </div>
        <div style={S.metaItem}>
          <span style={S.metaLabel}>Criado em</span>
          <span style={S.metaValue}>{fmtDate(boost.created_at)}</span>
        </div>
        <div style={S.metaItem}>
          <span style={S.metaLabel}>Feito por</span>
          <span style={{ ...S.metaValue, color: "#FF9500" }}>{boost.feito_por}</span>
        </div>
        <div style={S.metaItem}>
          <span style={S.metaLabel}>Pedido por</span>
          <span style={S.metaValue}>{boost.pedido_por}</span>
        </div>
        {boost.mercado && (
          <div style={S.metaItem}>
            <span style={S.metaLabel}>Mercado</span>
            <span style={S.metaValue}>{boost.mercado}</span>
          </div>
        )}
      </div>

      {report && (
        <div style={S.reportBox}>
          <div style={S.reportBoxTitle}><IconChart /> Resultado do Relatório</div>
          <div style={S.reportBoxGrid}>
            <div style={S.reportBoxItem}>
              <span style={S.reportBoxLabel}>GGR</span>
              <span style={{ ...S.reportBoxValue, color: report.ggr >= 0 ? "#00E5A0" : "#FF5A20" }}>{fmt(report.ggr)}</span>
            </div>
            <div style={S.reportBoxItem}>
              <span style={S.reportBoxLabel}>Total Stakes</span>
              <span style={S.reportBoxValue}>{fmt(report.total_stake)}</span>
            </div>
            <div style={S.reportBoxItem}>
              <span style={S.reportBoxLabel}>IDs Únicos</span>
              <span style={S.reportBoxValue}>{report.ids_unicos}</span>
            </div>
            <div style={S.reportBoxItem}>
              <span style={S.reportBoxLabel}>Ticket Médio</span>
              <span style={S.reportBoxValue}>{fmt(report.ticket_medio)}</span>
            </div>
            <div style={S.reportBoxItem}>
              <span style={S.reportBoxLabel}>Wins / Lost</span>
              <span style={S.reportBoxValue}>{report.wins} / {report.lost}</span>
            </div>
            <div style={S.reportBoxItem}>
              <span style={S.reportBoxLabel}>Cashout</span>
              <span style={S.reportBoxValue}>{report.cashout}</span>
            </div>
          </div>
        </div>
      )}

      <div style={S.cardActions}>
        <button style={S.btnReport} onClick={() => onReport(boost)}>
          <IconChart /> Ver Relatório
        </button>
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
  const [showHistory, setShowHistory] = useState(false);
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
    await api("DELETE", `welcome_boosts?id=eq.${id}`);
    await load();
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

  if (showHistory) {
    return <HistoryPage onBack={() => setShowHistory(false)} />;
  }

  if (showDashboard) {
    return <DashboardPage onBack={() => setShowDashboard(false)} />;
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={S.app}>
        <div style={S.noise} />
        <div style={S.glow} />
        <div style={S.main}>
          <div style={S.header}>
            <div style={S.logo}>
              <div style={S.logoMark}>W</div>
              <div>
                <div style={S.logoText}>Welcome Boost</div>
                <div style={S.logoSub}>Esportivabet · Manager</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button style={S.btnSecondary} onClick={() => setShowDashboard(true)}>
                <IconChart /> Relatórios Gerais
              </button>
              <button style={S.btnSecondary} onClick={() => setShowHistory(true)}>
                <IconHistory /> Histórico de Relatórios
              </button>
              <button style={S.btnPrimary} onClick={() => setShowForm(true)}>
                <IconPlus /> Nova Boost
              </button>
            </div>
          </div>

          <div style={S.tabs}>
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

          <div style={S.filterBar}>
            <div style={{ fontSize: 12, color: "#555", marginRight: 4 }}>Filtrar por evento:</div>
            <input
              type="date" style={S.input}
              value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
            />
            <span style={{ color: "#444", fontSize: 13 }}>até</span>
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
            <div style={{ textAlign: "center", padding: 80, color: "#333", fontSize: 14 }}>Carregando...</div>
          ) : filtered.length === 0 ? (
            <div style={S.empty}>
              <div style={S.emptyTitle}>Nenhuma boost encontrada</div>
              <div style={{ fontSize: 13, color: "#333" }}>Cadastre uma nova ou ajuste os filtros</div>
            </div>
          ) : (
            <div style={S.grid}>
              {filtered.map((b) => (
                <BoostCard key={b.id} boost={b} report={latestReportByBoost[b.id]} onReport={setReportBoost} onDelete={remove} />
              ))}
            </div>
          )}
        </div>

        {showForm && (
          <FormModal onClose={() => setShowForm(false)} onSave={save} loading={saving} />
        )}
      </div>
    </>
  );
}
