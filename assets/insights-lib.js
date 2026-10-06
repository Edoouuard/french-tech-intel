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
    const dd = dedupeDeals(deals), od = dedupeOps(ops);
    const last = dd.kept[0] && dd.kept[0].date;
    return {
      meta: {
        source: "Insights French Tech", url: SOURCE_URL, fetched_at: fetchedAt || new Date().toISOString(), latest_deal_month: last,
        counts: { deals: dd.kept.length, operations: od.kept.length, investors: investors.length, startups: startups.length, pe: pe.length },
        duplicates_merged: { deals: dd.merged, operations: od.merged }, scope: "France uniquement",
      },
      deals: dd.kept, operations: od.kept, investors, pe, startups,
    };
  }

  // ---- Doublons ------------------------------------------------------------------------------
  // Les mises à jour hebdomadaires ajoutent parfois une même opération plusieurs fois (ressaisie,
  // graphie différente, acquéreur « ND » puis nommé). On fusionne à la lecture, sans toucher aux
  // données sources : la fiche la plus complète est gardée et complétée par les autres.
  const filled = (o) => Object.values(o).filter((v) => v != null && v !== "" && !(Array.isArray(v) && !v.length)).length;
  const ymNum = (ym) => (ym ? +ym.slice(0, 4) * 12 + +ym.slice(5, 7) : null);
  const GENERIC_ACQ = /^(nd|nc|n d|n c|non communique.*|non divulgue.*|inconnu|undisclosed|acquereur.*)$/;
  const firmKey = (s) => norm(String(s || "").replace(/\(.*?\)/g, " ")).replace(/^(groupe|group|groupement) /, "").trim();
  function mergeInto(best, others) {
    const out = { ...best };
    for (const o of others) for (const [k, v] of Object.entries(o)) {
      if (k === "id") continue;
      if (out[k] == null || out[k] === "" || (Array.isArray(out[k]) && !out[k].length)) out[k] = v;
      else if (k === "investors" && Array.isArray(v)) out[k] = [...new Set([...out[k], ...v])];
    }
    return out;
  }
  function groupBy(list, same) {
    const groups = [];
    for (const x of list) {
      const g = groups.find((gr) => gr.some((y) => same(x, y)));
      g ? g.push(x) : groups.push([x]);
    }
    return groups;
  }
  function dedupeOps(ops) {
    const byTarget = new Map();
    for (const o of ops) { const k = firmKey(o.target); (byTarget.get(k) || byTarget.set(k, []).get(k)).push(o); }
    const kept = []; let merged = 0;
    for (const list of byTarget.values()) {
      const groups = groupBy(list, (a, b) => {
        const ka = firmKey(a.acquirer), kb = firmKey(b.acquirer);
        return ka === kb || GENERIC_ACQ.test(ka) || GENERIC_ACQ.test(kb) || ka.startsWith(kb + " ") || kb.startsWith(ka + " ");
      });
      for (const g of groups) {
        if (g.length === 1) { kept.push(g[0]); continue; }
        // Priorité : acquéreur nommé, puis fiche la plus remplie, puis la plus récente.
        const ranked = g.slice().sort((a, b) => (GENERIC_ACQ.test(firmKey(a.acquirer)) - GENERIC_ACQ.test(firmKey(b.acquirer))) || filled(b) - filled(a) || (b.date || "").localeCompare(a.date || ""));
        kept.push(mergeInto(ranked[0], ranked.slice(1)));
        merged += g.length - 1;
      }
    }
    return { kept: kept.sort((a, b) => (b.date || "").localeCompare(a.date || "")), merged };
  }
  function dedupeDeals(deals) {
    const byCo = new Map();
    for (const d of deals) { const k = norm(d.company).replace(/\s+/g, ""); (byCo.get(k) || byCo.set(k, []).get(k)).push(d); }
    const kept = []; let merged = 0;
    for (const list of byCo.values()) {
      const groups = groupBy(list, (a, b) => {
        if (a.amount_eur_m == null || b.amount_eur_m == null) return false;
        const sameAmt = Math.abs(a.amount_eur_m - b.amount_eur_m) <= 0.15 * Math.max(a.amount_eur_m, b.amount_eur_m);
        const gap = Math.abs(ymNum(a.date) - ymNum(b.date));
        const sameStage = !a.stage_raw || !b.stage_raw || a.stage_raw === b.stage_raw;
        // Même montant (±15 %) et même stade : doublon si les dates sont proches, ou si le montant est identique.
        return sameAmt && sameStage && (gap <= 3 || a.amount_eur_m === b.amount_eur_m);
      });
      for (const g of groups) {
        if (g.length === 1) { kept.push(g[0]); continue; }
        // La plus complète gagne ; à égalité, la première annonce (date la plus ancienne).
        const ranked = g.slice().sort((a, b) => filled(b) - filled(a) || (a.date || "").localeCompare(b.date || ""));
        kept.push(mergeInto(ranked[0], ranked.slice(1)));
        merged += g.length - 1;
      }
    }
    return { kept: kept.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.day || 0) - (a.day || 0)), merged };
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

