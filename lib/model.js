// Modèle de données Insights French Tech : index des levées, investisseurs, véhicules en
// déploiement, acquéreurs, startups et PE, plus les requêtes exposées par le serveur MCP.
const I = require("./insights.js");
const FC = require("./funds-core.js");
const PD = require("./people-detect.js");

const norm = I.norm;
const rawCore = (n) => I.coreName(String(n || "").replace(/\(.*?\)/g, " "));
// Alias des grands fonds internationaux (« a16z » = « Andreessen Horowitz »), alimentés par build().
let ALIAS = new Map();
const core = (n) => { const k = rawCore(n); return ALIAS.get(k) || k; };
const ORG_WORDS = /\b(capital|ventures?|invest\w*|fund|fonds|partners|group|groupe|holding|bank|banque|cr[ée]dit|caisse|angels|club|r[ée]gion|sas?|gestion|equity|labs?|studio|foundation|fondation|corp|inc|ltd|gmbh|ag|bv|family|office|accelerat\w*|incubat\w*|bpi\w*|universit\w*|[ée]cole|school|participations?|d[ée]veloppement|innovation|impact|vc|tech|ai|management|assets?|finance|financi[eè]re|mutuel\w*|assurances?|insurance|global|international|network|collective|seed|growth|pe|cvc)\b/i;
const personLike = (n) => /^[A-ZÀ-Ý][a-zà-ÿ'’-]+(?:[ -](?:de |du |le |la |van |von )?[A-ZÀ-Ý][a-zà-ÿ'’-]+){1,2}$/.test(String(n).trim()) && !ORG_WORDS.test(n);
const GENERIC = /^(business angels?|business angels? \d+|ba|business angels non nommes|angels?|fondateurs?|founders?|family offices?|nc|n c|nd|non communique.*|non divulgue.*|investisseurs? historiques?|existing investors|autres?|undisclosed|management|salaries)$/;
const isGeneric = (i) => GENERIC.test(norm(i));
const STAGES = ["Pre-seed", "Seed", "Série A", "Série B", "Série C", "Growth"];

// Alias secteur (français / anglais) → libellés utilisés par Insights
const SECTOR_ALIASES = {
  IA: ["ia", "ai", "intelligence artificielle", "llm", "agents", "genai", "machine learning", "ml"],
  SaaS: ["saas", "logiciel", "software", "b2b"],
  MedTech: ["medtech", "dispositif medical", "medical", "sante"],
  HealthTech: ["healthtech", "sante", "e sante", "digital health", "digitalhealth", "health"],
  Biotech: ["biotech", "biotechnologie", "therapeutique", "therapeutics", "pharma", "life sciences", "sante"],
  FinTech: ["fintech", "finance", "paiement", "payments", "banque", "neobanque"],
  InsurTech: ["insurtech", "assurance"],
  DeepTech: ["deeptech", "deep tech", "hardtech", "photonique"],
  GreenTech: ["greentech", "climat", "climate", "decarbonation", "cleantech", "impact", "carbone", "environnement"],
  Energy: ["energie", "energy", "batterie", "hydrogene", "solaire", "renouvelable"],
  "Circular Economy": ["circulaire", "recyclage", "circular"],
  "E-commerce": ["e commerce", "ecommerce", "retail", "commerce", "d2c", "marketplace"],
  "Industry 4.0": ["industrie", "industry", "manufacturing", "usine", "industriel"],
  Robotics: ["robotique", "robotics", "robot"],
  Mobility: ["mobilite", "mobility", "transport", "automobile", "logistique"],
  PropTech: ["proptech", "immobilier", "real estate"],
  ConTech: ["contech", "construction", "btp"],
  ConstructionTech: ["construction", "btp"],
  EdTech: ["edtech", "education", "formation"],
  Cybersecurity: ["cyber", "cybersecurite", "cybersecurity", "securite"],
  "Cybersécurité": ["cyber", "cybersecurite", "cybersecurity", "securite"],
  FoodTech: ["foodtech", "alimentation", "food"],
  AgriTech: ["agritech", "agtech", "agriculture"],
  HRTech: ["hrtech", "rh", "recrutement", "ressources humaines"],
  Gaming: ["gaming", "jeu video", "jeux"],
  "Cloud & Data": ["cloud", "data", "infrastructure data", "devops"],
  LegalTech: ["legaltech", "juridique", "legal"],
  Aerospace: ["aerospatial", "aerospace", "aeronautique"],
  SpaceTech: ["spatial", "space", "satellite"],
  Defense: ["defense", "defence", "dual use", "militaire"],
  "Crypto & Web3": ["crypto", "web3", "blockchain"],
  Quantique: ["quantique", "quantum"],
  "Semi-conducteurs": ["semi conducteurs", "semiconducteurs", "puces", "chips"],
  SportsTech: ["sport", "sportstech"],
};
function resolveSectors(text) {
  const t = " " + norm(text) + " ";
  if (!text) return [];
  const out = new Set();
  for (const [sec, al] of Object.entries(SECTOR_ALIASES)) if (norm(sec) === norm(text) || al.some((a) => t.includes(" " + a + " "))) out.add(sec);
  return [...out];
}
function resolveStage(text) {
  if (!text) return null;
  const t = norm(text);
  if (/pre ?seed|pre amorcage/.test(t)) return "Pre-seed";
  if (/seed|amorcage/.test(t)) return "Seed";
  if (/(serie|series|tour) a\b/.test(t) || t === "a") return "Série A";
  if (/(serie|series|tour) b\b/.test(t) || t === "b") return "Série B";
  if (/(serie|series|tour) c\b/.test(t) || t === "c") return "Série C";
  if (/growth|croissance|late/.test(t)) return "Growth";
  return STAGES.find((s) => norm(s) === t) || null;
}
const parseTicket = (t) => { const m = String(t || "").match(/([\d.,]+)\s*(?:→|->|–|-)\s*([\d.,]+)/); return m ? [parseFloat(m[1].replace(",", ".")), parseFloat(m[2].replace(",", "."))] : null; };
const ymAdd = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const median = (a) => { a = a.slice().sort((x, y) => x - y); const n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null; };
const quant = (a, q) => { a = a.slice().sort((x, y) => x - y); if (!a.length) return null; const p = (a.length - 1) * q, lo = Math.floor(p); return +(a[lo] + (a[Math.ceil(p)] - a[lo]) * (p - lo)).toFixed(3); };

