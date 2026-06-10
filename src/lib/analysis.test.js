import { describe, it, expect } from "vitest";
import { dedupLatestByBoost, filterReportsByEventDate, computeIdsAnalysis, round2 } from "./analysis";

// Helper: monta um relatório como vem do Supabase (boost_relatorios + welcome_boosts)
const report = ({ id, boost_id, confronto, mercado = "", data_evento, total_stake, ggr, player_ids, player_stats = undefined }) => ({
  id, boost_id, total_stake, ggr, player_ids, player_stats,
  welcome_boosts: { confronto, mercado, data_evento },
});

describe("dedupLatestByBoost", () => {
  it("mantém apenas o primeiro relatório de cada boost (o mais recente, lista vem ordenada desc)", () => {
    const reports = [
      { id: 10, boost_id: "A", ggr: 100 }, // mais recente da boost A
      { id: 9, boost_id: "B", ggr: 50 },
      { id: 8, boost_id: "A", ggr: 999 }, // antigo — deve ser descartado
    ];
    const out = dedupLatestByBoost(reports);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.boost_id === "A").ggr).toBe(100);
  });

  it("usa o próprio id quando boost_id é nulo", () => {
    const out = dedupLatestByBoost([{ id: 1 }, { id: 2 }, { id: 1 }]);
    expect(out).toHaveLength(2);
  });

  it("lista vazia/nula não quebra", () => {
    expect(dedupLatestByBoost([])).toEqual([]);
    expect(dedupLatestByBoost(null)).toEqual([]);
  });
});

describe("filterReportsByEventDate", () => {
  const reports = [
    report({ id: 1, boost_id: "A", confronto: "A", data_evento: "2026-06-01T15:00:00", total_stake: 0, ggr: 0, player_ids: [] }),
    report({ id: 2, boost_id: "B", confronto: "B", data_evento: "2026-06-10T23:30:00", total_stake: 0, ggr: 0, player_ids: [] }),
    report({ id: 3, boost_id: "C", confronto: "C", data_evento: "2026-07-01T00:00:00", total_stake: 0, ggr: 0, player_ids: [] }),
  ];

  it("inclui os limites do período (00:00 do from até 23:59 do to)", () => {
    const out = filterReportsByEventDate(reports, "2026-06-01", "2026-06-10");
    expect(out.map((r) => r.boost_id)).toEqual(["A", "B"]);
  });

  it("filtra só com from ou só com to", () => {
    expect(filterReportsByEventDate(reports, "2026-06-05", "").map((r) => r.boost_id)).toEqual(["B", "C"]);
    expect(filterReportsByEventDate(reports, "", "2026-06-05").map((r) => r.boost_id)).toEqual(["A"]);
  });

  it("sem filtro devolve tudo", () => {
    expect(filterReportsByEventDate(reports, "", "")).toHaveLength(3);
  });

  it("relatório sem data_evento só entra quando não há filtro", () => {
    const semData = [{ id: 9, boost_id: "X", welcome_boosts: {} }];
    expect(filterReportsByEventDate(semData, "", "")).toHaveLength(1);
    expect(filterReportsByEventDate(semData, "2026-06-01", "")).toHaveLength(0);
  });
});

describe("computeIdsAnalysis — cruzamento básico", () => {
  // Boost A: jogadores 1, 2, 3 · Boost B: jogadores 2, 3, 4, 5
  // → distintos: 5 · repetidos (2+): 2 (jogadores 2 e 3) · participações: 7
  const reports = [
    report({ id: 1, boost_id: "A", confronto: "Brasil vs Egito", data_evento: "2026-06-06T19:00:00", total_stake: 300, ggr: -90, player_ids: [1, 2, 3] }),
    report({ id: 2, boost_id: "B", confronto: "Argentina vs Honduras", data_evento: "2026-06-06T21:00:00", total_stake: 400, ggr: 120, player_ids: [2, 3, 4, 5] }),
  ];
  const a = computeIdsAnalysis(reports);

  it("conta jogadores distintos, repetidos e participações", () => {
    expect(a.numBoosts).toBe(2);
    expect(a.totalUnique).toBe(5);
    expect(a.totalRepeated).toBe(2);
    expect(a.totalParticipacoes).toBe(7);
    // identidade: participações = distintos + repetições extras
    expect(a.extraEntries).toBe(a.totalParticipacoes - a.totalUnique);
  });

  it("soma stake e GGR totais igual a Relatórios Gerais (Number(...) || 0)", () => {
    expect(a.totalStake).toBe(700);
    expect(a.totalGGR).toBe(30);
  });

  it("aceita valores numéricos vindos como string do banco", () => {
    const comString = [
      report({ id: 1, boost_id: "A", confronto: "X", data_evento: "2026-06-06T19:00:00", total_stake: "150.50", ggr: "-10.25", player_ids: [1] }),
    ];
    const r = computeIdsAnalysis(comString);
    expect(r.totalStake).toBe(150.5);
    expect(r.totalGGR).toBe(-10.25);
  });

  it("faixas somam exatamente os totais (reconciliação ao centavo)", () => {
    const stakeSum = round2(a.tiers.reduce((s, t) => s + t.stake_est, 0));
    const ggrSum = round2(a.tiers.reduce((s, t) => s + t.ggr_est, 0));
    expect(stakeSum).toBe(a.totalStake);
    expect(ggrSum).toBe(a.totalGGR);
  });

  it("combinações somam exatamente as faixas", () => {
    for (const t of a.tiers) {
      const combosDoTier = a.combos.filter((c) => c.freq === t.freq);
      expect(round2(combosDoTier.reduce((s, c) => s + c.stake_est, 0))).toBe(t.stake_est);
      expect(round2(combosDoTier.reduce((s, c) => s + c.ggr_est, 0))).toBe(t.ggr_est);
      expect(combosDoTier.reduce((s, c) => s + c.count, 0)).toBe(t.count);
    }
  });

  it("sem player_stats o resultado é estimado (exact = false)", () => {
    expect(a.exact).toBe(false);
  });

  it("ignora ids vazios/nulos no player_ids", () => {
    const comVazios = [
      report({ id: 1, boost_id: "A", confronto: "X", data_evento: "2026-06-06T19:00:00", total_stake: 10, ggr: 0, player_ids: [1, null, "", 2] }),
    ];
    expect(computeIdsAnalysis(comVazios).totalUnique).toBe(2);
  });
});