// Insights French Tech — moteur de recherche et de matching des fonds VC européens (site + serveur MCP).
// Aucune dépendance. Fonctionne en Node (CommonJS) et dans le navigateur (window.FundsCore).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FundsCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9€$.\s/-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const COUNTRIES = {
    France: ["france", "francais", "francaise", "french", "fr", "paris"],
    Allemagne: ["allemagne", "germany", "german", "allemand", "allemands", "de", "berlin", "munich", "dach"],
    "Pays-Bas": ["pays-bas", "pays bas", "netherlands", "dutch", "neerlandais", "nl", "amsterdam", "holland", "hollande"],
    Belgique: ["belgique", "belgium", "belge", "belgian", "be", "bruxelles", "brussels"],
    Suisse: ["suisse", "switzerland", "swiss", "ch", "zurich", "geneve", "geneva", "lausanne", "dach"],
    Autriche: ["autriche", "austria", "austrian", "autrichien", "at", "vienne", "vienna", "dach"],
    Luxembourg: ["luxembourg", "lux", "lu"],
    Irlande: ["irlande", "ireland", "irish", "ie", "dublin"],
    Monaco: ["monaco", "mc"],
  };
  const COUNTRY_CODE = { France: "FR", Allemagne: "DE", "Pays-Bas": "NL", Belgique: "BE", Suisse: "CH", Autriche: "AT", Luxembourg: "LU", Irlande: "IE", Monaco: "MC" };

  const STAGES = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Growth", "Late Stage"];
  const STAGE_ALIASES = {
    "Pre-Seed": ["pre-seed", "pre seed", "preseed", "pre-amorcage", "pre amorcage", "idea", "idee"],
    Seed: ["seed", "amorcage"],
    "Series A": ["series a", "serie a", "series-a", "round a", "tour a"],
    "Series B": ["series b", "serie b", "series-b", "tour b"],
    "Series C": ["series c", "serie c", "tour c"],
    Growth: ["growth", "croissance", "scale-up", "scaleup", "expansion"],
    "Late Stage": ["late stage", "late-stage", "pre-ipo", "pre ipo"],
  };
  const STAGE_ORDER = Object.fromEntries(STAGES.map((s, i) => [s, i]));

  const SECTOR_ALIASES = {
    AI: ["ai", "ia", "intelligence artificielle", "artificial intelligence", "machine learning", "ml", "llm", "genai", "agents", "agentic"],
    SaaS: ["saas", "software", "logiciel", "b2b software"],
    Climate: ["climate", "climat", "climatech", "climate tech", "cleantech", "decarbonation", "decarbonisation", "net zero", "impact", "carbone", "carbon", "co2", "emissions"],
    DeepTech: ["deeptech", "deep tech", "hardtech", "quantum", "quantique", "photonics", "photonique"],
    DigitalHealth: ["digital health", "digitalhealth", "sante numerique", "e-sante", "esante", "healthtech", "health tech", "sante"],
    Enterprise: ["enterprise", "entreprise", "b2b"],
    Robotics: ["robotics", "robotique", "robots", "robot", "automation", "automatisation"],
    Biotech: ["biotech", "biotechnologie", "life sciences", "sciences de la vie", "bio"],
    Cyber: ["cyber", "cybersecurity", "cybersecurite", "securite", "security"],
    Manufacturing: ["manufacturing", "industrie", "industry", "industrial", "industriel", "usine"],
    Energy: ["energy", "energie", "energetique", "electricite", "electricity", "renewables", "renouvelable", "batteries", "batterie", "hydrogene", "hydrogen"],
    Mobility: ["mobility", "mobilite", "transport", "automotive", "auto", "ev"],
    FinTech: ["fintech", "finance", "insurtech", "banking", "paiement", "payments"],
    MedTech: ["medtech", "medical devices", "dispositifs medicaux", "medical"],
    "E-Commerce": ["e-commerce", "ecommerce", "retail", "commerce"],
    Space: ["space", "spatial", "spacetech", "satellite", "satellites"],
    Defense: ["defense", "defence", "dual-use", "dual use", "militaire", "souverainete"],
    AgTech: ["agtech", "agritech", "agriculture", "agri"],
    FoodTech: ["foodtech", "food", "alimentation", "alimentaire"],
    Circular: ["circular", "circulaire", "recyclage", "recycling", "waste", "dechets"],
    IoT: ["iot", "internet of things", "objets connectes"],
    "Supply Chain": ["supply chain", "logistique", "logistics"],
    Semiconductors: ["semiconductors", "semiconducteurs", "semis", "chips", "puces"],
    EdTech: ["edtech", "education", "formation"],
    Therapeutics: ["therapeutics", "therapeutique", "drug", "pharma"],
    Consumer: ["consumer", "b2c", "grand public"],
    "Web3 Infrastructure": ["web3", "crypto", "blockchain"],
  };

  // Recherche d'un alias en mot entier dans un texte normalisé.
  const hasWord = (text, alias) => {
    const a = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("(^|[^a-z0-9])" + a + "s?($|[^a-z0-9])").test(text);
  };

  const fundText = (f) =>
    norm([f.name, f.country, f.stage, (f.sectors || []).join(" "), f.thesis, f.geo_scope, f.signals, f.lps, (f.people || []).join(" "), f.roles].join(" "));

  function canonicalCountry(v) {
    const n = norm(v);
    for (const [c, al] of Object.entries(COUNTRIES)) if (norm(c) === n || al.includes(n) || COUNTRY_CODE[c].toLowerCase() === n) return c;
    return null;
  }
  function canonicalStage(v) {
    const n = norm(v);
    for (const [s, al] of Object.entries(STAGE_ALIASES)) if (norm(s) === n || al.includes(n)) return s;
    return null;
  }
  function canonicalSector(v) {
    const n = norm(v);
    for (const [s, al] of Object.entries(SECTOR_ALIASES)) if (norm(s) === n || al.includes(n)) return s;
    return v; // secteur libre conservé tel quel
  }

  // ---- Langage naturel -> filtres structurés -------------------------------------------
  function parseQuery(q) {
    const raw = String(q || "");
    let t = " " + norm(raw) + " ";
    const filters = { countries: [], stages: [], sectors: [], text: "" };

    // Montants : "> 100M", "plus de 200 M€", "moins de 50M", "ticket < 1M", "lever 2M"
    const num = "(\\d+(?:[.,]\\d+)?)\\s*(k|m|b|md|mds|millions?|milliards?)?\\s*(?:€|eur|euros|\\$)?";
    const toM = (n, u) => {
      n = parseFloat(String(n).replace(",", "."));
      u = (u || "m").toLowerCase();
      if (u === "k") return n / 1000;
      if (u === "b" || u.startsWith("md") || u.startsWith("milliard")) return n * 1000;
      return n;
    };
    const tk = t.match(new RegExp("(?:ticket|cheque|chèque|investissement initial|lever|leve|raise|raising|round de|tour de)\\s*(?:de|d un|of|a|<|>|~|environ|max|min)?\\s*" + num));
    if (tk) {
      filters.raise_eur_m = toM(tk[1], tk[2]);
      t = t.replace(tk[0], " ");
    }
    const gt = t.match(new RegExp("(?:>|>=|plus de|au moins|over|above|more than|superieur a|min(?:imum)?)\\s*" + num));
    if (gt) {
      filters.min_size_eur_m = toM(gt[1], gt[2]);
      t = t.replace(gt[0], " ");
    }
    const lt = t.match(new RegExp("(?:<|<=|moins de|under|below|less than|inferieur a|max(?:imum)?)\\s*" + num));
    if (lt) {
      filters.max_size_eur_m = toM(lt[1], lt[2]);
      t = t.replace(lt[0], " ");
    }

    for (const [c, al] of Object.entries(COUNTRIES)) {
      if (al.some((a) => a.length > 2 && hasWord(t, a)) || hasWord(t, norm(c))) {
        filters.countries.push(c);
      }
    }
    // Stades (pre-seed avant seed pour éviter le double comptage)
    let ts = t;
    for (const s of STAGES) {
      const al = [norm(s), ...STAGE_ALIASES[s]].sort((a, b) => b.length - a.length);
      const hit = al.find((a) => hasWord(ts, a));
      if (hit) {
        filters.stages.push(s);
        ts = ts.replace(hit, " ");
      }
    }
    for (const [s, al] of Object.entries(SECTOR_ALIASES)) {
      if ([norm(s), ...al].some((a) => (a.length > 2 || a === "ai" || a === "ia" || a === "ml" || a === "ev") && hasWord(t, a))) filters.sectors.push(s);
    }
    if (/\b(ticket|tickets)\b/.test(t) && filters.raise_eur_m == null) filters.has_ticket = true;
    if (/\b(lp|lps|limited partners?)\b/.test(t)) filters.has_lps = true;

    // Mots restants utiles pour la recherche plein texte
    const STOP = new Set("je tu il nous vous ils un une des les le la de du d l et ou en au aux a pour par avec sur dans qui que quoi quel quels quelle quelles fonds fund funds vc investisseurs investisseur investors investor investit investissent invest invests trouve trouver trouves find show montre moi me liste list donne cherche search the of in for with and or to qui est sont actifs actif europe europeen europeens european capital venture ventures startup startups societe stade stage secteur sector pays country m eur euros".split(" "));
    const used = new Set([...filters.countries.flatMap((c) => COUNTRIES[c]), ...filters.stages.flatMap((s) => STAGE_ALIASES[s]), ...filters.sectors.flatMap((s) => SECTOR_ALIASES[s].concat(norm(s)))].flatMap((x) => x.split(" ")));
    filters.text = t
      .split(" ")
      .filter((w) => w.length > 2 && !STOP.has(w) && !used.has(w) && !/^\d/.test(w))
      .join(" ");
    return filters;
  }

  // ---- Recherche structurée ------------------------------------------------------------
  function search(funds, opts = {}) {
    const countries = (opts.countries || []).map(canonicalCountry).filter(Boolean);
    const stages = (opts.stages || []).map(canonicalStage).filter(Boolean);
    const sectors = (opts.sectors || []).map(canonicalSector).filter(Boolean);
    const terms = norm(opts.text || opts.query || "").split(" ").filter((w) => w.length > 1);
    const out = [];
    for (const f of funds) {
      if (countries.length && !countries.includes(f.country)) continue;
      if (stages.length && !stages.includes(f.stage)) continue;
      if (opts.min_size_eur_m != null && !(f.size_eur_m >= opts.min_size_eur_m)) continue;
      if (opts.max_size_eur_m != null && !(f.size_eur_m != null && f.size_eur_m <= opts.max_size_eur_m)) continue;
      if (opts.has_ticket && !f.ticket) continue;
      if (opts.has_lps && !f.lps) continue;
      if (opts.consolidated_only && f.consolidation !== "full") continue;
      let score = 0;
      const why = [];
      if (sectors.length) {
        const hits = sectors.filter((s) => (f.sectors || []).includes(s) || hasWord(norm(f.thesis), norm(s)));
        if (!hits.length && opts.sector_mode !== "any_or_text") continue;
        if (!hits.length) continue;
        score += hits.length * 10;
        why.push("secteur " + hits.join(", "));
      }
      if (opts.raise_eur_m != null && f.ticket_min_eur_m != null) {
        const r = opts.raise_eur_m;
        if (r >= f.ticket_min_eur_m * 0.5 && r <= f.ticket_max_eur_m * 3) {
          score += 12;
          why.push("ticket compatible (" + f.ticket + ")");
        }
      }
      if (terms.length) {
        const txt = fundText(f);
        const hits = terms.filter((w) => txt.includes(w));
        if (!hits.length && !sectors.length && !countries.length && !stages.length) continue;
        score += hits.length * 4;
        if (norm(f.name).includes(terms.join(" "))) score += 40;
        if (hits.length) why.push("mentionne « " + hits.join(", ") + " »");
      }
      if (countries.length) why.push(f.country);
      if (stages.length) why.push(f.stage);
      if (f.consolidation === "full") score += 2;
      if (f.thesis) score += 1;
      out.push({ fund: f, score, why });
    }
    const sort = opts.sort || "relevance";
    out.sort((a, b) =>
      sort === "size_desc" ? (b.fund.size_eur_m || 0) - (a.fund.size_eur_m || 0)
      : sort === "size_asc" ? (a.fund.size_eur_m || 1e9) - (b.fund.size_eur_m || 1e9)
      : sort === "name" ? a.fund.name.localeCompare(b.fund.name)
      : b.score - a.score || (b.fund.size_eur_m || 0) - (a.fund.size_eur_m || 0)
    );
    return out;
  }

  // ---- Matching startup <-> fonds -------------------------------------------------------
  // Score sur 100 : stade (30), secteur (30), géographie (15), ticket (15), complétude (10).
  // `activity` (optionnel) : f => { n12, last } issu d'Insights French Tech ; un gestionnaire qui
  // vient d'investir en France gagne jusqu'à 8 points, plafonnés à 100.
  function matchStartup(funds, s = {}, activity) {
    const stage = s.stage ? canonicalStage(s.stage) : null;
    const country = s.country ? canonicalCountry(s.country) : null;
    let sectors = (s.sectors || []).map(canonicalSector);
    if (s.description) sectors = [...new Set(sectors.concat(parseQuery(s.description).sectors))];
    const descTerms = norm(s.description || "").split(" ").filter((w) => w.length > 4);
    const res = funds.map((f) => {
      let score = 0;
      const why = [];
      const flags = [];
      if (stage && f.stage) {
        const d = Math.abs(STAGE_ORDER[stage] - STAGE_ORDER[f.stage]);
        const pts = d === 0 ? 30 : d === 1 ? 15 : 0;
        score += pts;
        if (pts) why.push(d === 0 ? "stade exact (" + f.stage + ")" : "stade adjacent (" + f.stage + ")");
      } else score += 10;
      if (sectors.length) {
        const hits = sectors.filter((x) => (f.sectors || []).includes(x));
        const thesisHits = sectors.filter((x) => !hits.includes(x) && hasWord(norm(f.thesis), norm(x)));
        const pts = Math.min(30, hits.length * 18 + thesisHits.length * 10);
        score += pts;
        if (hits.length) why.push("secteurs " + hits.join(", "));
        if (thesisHits.length) why.push("thèse mentionne " + thesisHits.join(", "));
      }
      const txt = fundText(f);
      const kw = descTerms.filter((w) => txt.includes(w)).slice(0, 4);
      if (kw.length) {
        score += Math.min(8, kw.length * 2);
        why.push("mots-clés : " + kw.join(", "));
      }
      if (country) {
        const scope = norm(f.geo_scope);
        if (f.country === country) { score += 15; why.push("basé en " + country); }
        else if (/europe|pan-europe|eu /.test(scope + " ")) { score += 10; why.push("scope européen"); }
        else if (/dach/.test(scope) && ["Allemagne", "Suisse", "Autriche"].includes(country)) { score += 12; why.push("scope DACH"); }
      } else score += 7;
      if (s.raise_eur_m != null && f.ticket_min_eur_m != null) {
        const r = s.raise_eur_m;
        if (r >= f.ticket_min_eur_m && r <= f.ticket_max_eur_m * 2) { score += 15; why.push("ticket " + f.ticket); }
        else if (r >= f.ticket_min_eur_m * 0.3 && r <= f.ticket_max_eur_m * 4) { score += 7; why.push("ticket proche (" + f.ticket + ")"); }
        else flags.push("ticket hors fourchette (" + f.ticket + ")");
      } else if (s.raise_eur_m != null && f.size_eur_m) {
        // Heuristique : ticket initial ≈ 1–5 % de la taille du fonds
        const lo = f.size_eur_m * 0.005, hi = f.size_eur_m * 0.06;
        if (s.raise_eur_m >= lo && s.raise_eur_m <= hi * 3) { score += 6; why.push("taille de fonds cohérente"); }
      }
      if (f.consolidation === "full") score += 6;
      if (f.people && f.people.length) score += 2;
      if (f.thesis) score += 2;
      const act = activity && activity(f);
      if (act && act.n12) {
        score += Math.min(8, 3 + act.n12);
        why.push(`actif en France : ${act.n12} deal${act.n12 > 1 ? "s" : ""} sur 12 mois${act.last ? " (dernier : " + act.last + ")" : ""}`);
      }
      if (f.consolidation !== "full") flags.push("fiche partiellement consolidée");
      if (f.caveats && /contredit|contamin|namesake|non prouv/i.test(f.caveats)) flags.push("réserve : " + f.caveats);
      return { fund: f, score: Math.min(100, Math.round(score)), why, flags };
    });
    return res.filter((r) => r.score >= (s.min_score || 35)).sort((a, b) => b.score - a.score);
  }

  // ---- Statistiques ---------------------------------------------------------------------
  function stats(funds, groupBy = "country") {
    const g = {};
    for (const f of funds) {
      const keys = groupBy === "sector" ? (f.sectors.length ? f.sectors : ["Non renseigné"]) : [f[groupBy] || "Non renseigné"];
      for (const k of keys) {
        g[k] = g[k] || { key: k, funds: 0, capital_eur_m: 0, sized: 0, sizes: [] };
        g[k].funds++;
        if (f.size_eur_m) { g[k].capital_eur_m += f.size_eur_m; g[k].sized++; g[k].sizes.push(f.size_eur_m); }
      }
    }
    return Object.values(g)
      .map((x) => {
        const s = x.sizes.sort((a, b) => a - b);
        const med = s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
        return { key: x.key, funds: x.funds, capital_eur_m: Math.round(x.capital_eur_m), median_size_eur_m: med, sized_funds: x.sized };
      })
      .sort((a, b) => b.funds - a.funds);
  }

  const fmtM = (m) => (m == null ? "—" : m >= 1000 ? "€" + (m / 1000).toFixed(m >= 10000 ? 0 : 1).replace(".0", "") + "B" : m >= 1 ? "€" + Math.round(m) + "M" : "€" + Math.round(m * 1000) + "k");

  // Fiche compacte pour les réponses d'agent
  function brief(f) {
    return {
      id: f.id, name: f.name, country: f.country, stage: f.stage, size: f.size_label, sectors: f.sectors,
      thesis: f.thesis, ticket: f.ticket, geo_scope: f.geo_scope, people: (f.people || []).slice(0, 5), url: f.url,
      consolidation: f.consolidation,
    };
  }

  return { norm, parseQuery, search, matchStartup, stats, brief, fmtM, canonicalCountry, canonicalStage, canonicalSector, STAGES, COUNTRY_CODE, SECTOR_ALIASES };
});

