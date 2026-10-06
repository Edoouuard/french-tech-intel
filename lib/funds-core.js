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
