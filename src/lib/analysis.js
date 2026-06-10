// Lógica de cálculo compartilhada por todas as telas (funções puras, sem React).
// Coberta por testes em analysis.test.js — qualquer mudança aqui deve manter os testes verdes.

export const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// Mantém apenas o relatório mais recente de cada boost (assume `reports` ordenado por created_at desc).
// Usado em todas as telas para evitar somar/duplicar quando uma boost teve relatório salvo mais de uma vez.
export const dedupLatestByBoost = (reports) => {
  const latest = {};
  for (const r of reports || []) {
    const k = r.boost_id ?? r.id;
    if (!latest[k]) latest[k] = r;
  }
  return Object.values(latest);
};

// Filtra relatórios pela data do evento (welcome_boosts.data_evento). Compartilhado entre
// "Relatórios Gerais" e "Ids Repetidos" para que os dois usem o mesmo critério de período.
export const filterReportsByEventDate = (reports, from, to) => {
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

// Recebe os relatórios já filtrados por período e devolve toda a análise cruzada.
// Quando TODOS os relatórios do período têm player_stats (stake/GGR por jogador, formato
// { "<id>": [stake, ggr] }), os valores por faixa/combinação são exatos (`exact: true`);
// sem player_stats usa a média por jogador da boost como estimativa, sempre reconciliando
// a soma com os totais reais.
export function computeIdsAnalysis(reports) {
  const boosts = new Map();
  for (const r of reports) {
    const confronto = r.welcome_boosts?.confronto || "Sem nome";
    const mercado = r.welcome_boosts?.mercado || "";
    const label = mercado ? `${confronto} · ${mercado}` : confronto;
    const key = r.boost_id ?? r.id;
    if (!boosts.has(key)) boosts.set(key, {
      label, confronto, mercado, ids: new Set(), shared: new Set(),
      stake: 0, ggr: 0, stats: null,
      welcomeDate: r.welcome_boosts?.data_evento ?? null,
      data_evento: r.welcome_boosts?.data_evento ?? null,
    });
    const b = boosts.get(key);
    for (const pid of (r.player_ids ?? [])) { if (pid) b.ids.add(pid); }
    // Number(...) || 0 — mesma conversão usada nos totais de "Relatórios Gerais"
    b.stake += Number(r.total_stake) || 0;
    b.ggr += Number(r.ggr) || 0;
    if (r.player_stats && typeof r.player_stats === "object") b.stats = r.player_stats;
  }
  for (const [, b] of boosts) {
    b.avgStake = b.ids.size > 0 ? b.stake / b.ids.size : 0;
    b.avgGGR = b.ids.size > 0 ? b.ggr / b.ids.size : 0;
  }

  // Stake/GGR de um jogador em uma boost: exato quando salvo em player_stats,
  // senão a média da boost (estimativa).
  const playerStake = (k, pid) => {
    const b = boosts.get(k);
    const e = b?.stats?.[String(pid)];
    return e ? (Number(e[0]) || 0) : (b?.avgStake ?? 0);
  };
  const playerGGR = (k, pid) => {
    const b = boosts.get(k);
    const e = b?.stats?.[String(pid)];
    return e ? (Number(e[1]) || 0) : (b?.avgGGR ?? 0);
  };
  let exact = boosts.size > 0;
  for (const [, b] of boosts) if (!b.stats) exact = false;

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
    // Soma jogador a jogador quando a lista de ids do grupo está completa (exato se houver
    // player_stats); se o cap de 20k ids cortou a lista, cai para a média da boost.
    let stake = 0, ggr = 0;
    if (c.ids.length === c.count) {
      for (const pid of c.ids)
        for (const k of c.boostKeys) { stake += playerStake(k, pid); ggr += playerGGR(k, pid); }
    } else {
      stake = c.count * c.boostKeys.reduce((s, k) => s + (boosts.get(k)?.avgStake ?? 0), 0);
      ggr = c.count * c.boostKeys.reduce((s, k) => s + (boosts.get(k)?.avgGGR ?? 0), 0);
    }
    return {
      freq: c.boostKeys.length,
      labels: c.boostKeys.map((k) => boosts.get(k)?.label ?? k),
      confrontos: c.boostKeys.map((k) => boosts.get(k)?.confronto ?? k),
      count: c.count, _stake: stake, _ggr: ggr, ids: c.ids,
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
    stakeRepEst, ggrRepEst, exact,
    stats, tiers, combos, maxFreq,
  };
}