// Détection des investisseurs individuels (business angels) : un nom de personne commence par un
// prénom connu, compte 2 à 4 mots et ne contient aucun mot d'organisation.
// Fonctionne en Node (CommonJS) et dans le navigateur (window.PeopleDetect).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PeopleDetect = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const strip = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const FIRST = new Set(`xavier thomas nicolas jean pierre philippe olivier frederic francois julien antoine alexandre stephane laurent marc michel patrick christophe vincent guillaume sebastien romain maxime mathieu matthieu david charles paul louis arthur hugo clement florian benjamin jerome fabrice eric thibaud thibault quentin adrien simon raphael gabriel bruno denis didier emmanuel edouard alain andre bernard yann yves cedric damien arnaud bertrand benoit cyril fabien franck gregoire gilles henri jacques jeremy jonathan kevin lucas ludovic marie sophie julie claire anne camille celine charlotte chloe caroline delphine elise emma laure laura lea manon marine mathilde nathalie pauline sarah valerie virginie isabelle catherine helene agnes aurelie audrey alice amelie anais roxanne fanny juliette margaux clara ines karim mehdi mohamed rachid samir yassine ali ahmed omar mark michael john james peter richard robert william steve tony edward ben tom daniel alex chris andrew matt jeff jason brian ryan joe sam max felix jan lars niklas sven mathias gauthier herve rodolphe renaud sylvain thierry tristan victor wilfried yohan joel loic mickael pascal regis remi serge steven teddy timothee tanguy gael gaetan geoffroy gautier erwan etienne fabio francis frank gerard guy hadrien hugues igor ivan jordan joseph jules leo leon lionel lucien marcel martin maurice morgan nathan noel octave oscar pablo rafael rene roland ronan ruben sacha samuel stanislas sylvie theo tim ugo valentin yoann zoe brice baptiste bastien axel aurelien augustin alexis amaury anthony armand cecile corinne dominique elodie estelle eva florence frederique gaelle ingrid jeanne josephine lucie lydie magali marion melanie morgane muriel nadia nina oceane patricia rebecca sabrina sandrine severine solene stephanie sylviane tatiana veronique yasmine zineb fatima leila mariam hannah olivia jessica jennifer elizabeth kate katie emily amanda rachel nancy susan lisa anna maria elena giulia luca marco matteo alessandro giovanni andrea stefano carlos javier miguel diego juan pedro jorge luis fernando hans klaus jens jonas lukas tobias florent cyrille dimitri eliott elliot gregory harold jacky jimmy kenny marius maximilien nils noah oliver ralph reza roman sami sofiane taha tarek walid wassim yanis yannick youssef zakaria arash farid hicham hamza nabil reda riad sofian amine anas ayoub bilal ilyes imran ismail khalil mounir nassim othmane rayan redouane said ziad clotilde eleonore gwenaelle helena lou maud perrine quitterie solenne domitille capucine apolline diane constance blandine`.split(/\s+/));
  const ORG = /\b(capital|ventures?|invest\w*|fund|fonds|partners|group|groupe|holding|bank|banque|credit|caisse|angels?|club|region|sas?|gestion|equity|labs?|studio|foundation|fondation|corp|inc|ltd|gmbh|ag|bv|family|office|accelerat\w*|incubat\w*|bpi\w*|universit\w*|ecole|school|participations?|developpement|innovation|impact|vc|tech|management|assets?|finance|financiere|mutuel\w*|assurances?|insurance|global|international|network|collective|seed|growth|cvc|metropole|electricite|aviation|world|maison|etablissement|freres|active|croissance|littoral|machine|wise|guys|boss|graines|first|societe|generale|france|europe)\b/;
  function isPerson(name) {
    const raw = String(name || "").replace(/\(.*?\)/g, " ").trim();
    const n = strip(raw);
    if (!n || ORG.test(n)) return false;
    const words = n.split(/[\s]+/).filter(Boolean);
    if (words.length < 2 || words.length > 4) return false;
    const first = words[0].split("-")[0];
    return FIRST.has(first) || FIRST.has(words[0]);
  }
  return { isPerson };
});
