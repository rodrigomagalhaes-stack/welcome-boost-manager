import { useState, useEffect, useCallback } from "react";
import { S } from "./styles";
import { IconPlus, IconChart, IconHistory, IconUser } from "./icons";
import { api, fetchLatestReports } from "./lib/api";
import { computeStatus } from "./lib/format";
import FormModal from "./components/FormModal";
import ReportPage from "./components/ReportPage";
import RepeatedIdsPage from "./components/RepeatedIdsPage";
import DashboardPage from "./components/DashboardPage";
import BoostCard from "./components/BoostCard";

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [boosts, setBoosts] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editBoost, setEditBoost] = useState(null); // boost sendo editado (null = criando)
  const [reportBoost, setReportBoost] = useState(null);
  const [showRepeatedIds, setShowRepeatedIds] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [tab, setTab] = useState("ativo"); // abre direto em "Ativos"
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  // Período compartilhado entre "Relatórios Gerais" e "Ids Repetidos" — a data escolhida
  // em uma tela acompanha o usuário na outra (mesmo filtro = mesmos dados nas duas).
  const [reportPeriod, setReportPeriod] = useState({ from: "", to: "" });
  const onPeriodChange = useCallback((from, to) => setReportPeriod({ from, to }), []);

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

  // último relatório salvo de cada boost (reports já vem deduplicado por fetchLatestReports;
  // mesma chave boost_id ?? id usada em dedupLatestByBoost e computeIdsAnalysis)
  const latestReportByBoost = {};
  for (const r of reports) {
    const k = r.boost_id ?? r.id;
    if (!latestReportByBoost[k]) latestReportByBoost[k] = r;
  }

  const save = async (form) => {
    setSaving(true);
    try {
      if (editBoost) await api("PATCH", `welcome_boosts?id=eq.${editBoost.id}`, form);
      else await api("POST", "welcome_boosts", form);
      setShowForm(false);
      setEditBoost(null);
      await load();
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    }
    setSaving(false);
  };

  const openEdit = (boost) => {
    setEditBoost(boost);
    setShowForm(true);
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
    return <RepeatedIdsPage onBack={() => setShowRepeatedIds(false)} period={reportPeriod} onPeriodChange={onPeriodChange} />;
  }

  if (showDashboard) {
    return <DashboardPage onBack={() => setShowDashboard(false)} period={reportPeriod} onPeriodChange={onPeriodChange} />;
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

            <button style={S.btnPrimary} className="btn-primary" onClick={() => { setEditBoost(null); setShowForm(true); }}>
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
                <BoostCard key={b.id} boost={b} report={latestReportByBoost[b.id]} onReport={setReportBoost} onEdit={openEdit} onDelete={remove} />
              ))}
            </div>
          )}
          </div>
        </div>

        {showForm && (
          <FormModal
            onClose={() => { setShowForm(false); setEditBoost(null); }}
            onSave={save}
            loading={saving}
            initial={editBoost}
          />
        )}
      </div>
    </>
  );
}
