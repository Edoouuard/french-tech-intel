// Insights French Tech — extraction et normalisation des données publiées sur
// https://www.insights-french-tech.com/ (levées, exits & M&A, investisseurs, PE Watch, startups).
// Le site embarque ses jeux de données dans le HTML (var LD_BASE=[...] etc.) : on les relit tels quels.
// Fonctionne en Node (CommonJS) et dans le navigateur (window.InsightsFT).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.InsightsFT = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const SOURCE_URL = "https://www.insights-french-tech.com/";
  const KEYS = ["LD_BASE", "MD_BASE", "INVFULL_BASE", "STARTUPS_BASE", "PE_BASE"];

  // Lit le littéral JSON qui suit `var NAME=` en équilibrant crochets/accolades hors chaînes.
  function readLiteral(html, name) {
    const m = new RegExp("(?:var|let|const)\\s+" + name + "\\s*=\\s*").exec(html);
    if (!m) return null;
    let i = m.index + m[0].length;
    const open = html[i];
    const close = open === "[" ? "]" : open === "{" ? "}" : null;
    if (!close) return null;
    let depth = 0, inStr = false, q = "", esc = false;
    for (let j = i; j < html.length; j++) {
      const c = html[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === q) inStr = false;
        continue;
      }
      if (c === '"' || c === "'") { inStr = true; q = c; continue; }
      if (c === open) depth++;
      else if (c === close && --depth === 0) return JSON.parse(html.slice(i, j + 1));
    }
    return null;
  }

  const unesc = (s) => (typeof s === "string" ? s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\n/g, "\n") : s);
  const splitList = (s) => (s ? unesc(s).split(/\s*[,;]\s*/).map((x) => x.trim()).filter(Boolean) : []);
  const ym = (an, mo) => (an ? `${an}-${String(mo || 1).padStart(2, "0")}` : null);
  const STAGE = { "Pre-seed": "Pre-Seed", Seed: "Seed", "Série A": "Series A", "Série B": "Series B", "Série C": "Series C", Growth: "Growth", "Post-IPO": "Post-IPO", Secondary: "Secondary", NC: null };
  const SECTOR = { IA: "AI", Energy: "Energy", GreenTech: "Climate", DeepTech: "DeepTech", Biotech: "Biotech", MedTech: "MedTech", FinTech: "FinTech", SaaS: "SaaS", "Cybersécurité": "Cyber", "E-commerce": "E-Commerce", EdTech: "EdTech", SpaceTech: "Space", DefenseTech: "Defense", AgriTech: "AgTech", FoodTech: "FoodTech", MobilityTech: "Mobility", Industrie: "Manufacturing", Santé: "DigitalHealth", "Crypto & Web3": "Web3 Infrastructure" };

  function parse(html, fetchedAt) {
    const raw = {};
    for (const k of KEYS) raw[k] = readLiteral(html, k) || [];
    return fromBases(raw, fetchedAt);
  }

  // Même normalisation à partir des tableaux déjà chargés (ex. variables globales de la page).
  function fromBases(src, fetchedAt) {
    const raw = {};
    for (const k of KEYS) raw[k] = Array.isArray(src[k]) ? src[k] : [];
    const deals = raw.LD_BASE.map((d, i) => ({
      id: "d" + (i + 1),
      company: unesc(d.s),
      sector_raw: unesc(d.t),
      sector: SECTOR[unesc(d.t)] || unesc(d.t),
      pitch: unesc(d.p) || null,
      amount_eur_m: typeof d.m === "number" ? d.m : null,
      investors: splitList(d.i),
      stage_raw: unesc(d.stade),
      stage: STAGE[unesc(d.stade)] ?? unesc(d.stade),
      date: ym(d.an, d.mo),
      day: d.j || null,
    })).sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.day || 0) - (a.day || 0));
    const ops = raw.MD_BASE.map((d, i) => ({
      id: "o" + (i + 1),
      target: unesc(d.s),
      acquirer: unesc(d.acq),
      type: unesc(d.type),
      sector_raw: unesc(d.t),
      description: unesc(d.sub) || null,
      amount_eur_m: typeof d.m === "number" ? d.m : null,
      context: unesc(d.ctx) || null,
      date: ym(d.an, d.mo),
      siren: d.siren || null,
      founded: d.founded || null,
      employees: d.employees || null,
      revenue: unesc(d.revenue) || null,
      category: unesc(d.categorie) || null,
      arr: unesc(d.arr) || null,
      last_raise: unesc(d.last_raise) || null,
      profitable: d.profitable ?? null,
      source: unesc(d.source) || null,
    })).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const investors = raw.INVFULL_BASE.map((v) => ({
      name: unesc(v.n), type: ({ "Family Office": "Family office", Accelerateur: "Accélérateur" })[unesc(v.type)] || unesc(v.type), stages: unesc(v.stade), ticket_eur_m: unesc(v.ticket), focus: unesc(v.focus),
      deals_tracked: v.nb ?? null, sectors: (v.sect || []).map(unesc), size_band: unesc(v.taille),
    }));
    const pe = raw.PE_BASE.map((p) => ({
      target: unesc(p.cible), funds: splitList(p.fonds), type: unesc(p.type), sector: unesc(p.secteur), ev_eur_m: p.ev ?? null,
      entry: ym(p.an_entree, p.mo_entree), status: unesc(p.statut), exit_year: p.an_exit || null, description: unesc(p.desc) || null,
      country: p.pays || null, exit_window: p.exit_min ? [p.exit_min, p.exit_max] : null, holding_years: p.annees_detention ?? null, maturity: unesc(p.maturite) || null,
    }));
    const startups = raw.STARTUPS_BASE.map((s) => ({
      name: unesc(s.n), sector_raw: unesc(s.t), pitch: unesc(s.p) || null, total_eur_m: s.total ?? null, stage_raw: unesc(s.stade),
      last_round: ym(s.last_an, s.last_mo),
      rounds: (s.h || []).map((h) => ({ date: ym(h.an, h.mo), amount_eur_m: h.m ?? null, investors: splitList(h.i) })),
    }));
    const last = deals[0] && deals[0].date;
    return {
      meta: { source: "Insights French Tech", url: SOURCE_URL, fetched_at: fetchedAt || new Date().toISOString(), latest_deal_month: last, counts: { deals: deals.length, operations: ops.length, investors: investors.length, startups: startups.length, pe: pe.length }, scope: "France uniquement" },
      deals, operations: ops, investors, pe, startups,
    };
  }

  // ---- Requêtes ----------------------------------------------------------------------------
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  // Clé de rapprochement entre noms de fonds (« Serena Fund IV » ≈ « Serena »).
  const STOP = new Set(["fund", "fonds", "capital", "ventures", "venture", "partners", "vc", "invest", "investment", "investments", "management", "gestion", "sas", "the", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "seed", "growth", "early", "stage", "fcpr", "fcpi", "fpci", "slp", "scr", "and", "de", "la", "le", "les", "des"]);
  const coreName = (s) => norm(s).split(" ").filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w)).join(" ");

  function dealsFor(ins, investorName) {
    const key = coreName(investorName);
    if (!key || key.length < 3) return [];
    // Égalité stricte du nom « cœur » (sans suffixes génériques ni parenthèses) pour éviter
    // les faux positifs du type « Robin Capital » ≈ « Robin Davids ».
    return ins.deals.filter((d) => d.investors.some((i) => coreName(String(i).replace(/\(.*?\)/g, " ")) === key));
  }

  function recentDeals(ins, o = {}) {
    const q = norm(o.query || "");
    const sec = o.sector ? norm(o.sector) : null;
    const st = o.stage ? norm(o.stage) : null;
    let r = ins.deals.filter((d) =>
      (!o.since || (d.date || "") >= o.since) &&
      (!sec || norm(d.sector) === sec || norm(d.sector_raw) === sec) &&
      (!st || norm(d.stage || "") === st || norm(d.stage_raw || "") === st) &&
      (o.min_amount_eur_m == null || (d.amount_eur_m || 0) >= o.min_amount_eur_m) &&
      (o.max_amount_eur_m == null || (d.amount_eur_m != null && d.amount_eur_m <= o.max_amount_eur_m)) &&
      (!o.investor || dealsFor({ deals: [d] }, o.investor).length) &&
      (!q || norm([d.company, d.pitch, d.sector_raw, d.investors.join(" ")].join(" ")).includes(q))
    );
    if (o.sort === "amount") r = r.slice().sort((a, b) => (b.amount_eur_m || 0) - (a.amount_eur_m || 0));
    return r;
  }

  function investorActivity(ins, name, since) {
    const deals = dealsFor(ins, name).filter((d) => !since || (d.date || "") >= since);
    const profile = ins.investors.find((v) => coreName(v.name) === coreName(name)) || null;
    const by = (k) => Object.entries(deals.reduce((a, d) => ((a[d[k] || "NC"] = (a[d[k] || "NC"] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
    return {
      investor: name, profile, deals_count: deals.length, last_deal: deals[0] || null,
      deals_last_12m: deals.filter((d) => d.date >= monthsAgo(12)).length,
      by_stage: by("stage_raw"), by_sector: by("sector_raw"), deals,
    };
  }
  function monthsAgo(n, from = new Date()) {
    const d = new Date(from.getFullYear(), from.getMonth() - n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function operations(ins, o = {}) {
    const q = norm(o.query || "");
    return ins.operations.filter((d) =>
      (!o.type || norm(d.type).includes(norm(o.type))) &&
      (!o.since || (d.date || "") >= o.since) &&
      (!q || norm([d.target, d.acquirer, d.sector_raw, d.description, d.context].join(" ")).includes(q))
    );
  }

  return { SOURCE_URL, readLiteral, parse, fromBases, recentDeals, investorActivity, operations, dealsFor, coreName, monthsAgo, norm };
});