describe("computeIdsAnalysis — modo exato com player_stats", () => {
  // Jogador 2 pegou as duas welcomes: stake exato 100+40=140, ggr exato -50+10=-40
  const reports = [
    report({
      id: 1, boost_id: "A", confronto: "Brasil vs Egito", data_evento: "2026-06-06T19:00:00",
      total_stake: 300, ggr: -90, player_ids: [1, 2, 3],
      player_stats: { 1: [150, -30], 2: [100, -50], 3: [50, -10] },
    }),
    report({
      id: 2, boost_id: "B", confronto: "Argentina vs Honduras", data_evento: "2026-06-06T21:00:00",
      total_stake: 400, ggr: 120, player_ids: [2, 4],
      player_stats: { 2: [40, 10], 4: [360, 110] },
    }),
  ];
  const a = computeIdsAnalysis(reports);

  it("marca exact = true quando todos os relatórios têm player_stats", () => {
    expect(a.exact).toBe(true);
  });

  it("faixa de 2 welcomes usa o stake/GGR exato do jogador (não a média)", () => {
    const tier2 = a.tiers.find((t) => t.freq === 2);
    expect(tier2.count).toBe(1);
    expect(tier2.stake_est).toBe(140); // 100 (boost A) + 40 (boost B)
    expect(tier2.ggr_est).toBe(-40);   // -50 + 10
  });

  it("faixa de 1 welcome é o restante exato e tudo soma os totais", () => {
    const tier1 = a.tiers.find((t) => t.freq === 1);
    expect(tier1.count).toBe(3); // jogadores 1, 3, 4
    expect(tier1.stake_est).toBe(560); // 150 + 50 + 360
    expect(tier1.ggr_est).toBe(70);    // -30 + -10 + 110
    expect(round2(tier1.stake_est + a.tiers.find((t) => t.freq === 2).stake_est)).toBe(a.totalStake);
  });

  it("stakeRepEst/ggrRepEst refletem exatamente os repetidos", () => {
    expect(a.stakeRepEst).toBe(140);
    expect(a.ggrRepEst).toBe(-40);
  });

  it("modo misto (um relatório sem stats) volta para estimativa", () => {
    const misto = [reports[0], { ...reports[1], player_stats: undefined }];
    expect(computeIdsAnalysis(misto).exact).toBe(false);
  });
});

describe("computeIdsAnalysis — casos extremos", () => {
  it("lista vazia devolve zeros sem quebrar", () => {
    const a = computeIdsAnalysis([]);
    expect(a.numBoosts).toBe(0);
    expect(a.totalUnique).toBe(0);
    expect(a.totalStake).toBe(0);
    expect(a.tiers).toEqual([]);
    expect(a.exact).toBe(false);
  });

  it("boost sem player_ids conta no stake mas não no cruzamento", () => {
    const a = computeIdsAnalysis([
      report({ id: 1, boost_id: "A", confronto: "X", data_evento: "2026-06-06T19:00:00", total_stake: 99.99, ggr: 1.01, player_ids: [] }),
    ]);
    expect(a.numBoosts).toBe(1);
    expect(a.totalUnique).toBe(0);
    expect(a.totalStake).toBe(99.99);
  });
});