function build(INS, VEH) {
  const INTL = VEH.intl || [];
  ALIAS = new Map();
  INTL.forEach((f) => { const k = rawCore(f.name); f.aliases.concat(f.name).forEach((a) => { const ak = rawCore(a); if (ak) ALIAS.set(ak, k); }); });
  const INTL_BY = new Map(INTL.map((f) => [rawCore(f.name), f]));
  const D = INS.deals, OPS = INS.operations;
  const LATEST = INS.meta.latest_deal_month;
  const SINCE12 = ymAdd(LATEST, -11), SINCE24 = ymAdd(LATEST, -23);
  const DBC = new Map();
  D.forEach((d) => new Set(d.investors.map(core)).forEach((k) => { if (k) (DBC.get(k) || DBC.set(k, []).get(k)).push(d); }));
  // Rattache un véhicule à son fonds : nom complet, sinon début du nom (« Daphni Blue III » → « Daphni »).
  const VAGUE = new Set(["angel", "angels", "climate", "impact", "deep", "tech", "blue", "green", "digital", "health", "growth", "seed", "early", "global", "venture", "ventures", "capital", "fund", "europe", "european"]);
  const KNOWN = new Set();
  INS.investors.forEach((v) => { if (!isGeneric(v.name)) KNOWN.add(core(v.name) || norm(v.name)); });
  D.forEach((d) => d.investors.forEach((i) => { if (!isGeneric(i)) KNOWN.add(core(i) || norm(i)); }));
  INTL.forEach((f) => KNOWN.add(rawCore(f.name)));
  const vehKey = (name) => {
    const c = core(name);
    if (c && KNOWN.has(c)) return c;
    const w = c.split(" ").filter(Boolean);
    for (let k = w.length - 1; k >= 1; k--) { const p = w.slice(0, k).join(" "); if (p.length >= 5 && !VAGUE.has(p) && KNOWN.has(p)) return p; }
    const nw = norm(name).split(" ");
    for (let k = Math.min(3, nw.length - 1); k >= 2; k--) { const p = nw.slice(0, k).join(" "); if (KNOWN.has(p)) return p; }
    return c;
  };
  const VBC = new Map();
  VEH.funds.forEach((f) => { const k = vehKey(f.name); if (k) (VBC.get(k) || VBC.set(k, []).get(k)).push(f); });
  const PPL = new Map();
  VEH.people.forEach((p) => (PPL.get(p.fund_id) || PPL.set(p.fund_id, []).get(p.fund_id)).push(p));
  const ENT = new Map();
  // Véhicules « en déploiement en France » : français, ou fonds ayant investi en France sur 24 mois.
  // Les fonds étrangers sans deal français récent sont exposés à part (foreign_vehicles).
  const mk = (key, name, ins) => {
    const deals = DBC.get(key) || [];
    const all = VBC.get(key) || [];
    const n24 = deals.filter((d) => d.date >= SINCE24).length;
    const vehicles = all.filter((f) => f.country === "France" || n24 > 0);
    return { key, name, ins, intl: INTL_BY.get(key) || null, vehicles, foreign: all.filter((f) => !vehicles.includes(f)), deals, n24, n12: deals.filter((d) => d.date >= SINCE12).length, nb: Math.max(ins && ins.deals_tracked ? ins.deals_tracked : 0, deals.length) };
  };
  INS.investors.forEach((v) => { if (isGeneric(v.name)) return; const k = core(v.name) || norm(v.name); if (!ENT.has(k)) ENT.set(k, mk(k, v.name, v)); });
  VEH.funds.forEach((f) => { const k = vehKey(f.name); if (k && !ENT.has(k) && (f.country === "France" || DBC.has(k))) ENT.set(k, mk(k, f.name, null)); });
  INTL.forEach((f) => { const k = rawCore(f.name); if (!ENT.has(k)) ENT.set(k, mk(k, f.name, null)); else { const e = ENT.get(k); e.intl = f; e.name = f.name; } });
  // Tout investisseur cité sur une levée a sa fiche (graphie la plus fréquente).
  {
    const spell = new Map();
    D.forEach((d) => d.investors.forEach((i) => { if (isGeneric(i) || i.length < 2) return; const k = core(i) || norm(i); if (!k) return; const m = spell.get(k) || spell.set(k, new Map()).get(k); m.set(i, (m.get(i) || 0) + 1); }));
    spell.forEach((m, k) => { if (!ENT.has(k) && (DBC.get(k) || []).length >= 2) ENT.set(k, mk(k, ((n) => (n === n.toLowerCase() ? n.replace(/(^|[\s-])(\p{L})/gu, (x, a, b) => a + b.toUpperCase()) : n))([...m.entries()].sort((a, b) => b[1] - a[1])[0][0].replace(/\s+/g, " ").trim()), null)); });
  }
  const isPerson = (e) => !e.intl && !e.vehicles.length && !e.foreign.length && PD.isPerson(e.name);
  const isAngelNetwork = (e) => !!(e.ins && /business angel/i.test(e.ins.type));
  const isAngel = (e) => isPerson(e) || isAngelNetwork(e);
  const typeFamily = (t) => { const n = norm(t);
  if (/club d investisseurs/.test(n)) return "Clubs d'investisseurs";
  if (/business angel/.test(n)) return "Business angel";
  if (/cvc|corporate/.test(n)) return "Corporate (CVC)";
  if (/growth|hedge|private equity|^pe$|buyout/.test(n)) return "Growth et private equity";
  if (/accelerateur|studio/.test(n)) return "Accélérateur et studio";
  if (/family/.test(n)) return "Family office";
  if (/crowd/.test(n)) return "Crowdfunding";
  // VC, indépendant, institutionnel, public, régional, souverain, spécialisé, impact, autre : tous « Fonds VC ».
  return "Fonds VC"; };
  const typeLabel = (e) => { const t = rawType(e), f = typeFamily(t); return f === "Fonds VC" ? "Fonds VC" : f === "Clubs d'investisseurs" ? "Club d'investisseurs" : f === "Crowdfunding" ? "Crowdfunding" : t; };
  const entType = (e) => typeLabel(e);
  const rawType = (e) => (e.intl ? e.intl.type : isPerson(e) ? "Business angel" : isAngelNetwork(e) ? "Club d'investisseurs" : e.ins ? e.ins.type : e.vehicles.length || e.foreign.length ? "Fonds VC" : "Investisseur");
  const BUY = new Map();
  OPS.forEach((o) => { if (!o.acquirer || /^(nd|nc|n d|n c|non communique.*|non divulgue.*|inconnu|undisclosed)$/.test(norm(o.acquirer))) return; const k = norm(o.acquirer); (BUY.get(k) || BUY.set(k, { name: o.acquirer, ops: [] }).get(k)).ops.push(o); });

  const entFor = (name) => ENT.get(core(name)) || ENT.get(norm(name)) || [...ENT.values()].find((e) => norm(e.name) === norm(name) || (e.intl && e.intl.aliases.some((a) => norm(a) === norm(name)))) || null;
  const intlOut = (p) => (p ? { headquarters: p.hq, country: p.country, founded: p.founded, type: p.type, aum: p.aum, stages: p.stages, focus: p.focus, notable_portfolio: p.notable, website: p.domain } : null);
  const vehicleOut = (f) => ({
    name: f.name, country: f.country, size: f.size_label, size_eur_m: f.size_eur_m, stage: f.stage, sectors: f.sectors, thesis: f.thesis, ticket: f.ticket,
    geo_scope: f.geo_scope, lps: f.lps, signals: f.signals, caveats: f.caveats, contact: f.contact,
    team: (PPL.get(f.id) || []).map((p) => (p.role ? { name: p.name, role: p.role } : { name: p.name })), consulted: f.consulted,
  });
  // Pitch d'une startup : celui d'un de ses tours, sinon sa fiche, sinon la description d'une opération.
  const PITCH = new Map();
  D.forEach((d) => { if (d.pitch && !PITCH.has(norm(d.company))) PITCH.set(norm(d.company), d.pitch); });
  INS.startups.forEach((x) => { if (x.pitch && !PITCH.has(norm(x.name))) PITCH.set(norm(x.name), x.pitch); });
  OPS.forEach((o) => { if (o.description && !PITCH.has(norm(o.target))) PITCH.set(norm(o.target), o.description); });
  Object.entries(VEH.pitches || {}).forEach(([k, p]) => { if (!PITCH.has(norm(k))) PITCH.set(norm(k), p); });
  const pitchOf = (d) => d.pitch || PITCH.get(norm(d.company)) || null;
  const dealOut = (d) => ({ company: d.company, date: d.date, stage: d.stage_raw || null, amount_eur_m: d.amount_eur_m, sector: d.sector_raw, investors: d.investors, pitch: pitchOf(d) });
  // Thèse déclarée (véhicules, annuaire, profil international) et thèse observée sur les deals.
  const thesisOf = (e) => {
    const declared = [...new Set([...e.vehicles.map((f) => f.thesis), ...e.foreign.map((f) => f.thesis), e.ins && e.ins.focus, e.intl && e.intl.focus].filter(Boolean))];
    const ds = e.deals;
    if (ds.length < 2) return { declared, observed: null };
    const top = (key, n) => Object.entries(ds.reduce((a, d) => { const k = key(d); if (k) a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => ({ name: k, share_pct: Math.round((c / ds.length) * 100) }));
    const amts = ds.map((d) => d.amount_eur_m).filter((v) => v != null);
    return { declared, observed: { deals: ds.length, main_stages: top((d) => d.stage_raw, 2), main_sectors: top((d) => (d.sector_raw && d.sector_raw !== "Autre" ? d.sector_raw : null), 3).filter((x) => x.share_pct >= 8), median_round_eur_m: median(amts), round_iqr_eur_m: amts.length >= 2 ? [quant(amts, 0.25), quant(amts, 0.75)] : null, deals_last_12m: e.n12 } };
  };
  const entBrief = (e) => ({
    name: e.name, type: entType(e), ...(isPerson(e) ? { tag: "Business Angel" } : {}), ...(e.intl ? { international: `${e.intl.hq}, ${e.intl.country}${e.intl.aum ? " · " + e.intl.aum : ""}` } : {}), stages: e.ins ? e.ins.stages : e.intl ? e.intl.stages : e.vehicles.map((v) => v.stage).join(", "), ticket_eur_m: e.ins ? e.ins.ticket_eur_m : null,
    deals_tracked: e.nb, deals_last_12m: e.n12, deploying_vehicles: e.vehicles.map((v) => `${v.name} (${v.size_label}${v.stage ? ", " + v.stage : ""})`),
    ...(e.foreign.length ? { foreign_vehicles_not_investing_in_france: e.foreign.map((v) => `${v.name} (${v.country}, ${v.size_label})`) } : {}),
  });

  function searchDeals(o = {}) {
    const secs = o.sector ? resolveSectors(o.sector).concat([o.sector]) : null;
    const st = resolveStage(o.stage);
    const q = norm(o.query || "");
    const inv = o.investor ? core(o.investor) : null;
    let r = D.filter((d) =>
      (!o.since || (d.date || "") >= o.since) && (!o.until || (d.date || "") <= o.until) &&
      (!secs || secs.some((s) => norm(s) === norm(d.sector_raw))) && (!st || d.stage_raw === st) &&
      (o.min_amount_eur_m == null || (d.amount_eur_m || 0) >= o.min_amount_eur_m) &&
      (o.max_amount_eur_m == null || (d.amount_eur_m != null && d.amount_eur_m <= o.max_amount_eur_m)) &&
      (!inv || d.investors.some((i) => core(i) === inv)) &&
      (!o.with_deploying_fund || d.investors.some((i) => (ENT.get(core(i)) || {}).vehicles?.length)) &&
      (!q || norm([d.company, d.pitch, d.sector_raw, d.investors.join(" ")].join(" ")).includes(q)));
    if (o.sort === "amount") r = r.slice().sort((a, b) => (b.amount_eur_m || 0) - (a.amount_eur_m || 0));
    return r;
  }

  function getStartup(name) {
    const n = norm(name);
    const exact = (x) => norm(x) === n;
    let deals = D.filter((d) => exact(d.company));
    if (!deals.length) deals = D.filter((d) => norm(d.company).includes(n));
    const company = deals[0] ? deals[0].company : name;
    const st = INS.startups.find((s) => norm(s.name) === norm(company));
    const ops = OPS.filter((o) => norm(o.target) === norm(company));
    const pe = INS.pe.filter((p) => norm(p.target) === norm(company));
    if (!deals.length && !st && !ops.length && !pe.length) return null;
    const rounds = deals.slice().sort((a, b) => (a.date || "").localeCompare(b.date || "")).map(dealOut);
    return {
      name: company, pitch_source: (deals.find((d) => d.pitch) || st && st.pitch) ? "Insights French Tech" : PITCH.has(norm(company)) ? "recherche web" : null, sector: (deals[0] || {}).sector_raw || (st && st.sector_raw) || (ops[0] && ops[0].sector_raw) || (pe[0] && pe[0].sector) || null, pitch: (deals.find((d) => d.pitch) || {}).pitch || (st && st.pitch) || PITCH.get(norm(company)) || null,
      total_raised_eur_m: +rounds.reduce((s, d) => s + (d.amount_eur_m || 0), 0).toFixed(2) || (st && st.total_eur_m) || null,
      rounds, investors: [...new Set(deals.flatMap((d) => d.investors))], exits: ops, pe,
    };
  }

  function getInvestor(name) {
    const e = entFor(name);
    if (!e) return null;
    const deals = e.deals.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const count = (k) => Object.entries(deals.reduce((a, d) => ((a[d[k] || "NC"] = (a[d[k] || "NC"] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
    const co = new Map(); deals.forEach((d) => d.investors.forEach((i) => { if (core(i) !== e.key && !isGeneric(i)) co.set(i, (co.get(i) || 0) + 1); }));
    const byYear = deals.reduce((a, d) => ((a[(d.date || "").slice(0, 4)] = (a[(d.date || "").slice(0, 4)] || 0) + 1), a), {});
    const buyer = BUY.get(norm(e.name));
    return {
      ...entBrief(e), thesis: thesisOf(e), focus: (e.ins && e.ins.focus) || (e.intl && e.intl.focus) || null, declared_sectors: e.ins ? e.ins.sectors : [], international_profile: intlOut(e.intl),
      deploying_funds: e.vehicles.map(vehicleOut),
      foreign_deploying_funds_not_investing_in_france: e.foreign.map(vehicleOut),
      activity: { by_year: byYear, by_stage: count("stage_raw"), by_sector: count("sector_raw").slice(0, 10), total_rounds_cofinanced_eur_m: Math.round(deals.reduce((s, d) => s + (d.amount_eur_m || 0), 0)) },
      recent_deals: deals.slice(0, 12).map(dealOut),
      largest_deals: deals.slice().sort((a, b) => (b.amount_eur_m || 0) - (a.amount_eur_m || 0)).slice(0, 5).map(dealOut),
      frequent_coinvestors: [...co.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n, c]) => ({ name: n, deals_together: c })),
      as_acquirer: buyer ? buyer.ops : [],
    };
  }

  function listInvestors(o = {}) {
    const q = norm(o.query || "");
    const secs = o.sector ? resolveSectors(o.sector).concat([o.sector]).map(norm) : null;
    const st = resolveStage(o.stage);
    let r = [...ENT.values()].filter((e) =>
      (!o.type || norm(entType(e)).includes(norm(o.type))) && (!o.international_only || e.intl) && (!o.business_angels_only || isPerson(e)) &&
      (!o.deploying_only || e.vehicles.length) &&
      (!st || e.deals.some((d) => d.stage_raw === st)) &&
      (!secs || e.deals.some((d) => secs.includes(norm(d.sector_raw))) || (e.ins && e.ins.sectors.some((s) => secs.includes(norm(s))))) &&
      (!q || norm([e.name, e.ins && e.ins.focus, e.vehicles.map((v) => v.name + " " + (v.thesis || "")).join(" ")].join(" ")).includes(q)));
    const so = o.sort || "activity";
    r.sort(so === "name" ? (a, b) => a.name.localeCompare(b.name) : so === "deals" ? (a, b) => b.nb - a.nb : (a, b) => b.n12 - a.n12 || b.nb - a.nb);
    return r;
  }

  // Classement des investisseurs pertinents pour une startup qui lève en France.
  // Score /100 : secteur (35), stade (25), rythme récent (15), ticket (15), fonds en déploiement (10).
  function findInvestors(o = {}) {
    const secs = new Set([...(o.sector ? resolveSectors(o.sector) : []), ...(o.description ? resolveSectors(o.description) : [])]);
    const st = resolveStage(o.stage);
    const amt = o.amount_eur_m;
    const out = [];
    for (const e of ENT.values()) {
      const recent = e.deals.filter((d) => d.date >= SINCE24);
      if (!recent.length && !e.vehicles.length) continue;
      let score = 0; const why = [];
      const secDeals = secs.size ? recent.filter((d) => secs.has(d.sector_raw)) : [];
      if (secs.size) {
        const vehSec = e.vehicles.some((v) => (v.sectors || []).some((s) => [...secs].some((x) => resolveSectors(s).includes(x) || norm(s) === norm(x))));
        const pts = Math.min(35, secDeals.length * 7 + (vehSec ? 8 : 0));
        if (!pts) continue;
        score += pts;
        if (secDeals.length) why.push(`${secDeals.length} deal${secDeals.length > 1 ? "s" : ""} ${[...secs].join("/")} sur 24 mois`);
        if (vehSec) why.push("thèse du fonds en déploiement alignée");
      } else score += 15;
      if (st) {
        const stDeals = recent.filter((d) => d.stage_raw === st).length;
        const declared = e.ins && e.ins.stages && norm(e.ins.stages).includes(norm(st).split(" ")[0]);
        const pts = Math.min(25, stDeals * 5 + (declared ? 8 : 0));
        score += pts;
        if (stDeals) why.push(`${stDeals} deal${stDeals > 1 ? "s" : ""} en ${st}`);
      } else score += 10;
      const n12 = e.deals.filter((d) => d.date >= SINCE12).length;
      score += Math.min(15, n12 * 1.5);
      if (n12) why.push(`${n12} deal${n12 > 1 ? "s" : ""} sur 12 mois`);
      if (amt != null) {
        const t = parseTicket(e.ins && e.ins.ticket_eur_m) || e.vehicles.map((v) => [v.ticket_min_eur_m, v.ticket_max_eur_m]).find((x) => x[0] != null);
        const amts = recent.map((d) => d.amount_eur_m).filter((v) => v != null);
        if (t && amt >= t[0] * 0.5 && amt <= t[1] * 3) { score += 15; why.push(`ticket déclaré ${t[0]}–${t[1]} M€`); }
        else if (amts.length && amt >= quant(amts, 0.1) && amt <= quant(amts, 0.9)) { score += 10; why.push(`tours habituels ${quant(amts, 0.25)}–${quant(amts, 0.75)} M€`); }
      } else score += 7;
      if (e.vehicles.length) { score += 10; why.push("fonds en cours de déploiement : " + e.vehicles.map((v) => `${v.name} (${v.size_label})`).join(", ")); }
      out.push({ score: Math.min(100, Math.round(score)), investor: entBrief(e), reasons: why, example_deals: (secDeals.length ? secDeals : recent).slice(0, 3).map((d) => `${d.company} (${d.stage_raw || "NC"}, ${d.amount_eur_m ?? "n.c."} M€, ${d.date})`) });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  function deployingFunds(o = {}) {
    const secs = o.sector ? resolveSectors(o.sector).concat([o.sector]).map(norm) : null;
    const st = o.stage ? norm(o.stage) : null;
    const items = [];
    for (const e of ENT.values()) for (const v of (o.include_foreign ? e.vehicles.concat(e.foreign) : e.vehicles)) {
      if (o.country && norm(v.country) !== norm(o.country)) continue;
      if (secs && !(v.sectors || []).some((s) => secs.includes(norm(s)) || resolveSectors(s).some((x) => secs.includes(norm(x))))) continue;
      if (st && !norm(v.stage || "").includes(st.replace("serie", "series"))) { if (!norm(v.stage || "").includes(st)) continue; }
      items.push({ manager: e.name, invests_in_france: !e.foreign.includes(v), french_deals_last_24m: e.n24, french_deals_last_12m: e.n12, last_french_deal: e.deals[0] ? dealOut(e.deals.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0]) : null, ...vehicleOut(v) });
    }
    return items.sort((a, b) => b.french_deals_last_12m - a.french_deals_last_12m || (b.size_eur_m || 0) - (a.size_eur_m || 0));
  }

  function topInvestors(o = {}) {
    const r = searchDeals({ since: o.since || SINCE12, sector: o.sector, stage: o.stage });
    const c = new Map();
    r.forEach((d) => new Set(d.investors).forEach((i) => { if (!isGeneric(i)) c.set(i, (c.get(i) || 0) + 1); }));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([name, deals]) => { const e = ENT.get(core(name)); return { name, deals, has_deploying_fund: !!(e && e.vehicles.length) }; });
  }

  function comparables(o = {}) {
    const r = searchDeals({ sector: o.sector, stage: o.stage, since: o.since || SINCE12, query: o.query }).filter((d) => d.amount_eur_m != null);
    const a = r.map((d) => d.amount_eur_m);
    const res = { deals: r.length, median_eur_m: median(a), p25_eur_m: quant(a, 0.25), p75_eur_m: quant(a, 0.75), min_eur_m: a.length ? Math.min(...a) : null, max_eur_m: a.length ? Math.max(...a) : null };
    if (o.amount_eur_m != null && a.length) res.your_percentile = Math.round((a.filter((v) => v < o.amount_eur_m).length / a.length) * 100);
    const ref = o.amount_eur_m || res.median_eur_m || 1;
    res.closest_deals = r.slice().sort((x, y) => Math.abs(Math.log(x.amount_eur_m / ref)) - Math.abs(Math.log(y.amount_eur_m / ref))).slice(0, o.limit || 10).map(dealOut);
    return res;
  }

  const TYPE_GROUP = (t) => { const n = norm(t); return /ipo/.test(n) ? "IPO" : /opa/.test(n) ? "OPA" : /lbo|buyout|mbo/.test(n) ? "LBO" : /fusion|merger/.test(n) ? "Fusion" : /minoritaire/.test(n) ? "Minoritaire" : "Acquisition"; };
  function exits(o = {}) {
    const q = norm(o.query || "");
    const secs = o.sector ? resolveSectors(o.sector).concat([o.sector]).map(norm) : null;
    let r = OPS.filter((x) => (!o.type || TYPE_GROUP(x.type) === o.type || norm(x.type).includes(norm(o.type))) && (!o.since || (x.date || "") >= o.since) &&
      (!secs || secs.some((s) => norm(x.sector_raw).includes(s))) && (!q || norm([x.target, x.acquirer, x.sector_raw, x.description, x.context].join(" ")).includes(q)));
    if (o.sort === "amount") r = r.slice().sort((a, b) => (b.amount_eur_m || 0) - (a.amount_eur_m || 0));
    return r;
  }
  function getAcquirer(name) {
    const n = norm(name);
    const b = BUY.get(n) || [...BUY.values()].find((x) => norm(x.name).includes(n));
    if (!b) return null;
    const ops = b.ops.slice().sort((x, y) => (y.date || "").localeCompare(x.date || ""));
    return { name: b.name, operations: ops.length, disclosed_total_eur_m: Math.round(ops.reduce((s, x) => s + (x.amount_eur_m || 0), 0)), sectors: [...new Set(ops.map((x) => x.sector_raw))], types: [...new Set(ops.map((x) => x.type))], deals: ops, also_investor: !!ENT.get(core(b.name)) };
  }
  function peWatch(o = {}) {
    const year = +LATEST.slice(0, 4);
    const q = norm(o.query || "");
    return INS.pe.map((p) => ({ ...p, late_vs_exit_window: p.status !== "Exit" && !!p.exit_window && year > p.exit_window[1] }))
      .filter((p) => (!o.status || norm(p.status).includes(norm(o.status))) && (!o.late_only || p.late_vs_exit_window) && (!q || norm([p.target, p.funds.join(" "), p.sector, p.description].join(" ")).includes(q)));
  }
  function overview(o = {}) {
    const r = searchDeals({ since: o.since || SINCE12, until: o.until, sector: o.sector, stage: o.stage });
    const g = {};
    const key = o.group_by === "sector" ? (d) => d.sector_raw || "NC" : o.group_by === "stage" ? (d) => d.stage_raw || "NC" : (d) => d.date || "NC";
    r.forEach((d) => { const k = key(d); g[k] = g[k] || { key: k, deals: 0, amount_eur_m: 0, amounts: [] }; g[k].deals++; if (d.amount_eur_m != null) { g[k].amount_eur_m += d.amount_eur_m; g[k].amounts.push(d.amount_eur_m); } });
    const groups = Object.values(g).map((x) => ({ key: x.key, deals: x.deals, amount_eur_m: Math.round(x.amount_eur_m), median_eur_m: median(x.amounts) }));
    groups.sort(o.group_by === "month" || !o.group_by ? (a, b) => a.key.localeCompare(b.key) : (a, b) => b.amount_eur_m - a.amount_eur_m);
    const ops = exits({ since: o.since || SINCE12 });
    return { period: { since: o.since || SINCE12, until: o.until || LATEST }, deals: r.length, amount_eur_m: Math.round(r.reduce((s, d) => s + (d.amount_eur_m || 0), 0)), median_round_eur_m: median(r.map((d) => d.amount_eur_m).filter((v) => v != null)), exits_and_ma: ops.length, group_by: o.group_by || "month", groups };
  }
  // ---- Fonds VC européens en déploiement, enrichis de leur activité française ----------------
  const activity = (f) => { const e = ENT.get(vehKey(f.name)); if (!e || !e.deals.length) return null; const last = e.deals.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0]; return { e, n12: e.n12, n24: e.n24, last: `${last.company} (${last.date})` }; };
  const euOut = (f) => { const a = activity(f); return { ...vehicleOut(f), invests_in_france: f.country === "France" || !!(a && a.n24), french_deals_last_12m: a ? a.n12 : 0, french_deals_last_24m: a ? a.n24 : 0, last_french_deal: a ? a.last : null }; };
  function searchEuropeanFunds(o = {}) {
    const parsed = o.query ? FC.parseQuery(o.query) : { countries: [], stages: [], sectors: [], text: "" };
    let r = FC.search(VEH.funds, {
      ...parsed, countries: [...parsed.countries, ...(o.countries || [])], stages: [...parsed.stages, ...(o.stages || [])], sectors: [...parsed.sectors, ...(o.sectors || [])],
      min_size_eur_m: o.min_size_eur_m ?? parsed.min_size_eur_m, max_size_eur_m: o.max_size_eur_m ?? parsed.max_size_eur_m, has_ticket: o.has_ticket, sort: o.sort === "france" ? "relevance" : o.sort,
    }).map((x) => ({ f: x.f || x.fund, why: x.why }));
    if (o.invests_in_france) r = r.filter((x) => euOut(x.f).invests_in_france);
    if (o.sort === "france") r.sort((a, b) => ((activity(b.f) || {}).n12 || 0) - ((activity(a.f) || {}).n12 || 0));
    return r.map((x) => ({ ...euOut(x.f), match_reasons: x.why }));
  }
  function matchEuropeanFunds(o = {}) {
    return FC.matchStartup(VEH.funds, o, (f) => { const a = activity(f); return a ? { n12: a.n12, last: a.last } : null; })
      .map((m) => ({ score: m.score, reasons: m.why, flags: m.flags, ...euOut(m.fund) }));
  }
  function getEuropeanFund(name) {
    const n = norm(name);
    const f = VEH.funds.find((x) => norm(x.name) === n) || VEH.funds.find((x) => norm(x.name).includes(n)) || VEH.funds.find((x) => core(x.name) === core(name));
    if (!f) return null;
    const a = activity(f);
    const similar = FC.matchStartup(VEH.funds.filter((x) => x.id !== f.id), { stage: f.stage, sectors: f.sectors, country: f.country, min_score: 0 }).slice(0, 5).map((m) => `${m.fund.name} (${m.fund.country}, ${m.fund.size_label})`);
    return { ...euOut(f), french_deals: a ? a.e.deals.slice().sort((x, y) => (y.date || "").localeCompare(x.date || "")).slice(0, 10).map(dealOut) : [], similar_funds: similar };
  }
  function europeStats(groupBy = "country") { return FC.stats(VEH.funds, groupBy).map((g) => ({ ...g, investing_in_france: VEH.funds.filter((f) => (groupBy === "sector" ? (f.sectors || []).includes(g.key) : f[groupBy] === g.key) && euOut(f).invests_in_france).length })); }

  function globalSearch(q, limit = 20) {
    const n = norm(q);
    if (!n) return [];
    const res = [];
    for (const e of ENT.values()) if (norm(e.name).includes(n) || e.vehicles.some((v) => norm(v.name).includes(n))) res.push({ id: "investor:" + e.key, title: `${e.name} — investisseur, ${e.nb} deals${e.vehicles.length ? ", fonds en déploiement" : ""}`, w: 3 + e.nb / 10 });
    const seen = new Set();
    for (const d of D) { const k = norm(d.company); if (seen.has(k) || !k.includes(n)) continue; seen.add(k); res.push({ id: "startup:" + d.company, title: `${d.company} — startup, ${d.sector_raw}, dernier tour ${d.stage_raw || "NC"} ${d.amount_eur_m ?? "n.c."} M€ (${d.date})`, w: 2 }); }
    for (const f of VEH.funds) if (norm(f.name).includes(n)) res.push({ id: "fund:" + f.name, title: `${f.name} — fonds VC européen, ${f.country}, ${f.size_label}, ${f.stage || ""}`, w: 2.5 });
    for (const b of BUY.values()) if (norm(b.name).includes(n)) res.push({ id: "acquirer:" + norm(b.name), title: `${b.name} — acquéreur, ${b.ops.length} opérations`, w: 1 + b.ops.length / 5 });
    if (!res.length) for (const d of searchDeals({ query: q }).slice(0, limit)) { const k = "startup:" + d.company; if (!res.some((x) => x.id === k)) res.push({ id: k, title: `${d.company} — ${d.sector_raw}, ${d.stage_raw || "NC"} ${d.amount_eur_m ?? "n.c."} M€ (${d.date})`, w: 1 }); }
    return res.sort((a, b) => (norm(b.title).startsWith(n) - norm(a.title).startsWith(n)) || b.w - a.w).slice(0, limit).map(({ w, ...x }) => x);
  }
  function fetchDoc(id) {
    const [kind, ...rest] = String(id).split(":"); const key = rest.join(":");
    const data = kind === "fund" ? getEuropeanFund(key) : kind === "investor" ? getInvestor(ENT.get(key) ? ENT.get(key).name : key) : kind === "startup" ? getStartup(key) : kind === "acquirer" ? getAcquirer(key) : getInvestor(id) || getStartup(id);
    return data ? { id, title: data.name, text: JSON.stringify(data, null, 2), url: INS.meta.url, metadata: { source: "Insights French Tech", kind } } : null;
  }

  // ---- Recherche tolérante aux fautes ------------------------------------------------------
  const lev = (a, b) => {
    if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) { const cur = [i]; for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[b.length];
  };
  // Similarité 0–1 entre une requête et un nom (préfixe, inclusion, distance d'édition).
  const sim = (q, name) => {
    const a = norm(q), b = norm(name);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (b.startsWith(a) || a.startsWith(b)) return 0.9;
    if (b.includes(a) || a.includes(b)) return 0.8;
    const d = lev(a, b);
    const s = 1 - d / Math.max(a.length, b.length);
    const ws = b.split(" ").map((w) => 1 - lev(a, w) / Math.max(a.length, w.length));
    return Math.max(s, Math.max(...ws) - 0.05);
  };
  const fuzzy = (q, items, nameOf, min = 0.68) => {
    let best = null, bs = min;
    for (const it of items) { const s = sim(q, nameOf(it)); if (s > bs) { bs = s; best = it; } }
    return best;
  };
  const entFuzzy = (name) => entFor(name) || fuzzy(name, [...ENT.values()].filter((e) => e.nb >= 1), (e) => e.name);
  const startupNames = [...new Set(D.map((d) => d.company))];
  const startupFuzzy = (name) => getStartup(name) || ((n) => (n ? getStartup(n) : null))(fuzzy(name, startupNames, (x) => x));
  const acquirerFuzzy = (name) => getAcquirer(name) || ((b) => (b ? getAcquirer(b.name) : null))(fuzzy(name, [...BUY.values()], (b) => b.name));
  const europeanFuzzy = (name) => getEuropeanFund(name) || ((f) => (f ? getEuropeanFund(f.name) : null))(fuzzy(name, VEH.funds, (f) => f.name));
  // Suggestions « vouliez-vous dire » pour un nom introuvable.
  const didYouMean = (q, n = 5) => {
    const pool = [...[...ENT.values()].map((e) => [e.name, "investisseur"]), ...startupNames.map((x) => [x, "startup"]), ...VEH.funds.map((f) => [f.name, "fonds européen"]), ...[...BUY.values()].map((b) => [b.name, "acquéreur"])];
    return pool.map(([name, kind]) => ({ name, kind, s: sim(q, name) })).filter((x) => x.s >= 0.5).sort((a, b) => b.s - a.s).slice(0, n).map(({ name, kind }) => `${name} (${kind})`);
  };

  // ---- Mise à jour hebdomadaire (lundi 8 h, heure de Paris) ----------------------------------
  const dayKey = (d) => (d.date && d.day ? `${d.date}-${String(d.day).padStart(2, "0")}` : null);
  const LATEST_DAY = D.map(dayKey).filter(Boolean).sort().pop() || `${LATEST}-28`;
  const WEEK_START = (() => { const [y, m, dd] = LATEST_DAY.split("-").map(Number); const x = new Date(Date.UTC(y, m - 1, dd - 6)); return x.toISOString().slice(0, 10); })();
  const isNew = (d) => { const k = dayKey(d); return k ? k >= WEEK_START : false; };
  const lastUpdate = (now = new Date()) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hour12: false }).formatToParts(now).map((x) => [x.type, x.value]));
    let back = (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) + 6) % 7;
    if (back === 0 && +p.hour < 8) back = 7;
    const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day - back));
    const n = new Date(d.getTime() + 7 * 864e5);
    return { last_update: `${d.toISOString().slice(0, 10)} 08:00 (Europe/Paris)`, next_update: `${n.toISOString().slice(0, 10)} 08:00 (Europe/Paris)`, schedule: "chaque lundi à 8 h, heure de Paris" };
  };
  const tally = (arr, key) => Object.entries(arr.reduce((a, d) => { const k = key(d) || "NC"; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const sortRecent = (deals) => deals.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.day || 0) - (a.day || 0));

  function whatsNew(o = {}) {
    const wk = D.filter(isNew).filter((d) => !o.sector || resolveSectors(o.sector).concat([o.sector]).some((s) => norm(s) === norm(d.sector_raw)))
      .sort((a, b) => (b.amount_eur_m || 0) - (a.amount_eur_m || 0));
    const inv = new Map();
    wk.forEach((d) => new Set(d.investors).forEach((i) => { if (!isGeneric(i)) inv.set(i, (inv.get(i) || 0) + 1); }));
    const ops = OPS.filter((x) => x.date === LATEST);
    return {
      ...lastUpdate(), deals_window: { from: WEEK_START, to: LATEST_DAY },
      new_deals: wk.length, amount_eur_m: Math.round(wk.reduce((s, d) => s + (d.amount_eur_m || 0), 0)), median_round_eur_m: median(wk.map((d) => d.amount_eur_m).filter((v) => v != null)),
      by_sector: tally(wk, (d) => d.sector_raw).map(([k, n]) => ({ sector: k, deals: n })), by_stage: tally(wk, (d) => d.stage_raw).map(([k, n]) => ({ stage: k, deals: n })),
      most_active_investors: [...inv.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, deals]) => { const e = ENT.get(core(name)); return { name, deals, has_deploying_fund: !!(e && e.vehicles.length) }; }),
      deals: wk.slice(0, o.limit || 30).map(dealOut),
      exits_and_ma_latest_month: { month: LATEST, count: ops.length, operations: ops.slice(0, 10).map((x) => ({ target: x.target, acquirer: x.acquirer, type: x.type, amount_eur_m: x.amount_eur_m, sector: x.sector_raw })) },
    };
  }

  // ---- Comparaison de 2 à 5 investisseurs ------------------------------------------------------
  function compareInvestors(names) {
    const found = [], missing = [];
    names.forEach((n) => { const e = entFuzzy(n); if (e && !found.includes(e)) found.push(e); else if (!e) missing.push(n); });
    const share = (deals, f) => { const t = tally(deals, f); return t.slice(0, 4).map(([k, n]) => `${k} ${Math.round((n / deals.length) * 100)} %`); };
    const rows = found.map((e) => {
      const ds = e.deals, recent = ds.filter((d) => d.date >= SINCE24);
      const amts = recent.map((d) => d.amount_eur_m).filter((v) => v != null);
      const last = sortRecent(ds)[0];
      return {
        name: e.name, type: entType(e), deals_tracked: e.nb, deals_last_12m: e.n12, deals_last_24m: e.n24,
        stage_mix_24m: recent.length ? share(recent, (d) => d.stage_raw) : [], sector_mix_24m: recent.length ? share(recent, (d) => d.sector_raw) : [],
        typical_round_eur_m: amts.length ? { p25: quant(amts, 0.25), median: median(amts), p75: quant(amts, 0.75) } : null,
        declared_ticket_eur_m: e.ins ? e.ins.ticket_eur_m : null,
        deploying_vehicles: e.vehicles.map((v) => `${v.name} (${v.size_label}${v.stage ? ", " + v.stage : ""})`),
        last_deal: last ? dealOut(last) : null, international: e.intl ? `${e.intl.hq}, ${e.intl.country}` : null,
      };
    });
    const shared = [];
    for (let i = 0; i < found.length; i++) for (let j = i + 1; j < found.length; j++) {
      const a = found[i], b = found[j], common = a.deals.filter((d) => d.investors.some((x) => core(x) === b.key));
      if (common.length) shared.push({ pair: [a.name, b.name], deals_together: common.length, examples: sortRecent(common).slice(0, 4).map((d) => `${d.company} (${d.stage_raw || "NC"}, ${d.date})`) });
    }
    return { compared: rows, not_found: missing.map((n) => ({ name: n, did_you_mean: didYouMean(n, 3) })), co_investments: shared };
  }

  // ---- Réseau de co-investissement --------------------------------------------------------------
  function coInvestors(o = {}) {
    const e = entFuzzy(o.investor);
    if (!e) return null;
    const secs = o.sector ? resolveSectors(o.sector).concat([o.sector]).map(norm) : null;
    const st = resolveStage(o.stage);
    const ds = e.deals.filter((d) => (!o.since || d.date >= o.since) && (!secs || secs.includes(norm(d.sector_raw))) && (!st || d.stage_raw === st));
    const co = new Map();
    ds.forEach((d) => new Set(d.investors.map(core)).forEach((k) => { if (!k || k === e.key || isGeneric(k)) return; const r = co.get(k) || co.set(k, { deals: [] }).get(k); r.deals.push(d); }));
    const list = [...co.entries()].map(([k, r]) => { const ce = ENT.get(k); const raw = r.deals[0].investors.find((x) => core(x) === k); return { name: ce ? ce.name : raw, type: ce ? entType(ce) : null, deals_together: r.deals.length, share_of_deals: Math.round((r.deals.length / ds.length) * 100), has_deploying_fund: !!(ce && ce.vehicles.length), examples: sortRecent(r.deals).slice(0, 3).map((d) => `${d.company} (${d.stage_raw || "NC"}, ${d.amount_eur_m ?? "n.c."} M€, ${d.date})`) }; })
      .sort((a, b) => b.deals_together - a.deals_together);
    return { investor: e.name, deals_considered: ds.length, co_investors: list.slice(0, o.limit || 20), solo_deals: ds.filter((d) => d.investors.filter((x) => !isGeneric(x)).length <= 1).length };
  }

  // ---- Qui finance le tour suivant ? ----------------------------------------------------------
  // Pour les startups ayant levé au stade donné, investisseurs entrés au tour d'après.
  function followOnInvestors(o = {}) {
    const st = resolveStage(o.stage) || "Seed";
    const secs = o.sector ? resolveSectors(o.sector).concat([o.sector]).map(norm) : null;
    const byCo = new Map();
    D.forEach((d) => (byCo.get(norm(d.company)) || byCo.set(norm(d.company), []).get(norm(d.company))).push(d));
    const order = (d) => `${d.date || ""}-${String(d.day || 0).padStart(2, "0")}`;
    const newIn = new Map(), pairs = [];
    let gaps = [];
    for (const rounds of byCo.values()) {
      rounds.sort((a, b) => order(a).localeCompare(order(b)));
      for (let i = 0; i < rounds.length - 1; i++) {
        const a = rounds[i], b = rounds[i + 1];
        if (a.stage_raw !== st || (secs && !secs.includes(norm(a.sector_raw)))) continue;
        const before = new Set(a.investors.map(core));
        const fresh = b.investors.filter((x) => !isGeneric(x) && !before.has(core(x)));
        const kept = b.investors.filter((x) => !isGeneric(x) && before.has(core(x)));
        const [ya, ma] = a.date.split("-").map(Number), [yb, mb] = b.date.split("-").map(Number);
        gaps.push((yb - ya) * 12 + (mb - ma));
        pairs.push({ company: a.company, from: `${a.stage_raw} ${a.amount_eur_m ?? "n.c."} M€ (${a.date})`, to: `${b.stage_raw || "NC"} ${b.amount_eur_m ?? "n.c."} M€ (${b.date})`, new_investors: fresh, insiders_reinvesting: kept });
        fresh.forEach((x) => { const k = core(x); const r = newIn.get(k) || newIn.set(k, { name: x, n: 0, cos: [] }).get(k); r.n++; r.cos.push(a.company); });
      }
    }
    return {
      from_stage: st, sector: o.sector || null, companies_with_next_round: pairs.length, median_months_between_rounds: median(gaps),
      top_new_investors_next_round: [...newIn.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, o.limit || 15).map(([k, r]) => { const e = ENT.get(k); return { name: e ? e.name : r.name, companies: r.n, examples: r.cos.slice(0, 4), has_deploying_fund: !!(e && e.vehicles.length) }; }),
      insider_reinvest_rate: pairs.length ? Math.round((pairs.filter((p) => p.insiders_reinvesting.length).length / pairs.length) * 100) : null,
      examples: pairs.slice(-8).reverse(),
    };
  }

  // ---- Tendances par secteur : période récente vs période précédente ---------------------------
  function sectorTrends(o = {}) {
    const n = o.months || 6;
    const recentFrom = ymAdd(LATEST, -(n - 1)), prevFrom = ymAdd(LATEST, -(2 * n - 1)), prevTo = ymAdd(LATEST, -n);
    const st = resolveStage(o.stage);
    const pick = (from, to) => D.filter((d) => d.date >= from && d.date <= to && (!st || d.stage_raw === st));
    const R = pick(recentFrom, LATEST), P = pick(prevFrom, prevTo);
    const agg = (arr) => arr.reduce((m, d) => { const k = d.sector_raw || "Autre"; const x = m[k] || (m[k] = { deals: 0, amt: 0, amts: [] }); x.deals++; if (d.amount_eur_m != null) { x.amt += d.amount_eur_m; x.amts.push(d.amount_eur_m); } return m; }, {});
    const a = agg(R), b = agg(P);
    const pct = (x, y) => (y ? Math.round(((x - y) / y) * 100) : null);
    const rows = [...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => {
      const x = a[k] || { deals: 0, amt: 0, amts: [] }, y = b[k] || { deals: 0, amt: 0, amts: [] };
      return { sector: k, deals: x.deals, deals_previous: y.deals, deals_change_pct: pct(x.deals, y.deals), amount_eur_m: Math.round(x.amt), amount_previous_eur_m: Math.round(y.amt), amount_change_pct: pct(x.amt, y.amt), median_round_eur_m: median(x.amts), median_previous_eur_m: median(y.amts) };
    }).filter((r) => r.deals + r.deals_previous >= (o.min_deals || 3));
    const momentum = (r) => (r.deals - r.deals_previous) + (r.amount_eur_m - r.amount_previous_eur_m) / 50;
    rows.sort(o.sort === "amount" ? (x, y) => y.amount_eur_m - x.amount_eur_m : o.sort === "deals" ? (x, y) => y.deals - x.deals : (x, y) => momentum(y) - momentum(x));
    return {
      recent_period: { from: recentFrom, to: LATEST }, previous_period: { from: prevFrom, to: prevTo }, stage: st || "tous",
      totals: { deals: R.length, deals_previous: P.length, deals_change_pct: pct(R.length, P.length), amount_eur_m: Math.round(R.reduce((s, d) => s + (d.amount_eur_m || 0), 0)), amount_previous_eur_m: Math.round(P.reduce((s, d) => s + (d.amount_eur_m || 0), 0)) },
      accelerating: rows.filter((r) => r.deals_change_pct != null && r.deals_change_pct > 0).slice(0, 5).map((r) => r.sector),
      slowing: rows.slice().reverse().filter((r) => r.deals_change_pct != null && r.deals_change_pct < 0).slice(0, 5).map((r) => r.sector),
      sectors: rows.slice(0, o.limit || 25),
    };
  }

  // ---- Acquéreurs probables pour une startup ou un secteur ---------------------------------------
  function likelyAcquirers(o = {}) {
    let sector = o.sector, company = null;
    if (o.startup) { const s = startupFuzzy(o.startup); if (s) { company = s.name; sector = sector || s.sector; } }
    if (!sector) return null;
    const secs = resolveSectors(sector).concat([sector]).map(norm);
    const inSec = OPS.filter((x) => secs.some((s) => norm(x.sector_raw).includes(s) || s.includes(norm(x.sector_raw))));
    const by = new Map();
    inSec.forEach((x) => { if (!x.acquirer || /^(nd|nc|n d|n c|non communique.*|non divulgue.*|inconnu|undisclosed)$/.test(norm(x.acquirer))) return; const k = norm(x.acquirer); const r = by.get(k) || by.set(k, { name: x.acquirer, ops: [] }).get(k); r.ops.push(x); });
    const list = [...by.values()].map((r) => {
      const last = r.ops.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
      const total = (BUY.get(norm(r.name)) || r).ops.length;
      return { acquirer: r.name, deals_in_sector: r.ops.length, total_acquisitions: total, last_deal: `${last.target} (${last.type}, ${last.date})`, types: [...new Set(r.ops.map((x) => x.type))], disclosed_eur_m: Math.round(r.ops.reduce((s, x) => s + (x.amount_eur_m || 0), 0)) || null, serial_acquirer: total >= 3 };
    }).sort((a, b) => b.deals_in_sector - a.deals_in_sector || b.total_acquisitions - a.total_acquisitions);
    const amts = inSec.map((x) => x.amount_eur_m).filter((v) => v != null);
    return {
      startup: company, sector, operations_in_sector: inSec.length, disclosed_deal_values_eur_m: amts.length ? { count: amts.length, median: median(amts), max: Math.max(...amts) } : null,
      by_type: tally(inSec, (x) => x.type).map(([k, n]) => ({ type: k, count: n })),
      acquirers: list.slice(0, o.limit || 15), recent_operations: inSec.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 8).map((x) => `${x.target} → ${x.acquirer} (${x.type}, ${x.date}${x.amount_eur_m ? ", " + x.amount_eur_m + " M€" : ""})`),
    };
  }

  // ---- Dossier de levée en un appel ----------------------------------------------------------
  function fundraisingBrief(o = {}) {
    const sector = o.sector || resolveSectors(o.description || "")[0] || null;
    const st = resolveStage(o.stage);
    const comps = comparables({ sector, stage: st, amount_eur_m: o.amount_eur_m, limit: 6 });
    const shortlist = findInvestors({ description: o.description, sector, stage: st, amount_eur_m: o.amount_eur_m }).slice(0, o.limit || 10);
    const trend = sector ? sectorTrends({ months: 6, min_deals: 1 }).sectors.find((r) => resolveSectors(sector).concat([sector]).some((s) => norm(s) === norm(r.sector))) || null : null;
    const next = st ? followOnInvestors({ stage: st, sector, limit: 8 }) : null;
    const eu = matchEuropeanFunds({ description: o.description || sector || "", stage: st, raise_eur_m: o.amount_eur_m }).filter((m) => m.country !== "France").slice(0, 5)
      .map((m) => ({ name: m.name, country: m.country, size: m.size, score: m.score, invests_in_france: m.invests_in_france }));
    return {
      inputs: { description: o.description || null, sector, stage: st, amount_eur_m: o.amount_eur_m ?? null },
      market: { comparables: { deals: comps.deals, p25_eur_m: comps.p25_eur_m, median_eur_m: comps.median_eur_m, p75_eur_m: comps.p75_eur_m, your_percentile: comps.your_percentile ?? null, closest_deals: comps.closest_deals }, sector_trend_6m: trend },
      investor_shortlist: shortlist.map((x) => ({ score: x.score, name: x.investor.name, type: x.investor.type, deploying: x.investor.deploying_vehicles, reasons: x.reasons, example_deals: x.example_deals })),
      european_funds_outside_france: eu,
      next_round_view: next ? { median_months_to_next_round: next.median_months_between_rounds, insider_reinvest_rate_pct: next.insider_reinvest_rate, typical_next_round_investors: next.top_new_investors_next_round.slice(0, 6).map((x) => x.name) } : null,
      next_steps: ["get_investor sur les 3 à 5 premiers de la shortlist", "compare_investors pour départager", "co_investors sur le lead pressenti pour compléter le tour"],
    };
  }

  return {
    meta: { ...INS.meta, latest: LATEST, since_12m: SINCE12, investors_indexed: ENT.size, managers_with_deploying_fund: [...ENT.values()].filter((e) => e.vehicles.length).length, foreign_vehicles_set_aside: [...ENT.values()].reduce((s, e) => s + e.foreign.length, 0), acquirers: BUY.size, weekly_deals_window: { from: WEEK_START, to: LATEST_DAY }, new_deals_this_week: D.filter(isNew).length },
    searchEuropeanFunds, matchEuropeanFunds, getEuropeanFund, europeStats,
    businessAngels: (o = {}) => { const q = norm(o.query || ""); return [...ENT.values()].filter((e) => isPerson(e) && (!q || norm([e.name, e.deals.map((d) => d.company + " " + d.sector_raw).join(" ")].join(" ")).includes(q)))
      .sort((a, b) => b.deals.length - a.deals.length).map((e) => ({ ...entBrief(e), tag: "Business Angel", sectors: [...new Set(e.deals.map((d) => d.sector_raw))].slice(0, 5), recent_deals: e.deals.slice().sort((x, y) => (y.date || "").localeCompare(x.date || "")).slice(0, 5).map(dealOut) })); },
    internationalFunds: (o = {}) => [...ENT.values()].filter((e) => e.intl && (!o.country || norm(e.intl.country).includes(norm(o.country))) && (!o.type || norm(e.intl.type).includes(norm(o.type))))
      .sort((a, b) => b.deals.length - a.deals.length || a.name.localeCompare(b.name))
      .map((e) => { const last = e.deals.slice().sort((x, y) => (y.date || "").localeCompare(x.date || ""))[0]; return { name: e.name, ...intlOut(e.intl), french_deals: e.deals.length, french_deals_last_12m: e.n12, last_french_deal: last ? dealOut(last) : null }; }),
    searchDeals, dealOut, getStartup, getInvestor, listInvestors, entBrief, findInvestors, deployingFunds, topInvestors, comparables, exits, getAcquirer, peWatch, overview, globalSearch, fetchDoc,
    whatsNew, compareInvestors, coInvestors, followOnInvestors, sectorTrends, likelyAcquirers, fundraisingBrief, lastUpdate, didYouMean,
    getInvestorFuzzy: (n) => { const e = entFuzzy(n); return e ? getInvestor(e.name) : null; }, getStartupFuzzy: startupFuzzy, getAcquirerFuzzy: acquirerFuzzy, getEuropeanFundFuzzy: europeanFuzzy,
  };
}

module.exports = { build, resolveSectors, resolveStage, ymAdd };
