// Définition des outils MCP Insights French Tech, partagée par le serveur local (server.js)
// et la fonction hébergée (api/mcp.js). ctx = { M(): modèle, INS(): données, refresh?(), lastRefresh() }.
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");
let ctx; // contexte courant (un seul jeu de données par processus)

const NOTE = () => `Source : Insights French Tech (${ctx.INS().meta.url}), France uniquement, données jusqu'à ${ctx.INS().meta.latest_deal_month}. Montants en M€ tels qu'annoncés ; null = non communiqué.`;
const out = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }], structuredContent: obj });
const notFound = (what, q) => out({ error: `${what} introuvable pour « ${q} ».`, did_you_mean: ctx.M().didYouMean(q, 6), tip: "Essaie l'outil search avec un mot-clé plus court." });
const offset = z.number().int().min(0).optional().describe("Décalage pour paginer (défaut 0).");
// Pagination commune : renvoie la tranche demandée et de quoi demander la suivante.
const page = (r, a, d) => { const o = a.offset || 0, l = a.limit || d; return { total: r.length, offset: o, returned: Math.max(0, Math.min(l, r.length - o)), has_more: o + l < r.length, ...(o + l < r.length ? { next_offset: o + l } : {}), items: r.slice(o, o + l) }; };
const paged = (key, r, a, d, extra = {}) => { const { items, ...p } = page(r, a, d); return { ...p, ...extra, [key]: items }; };
const ym = z.string().regex(/^\d{4}-\d{2}$/).describe("Mois au format AAAA-MM.");
const lim = (d, max = 100) => z.number().int().min(1).max(max).optional().describe(`Nombre de résultats (défaut ${d}).`);

function createServer(c) {
  ctx = c;
  const s = new McpServer(
    { name: "insights-french-tech", version: "1.4.0" },
    {
      instructions:
        "Insights French Tech couvre l'écosystème startup français depuis janvier 2024 : ~1 400 levées, ~250 exits & M&A, ~450 investisseurs, 35 participations PE, et ~200 fonds VC européens en déploiement (thèse, ticket, LPs, équipe, activité en France). " +
        "Pour un fonds hors de France ou une recherche européenne : search_european_funds, match_european_funds, get_european_fund. " +
        "Pour aider une startup à lever : find_investors (classement), puis get_investor sur les meilleurs, et comparables pour situer le montant. " +
        "Pour préparer une levée en un appel : fundraising_brief, puis compare_investors pour départager et co_investors pour compléter le tour ; follow_on_investors montre qui finance le tour d'après. " +
        "Pour une veille : whats_new (dernière mise à jour du lundi 8 h), sector_trends, search_deals, top_investors, market_overview, exits_and_ma ; likely_acquirers pour une stratégie de sortie. " +
        "Les noms tolèrent les fautes de frappe. Les listes sont paginées (offset, limit, next_offset). Cite les montants comme « annoncés », jamais comme vérifiés.",
    }
  );
  // Tous les outils sont en lecture seule sur une base fermée.
  const reg = s.registerTool.bind(s);
  s.registerTool = (name, cfg, fn) => reg(name, { ...cfg, annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true, ...(cfg.annotations || {}) } }, fn);

  s.registerTool("search_deals", {
    title: "Rechercher des levées",
    description: "Levées de fonds de startups françaises. Filtres : texte, secteur (FR/EN, ex. IA, climat, santé, fintech), stade, investisseur, période, montant. Tri par date ou montant.",
    inputSchema: {
      query: z.string().optional().describe("Texte libre : société, techno, investisseur…"),
      sector: z.string().optional(), stage: z.string().optional().describe("Pre-seed, Seed, Série A, Série B, Série C, Growth."),
      investor: z.string().optional(), since: ym.optional(), until: ym.optional(),
      min_amount_eur_m: z.number().optional(), max_amount_eur_m: z.number().optional(),
      with_deploying_fund: z.boolean().optional().describe("Seulement les tours avec un investisseur qui a un fonds en déploiement."),
      sort: z.enum(["date", "amount"]).optional(), limit: lim(20), offset,
    },
  }, async (a) => {
    const r = ctx.M().searchDeals(a);
    return out({ ...paged("deals", r.map(ctx.M().dealOut), a, 20, { total_announced_eur_m: Math.round(r.reduce((x, d) => x + (d.amount_eur_m || 0), 0)) }), note: NOTE() });
  });

  s.registerTool("get_startup", {
    title: "Fiche startup",
    description: "Historique de financement d'une startup française : tours (date, stade, montant, investisseurs), total levé, exit éventuel, PE.",
    inputSchema: { name: z.string() },
  }, async ({ name }) => {
    const r = ctx.M().getStartupFuzzy(name);
    return r ? out({ ...r, note: NOTE() }) : notFound("Startup", name);
  });

  s.registerTool("find_investors", {
    title: "Trouver des investisseurs pour une levée",
    description: "Classe les investisseurs les plus pertinents pour une startup qui lève en France. Score /100 : deals récents dans le secteur (35), au stade (25), rythme sur 12 mois (15), ticket compatible (15), fonds en cours de déploiement (10). Renvoie raisons et deals d'exemple.",
    inputSchema: {
      description: z.string().optional().describe("Pitch en une phrase (sert à déduire le secteur)."),
      sector: z.string().optional(), stage: z.string().optional(), amount_eur_m: z.number().optional().describe("Montant recherché en M€."),
      deploying_only: z.boolean().optional(), limit: lim(15, 50),
    },
  }, async (a) => {
    let r = ctx.M().findInvestors(a);
    if (a.deploying_only) r = r.filter((x) => x.investor.deploying_vehicles.length);
    return out({ criteria: a, total_candidates: r.length, shortlist: r.slice(0, a.limit || 15), next_step: "Appelle get_investor sur les 3 à 5 premiers pour lire leurs deals récents, leur thèse et leur équipe.", note: NOTE() });
  });

  s.registerTool("list_investors", {
    title: "Annuaire des investisseurs",
    description: "Fonds et sociétés d'investissement actifs en France (annuaire Insights, fonds en déploiement, grands fonds internationaux, et investisseurs vus sur au moins deux levées), filtrables par type, secteur, stade, texte, « en déploiement » et « international ». Les business angels individuels portent l'étiquette « Business Angel ».",
    inputSchema: { query: z.string().optional(), type: z.string().optional().describe("Ex. VC, CVC, Business angel, Growth, Family office."), sector: z.string().optional(), stage: z.string().optional(), deploying_only: z.boolean().optional(), international_only: z.boolean().optional(), business_angels_only: z.boolean().optional().describe("Seulement les business angels individuels."), sort: z.enum(["activity", "deals", "name"]).optional(), limit: lim(25), offset },
  }, async (a) => {
    const r = ctx.M().listInvestors(a);
    return out({ ...paged("investors", r.map(ctx.M().entBrief), a, 25), note: NOTE() });
  });

  s.registerTool("get_investor", {
    title: "Fiche investisseur",
    description: "Fiche complète d'un fonds ou investisseur : thèse (déclarée et observée sur ses deals), profil (type, stades, ticket, focus), fonds en cours de déploiement (taille, thèse, ticket, secteurs, LPs, équipe, réserves), activité par année / stade / secteur, derniers et plus gros deals, co-investisseurs fréquents, opérations comme acquéreur.",
    inputSchema: { name: z.string().describe("Nom du fonds ou d'un de ses véhicules.") },
  }, async ({ name }) => {
    const r = ctx.M().getInvestorFuzzy(name);
    return r ? out({ ...r, note: NOTE() }) : notFound("Investisseur", name);
  });

  s.registerTool("deploying_funds", {
    title: "Fonds en cours de déploiement",
    description: "Véhicules VC en cours d'investissement qui investissent en France (fonds français, ou fonds ayant fait un deal français sur 24 mois) : taille, stade, ticket, thèse, LPs, équipe, deals français récents. Les fonds étrangers sans deal français récent sont exclus, sauf include_foreign=true.",
    inputSchema: { sector: z.string().optional(), stage: z.string().optional(), country: z.string().optional(), include_foreign: z.boolean().optional().describe("Inclure les fonds étrangers qui n'investissent pas en France."), limit: lim(20), offset },
  }, async (a) => {
    const r = ctx.M().deployingFunds(a);
    return out({ ...paged("funds", r, a, 20), note: NOTE() });
  });

  // ---- Fonds VC européens ----
  s.registerTool("search_european_funds", {
    title: "Rechercher des fonds VC européens",
    description: "Annuaire des ~200 fonds VC européens en déploiement (France, Allemagne, Pays-Bas, Belgique, Suisse, Autriche, Luxembourg, Irlande, Monaco) : taille, stade, ticket, thèse, LPs, équipe, enrichis de leur activité en France. Requête en langage naturel (FR/EN) et/ou filtres.",
    inputSchema: {
      query: z.string().optional().describe("Ex. « seed climat Allemagne plus de 100M »."),
      countries: z.array(z.string()).optional(), stages: z.array(z.string()).optional().describe("Pre-Seed, Seed, Series A, Series B, Growth…"), sectors: z.array(z.string()).optional(),
      min_size_eur_m: z.number().optional(), max_size_eur_m: z.number().optional(), has_ticket: z.boolean().optional(),
      invests_in_france: z.boolean().optional().describe("Seulement les fonds français ou ayant investi en France sur 24 mois."),
      sort: z.enum(["relevance", "size_desc", "size_asc", "name", "france"]).optional(), limit: lim(15, 50), offset,
    },
  }, async (a) => { const r = ctx.M().searchEuropeanFunds(a); return out({ ...paged("funds", r, a, 15), note: "Tailles affichées par les fonds, non vérifiées. " + NOTE() }); });

  s.registerTool("match_european_funds", {
    title: "Fonds européens adaptés à une levée",
    description: "Classe /100 les fonds VC européens pour une startup : stade (30), secteur (30), géographie (15), ticket (15), complétude (10), plus un bonus si le fonds investit activement en France. Renvoie raisons et alertes.",
    inputSchema: { description: z.string().describe("Pitch en une phrase."), stage: z.string().optional(), country: z.string().optional().describe("Pays du siège de la startup."), sectors: z.array(z.string()).optional(), raise_eur_m: z.number().optional(), limit: lim(10, 30) },
  }, async (a) => { const r = ctx.M().matchEuropeanFunds(a); return out({ total_matches: r.length, shortlist: r.slice(0, a.limit || 10), note: NOTE() }); });

  s.registerTool("get_european_fund", {
    title: "Fiche d'un fonds européen",
    description: "Fiche complète d'un fonds VC européen en déploiement : taille, stade, ticket, thèse, géographie, LPs, équipe, signaux, réserves, deals français du fonds et fonds comparables.",
    inputSchema: { name: z.string() },
  }, async ({ name }) => { const r = ctx.M().getEuropeanFundFuzzy(name); return r ? out({ ...r, note: NOTE() }) : notFound("Fonds", name); });

  s.registerTool("european_funds_stats", {
    title: "Statistiques des fonds européens",
    description: "Fonds en déploiement par pays, stade ou secteur : nombre, capital affiché, taille médiane, nombre investissant en France.",
    inputSchema: { group_by: z.enum(["country", "stage", "sector"]) },
  }, async ({ group_by }) => out({ group_by, groups: ctx.M().europeStats(group_by), note: NOTE() }));

  s.registerTool("business_angels", {
    title: "Business angels",
    description: "Business angels individuels (personnes) présents sur au moins deux levées françaises : nombre de deals, secteurs, derniers deals. Les clubs et réseaux d'angels sont traités comme des fonds (list_investors).",
    inputSchema: { query: z.string().optional().describe("Nom, startup ou secteur."), limit: lim(30), offset },
  }, async (a) => { const r = ctx.M().businessAngels(a); return out({ ...paged("angels", r, a, 30), note: NOTE() }); });

  s.registerTool("international_funds", {
    title: "Grands fonds internationaux",
    description: "Grands fonds américains et internationaux qui investissent partout (Insight Partners, ICONIQ, Sequoia, a16z, General Catalyst, Lightspeed, Accel, Index, Tiger, Coatue, Thrive, YC, fonds souverains…) : siège, type, stades, focus, portefeuille, et leurs levées françaises suivies par Insights.",
    inputSchema: { country: z.string().optional().describe("Ex. États-Unis, Royaume-Uni, Suède."), type: z.string().optional().describe("Ex. Growth, VC, Corporate, Fonds souverain."), limit: lim(50) },
  }, async (a) => { const r = ctx.M().internationalFunds(a); return out({ total: r.length, funds: r.slice(0, a.limit || 50), note: NOTE() }); });

  s.registerTool("top_investors", {
    title: "Investisseurs les plus actifs",
    description: "Classement des investisseurs par nombre de deals sur une période (défaut : 12 derniers mois), filtrable par secteur et stade.",
    inputSchema: { since: ym.optional(), sector: z.string().optional(), stage: z.string().optional(), limit: lim(15) },
  }, async (a) => out({ investors: ctx.M().topInvestors(a).slice(0, a.limit || 15), note: NOTE() }));

  s.registerTool("comparables", {
    title: "Comparables de levée",
    description: "Situe un tour face aux deals comparables (secteur, stade, période) : médiane, quartiles, extrêmes, percentile du montant fourni et deals les plus proches.",
    inputSchema: { sector: z.string().optional(), stage: z.string().optional(), since: ym.optional(), query: z.string().optional(), amount_eur_m: z.number().optional(), limit: lim(10, 30) },
  }, async (a) => out({ ...ctx.M().comparables(a), note: NOTE() }));

  s.registerTool("exits_and_ma", {
    title: "Exits et M&A",
    description: "Opérations de sortie de la French Tech : acquisitions, IPO, OPA, LBO, fusions, avec acquéreur, montant, contexte et données société (SIREN, effectif, CA…).",
    inputSchema: { query: z.string().optional(), type: z.string().optional().describe("Acquisition, IPO, OPA, LBO, Fusion, Minoritaire."), sector: z.string().optional(), since: ym.optional(), sort: z.enum(["date", "amount"]).optional(), limit: lim(20), offset },
  }, async (a) => {
    const r = ctx.M().exits(a);
    return out({ ...paged("operations", r, a, 20), note: NOTE() });
  });

  s.registerTool("get_acquirer", {
    title: "Fiche acquéreur",
    description: "Toutes les opérations d'un acquéreur (corporate, ETI, fonds, SPAC) : cibles, montants, secteurs, types.",
    inputSchema: { name: z.string() },
  }, async ({ name }) => {
    const r = ctx.M().getAcquirerFuzzy(name);
    return r ? out({ ...r, note: NOTE() }) : notFound("Acquéreur", name);
  });

  s.registerTool("pe_watch", {
    title: "PE Watch",
    description: "Participations de private equity (LBO) suivies : fonds, valeur d'entreprise, entrée, statut, fenêtre de sortie attendue et retard éventuel.",
    inputSchema: { status: z.string().optional().describe("« En portefeuille » ou « Exit »."), late_only: z.boolean().optional(), query: z.string().optional() },
  }, async (a) => {
    const r = ctx.M().peWatch(a);
    return out({ total: r.length, participations: r, note: NOTE() });
  });

  s.registerTool("market_overview", {
    title: "Vue d'ensemble du marché",
    description: "Agrégats des levées sur une période (défaut 12 mois) : nombre, montant annoncé, ticket médian, exits, regroupés par mois, secteur ou stade.",
    inputSchema: { since: ym.optional(), until: ym.optional(), sector: z.string().optional(), stage: z.string().optional(), group_by: z.enum(["month", "sector", "stage"]).optional() },
  }, async (a) => out({ ...ctx.M().overview(a), note: NOTE() }));

  // ---- Veille et préparation de levée ----
  s.registerTool("whats_new", {
    title: "Nouveautés de la semaine",
    description: "Ce qu'a apporté la dernière mise à jour hebdomadaire (lundi 8 h, heure de Paris) : nouvelles levées de la semaine, montant total, ticket médian, secteurs et stades, investisseurs les plus actifs, et exits du dernier mois.",
    inputSchema: { sector: z.string().optional().describe("Restreindre à un secteur."), limit: lim(30) },
  }, async (a) => out({ ...ctx.M().whatsNew(a), note: NOTE() }));

  s.registerTool("fundraising_brief", {
    title: "Dossier de levée",
    description: "Prépare une levée en un appel : comparables (médiane, quartiles, percentile du montant), tendance du secteur sur 6 mois, shortlist d'investisseurs notés /100 avec raisons, fonds européens hors France, délai médian et investisseurs typiques du tour suivant.",
    inputSchema: { description: z.string().optional().describe("Pitch en une phrase."), sector: z.string().optional(), stage: z.string().optional(), amount_eur_m: z.number().optional().describe("Montant recherché en M€."), limit: lim(10, 25) },
  }, async (a) => out({ ...ctx.M().fundraisingBrief(a), note: NOTE() }));

  s.registerTool("compare_investors", {
    title: "Comparer des investisseurs",
    description: "Compare 2 à 5 fonds côte à côte : activité 12 et 24 mois, répartition par stade et secteur, taille de tour typique, ticket déclaré, fonds en déploiement, dernier deal, et deals qu'ils ont faits ensemble.",
    inputSchema: { names: z.array(z.string()).min(2).max(5).describe("Noms des fonds (les fautes de frappe sont tolérées).") },
  }, async ({ names }) => out({ ...ctx.M().compareInvestors(names), note: NOTE() }));

  s.registerTool("co_investors", {
    title: "Co-investisseurs",
    description: "Réseau de co-investissement d'un fonds : avec qui il investit le plus souvent (part de ses deals, exemples), filtrable par secteur, stade et période. Utile pour compléter un tour autour d'un lead.",
    inputSchema: { investor: z.string(), sector: z.string().optional(), stage: z.string().optional(), since: ym.optional(), limit: lim(20, 50) },
  }, async (a) => { const r = ctx.M().coInvestors(a); return r ? out({ ...r, note: NOTE() }) : notFound("Investisseur", a.investor); });

  s.registerTool("follow_on_investors", {
    title: "Qui finance le tour suivant",
    description: "Pour les startups ayant levé à un stade donné (ex. Seed), quels investisseurs sont entrés au tour suivant, délai médian entre les tours et taux de réinvestissement des investisseurs existants. Filtrable par secteur.",
    inputSchema: { stage: z.string().describe("Stade de départ : Pre-seed, Seed, Série A, Série B…"), sector: z.string().optional(), limit: lim(15, 50) },
  }, async (a) => out({ ...ctx.M().followOnInvestors(a), note: NOTE() }));

  s.registerTool("sector_trends", {
    title: "Tendances par secteur",
    description: "Compare la période récente (défaut 6 mois) à la précédente, secteur par secteur : nombre de levées, montant, ticket médian, variations en %. Signale les secteurs qui accélèrent et ceux qui ralentissent.",
    inputSchema: { months: z.number().int().min(1).max(12).optional().describe("Durée de chaque période en mois (défaut 6)."), stage: z.string().optional(), min_deals: z.number().int().min(1).optional(), sort: z.enum(["momentum", "amount", "deals"]).optional(), limit: lim(25, 50) },
  }, async (a) => out({ ...ctx.M().sectorTrends(a), note: NOTE() }));

  s.registerTool("likely_acquirers", {
    title: "Acquéreurs probables",
    description: "Pour une startup (ou un secteur), les acquéreurs déjà actifs dans ce secteur : nombre d'opérations, acquéreurs en série, types d'opérations, valeurs annoncées et opérations récentes. Base d'une réflexion de sortie.",
    inputSchema: { startup: z.string().optional(), sector: z.string().optional(), limit: lim(15, 40) },
  }, async (a) => { const r = ctx.M().likelyAcquirers(a); return r ? out({ ...r, note: NOTE() }) : out({ error: "Indique un secteur, ou une startup présente dans la base.", did_you_mean: a.startup ? ctx.M().didYouMean(a.startup, 5) : [] }); });

  // Compatibilité connecteurs ChatGPT (recherche approfondie) : search + fetch
  s.registerTool("search", {
    title: "search",
    description: "Recherche globale (startups, investisseurs, acquéreurs) dans Insights French Tech. Renvoie {id, title, url} ; lire avec fetch.",
    inputSchema: { query: z.string() },
  }, async ({ query }) => {
    const results = ctx.M().globalSearch(query, 20).map((x) => ({ ...x, url: ctx.INS().meta.url }));
    return { content: [{ type: "text", text: JSON.stringify({ results }) }], structuredContent: { results } };
  });
  s.registerTool("fetch", {
    title: "fetch",
    description: "Lit une fiche Insights French Tech à partir d'un id renvoyé par search (investor:…, startup:…, acquirer:…).",
    inputSchema: { id: z.string() },
  }, async ({ id }) => {
    const doc = ctx.M().fetchDoc(id) || { id, title: "Introuvable", text: "Aucune fiche pour cet id.", url: ctx.INS().meta.url };
    return { content: [{ type: "text", text: JSON.stringify(doc) }], structuredContent: doc };
  });

  s.registerTool("data_status", {
    title: "Fraîcheur des données",
    description: "Date des dernières données, volumes indexés, dernier rafraîchissement ; refresh=true relit le site immédiatement.",
    inputSchema: { refresh: z.boolean().optional() },
  }, async ({ refresh: r }) => {
    const res = r ? (ctx.refresh ? await ctx.refresh() : { ok: false, note: "Sur le serveur hébergé, les données suivent chaque déploiement hebdomadaire du site." }) : ctx.lastRefresh();
    return out({ ...ctx.M().lastUpdate(), ...ctx.M().meta, last_refresh: res });
  });

  // ---- Parcours guidés (prompts MCP) ----
  const P = (name, title, description, argsSchema, text) => s.registerPrompt(name, { title, description, argsSchema }, (a) => ({ messages: [{ role: "user", content: { type: "text", text: text(a) } }] }));
  P("preparer_levee", "Préparer une levée", "Shortlist d'investisseurs, comparables et plan d'approche pour une startup qui lève en France.",
    { pitch: z.string().describe("Votre startup en une phrase."), stade: z.string().optional(), montant_m_eur: z.string().optional() },
    (a) => `Je prépare une levée${a.stade ? " en " + a.stade : ""}${a.montant_m_eur ? " de " + a.montant_m_eur + " M€" : ""}. Ma startup : ${a.pitch}.\n` +
      "Avec Insights French Tech : 1) appelle fundraising_brief ; 2) ouvre get_investor sur les 5 premiers ; 3) départage-les avec compare_investors ; 4) pour le lead le plus probable, propose des co-investisseurs avec co_investors. " +
      "Rends un tableau (fonds, pourquoi, fonds en déploiement, deal comparable récent, angle d'approche), situe mon montant face aux comparables, et termine par un ordre de contact.");
  P("brief_investisseur", "Préparer un rendez-vous investisseur", "Fiche de préparation avant de rencontrer un fonds.",
    { fonds: z.string() },
    (a) => `Je rencontre ${a.fonds}. Avec get_investor, co_investors et compare_investors (face à deux fonds proches), prépare une fiche : thèse et fonds en déploiement, rythme et stades, 5 deals récents les plus parlants, co-investisseurs habituels, équipe à connaître, et 5 questions à poser.`);
  P("veille_hebdo", "Veille de la semaine", "Résumé de la dernière mise à jour du lundi.",
    { secteur: z.string().optional() },
    (a) => `Fais ma veille French Tech de la semaine${a.secteur ? " sur le secteur " + a.secteur : ""} : appelle whats_new${a.secteur ? " avec ce secteur" : ""}, puis sector_trends. Donne les 5 levées à retenir et pourquoi, les investisseurs les plus actifs, les secteurs qui accélèrent ou ralentissent, et les exits notables.`);
  P("strategie_sortie", "Stratégie de sortie", "Acquéreurs probables et précédents pour une startup ou un secteur.",
    { startup_ou_secteur: z.string() },
    (a) => `Analyse les options de sortie pour « ${a.startup_ou_secteur} » : appelle likely_acquirers (startup, sinon secteur), puis exits_and_ma sur le secteur et get_acquirer sur les 3 acquéreurs les plus actifs. Liste les acheteurs probables avec leurs précédents, les valeurs annoncées, et ce qui rend une cible attractive pour eux.`);

  // ---- Ressource : méthodologie ----
  s.registerResource("methodologie", "insights://methodologie", { title: "Méthodologie Insights French Tech", description: "Périmètre, fréquence de mise à jour, définitions et limites des données.", mimeType: "text/markdown" }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "text/markdown", text: [
      "# Insights French Tech : méthodologie",
      `- Périmètre : levées, exits et M&A de startups françaises depuis janvier 2024 ; données jusqu'à ${ctx.INS().meta.latest_deal_month}.`,
      `- Mise à jour : ${ctx.M().lastUpdate().schedule} (dernière : ${ctx.M().lastUpdate().last_update}).`,
      "- Montants : en M€, tels qu'annoncés ; null = non communiqué.",
      "- Doublons : deux annonces d'une même levée (même société, montant à ±15 %, même stade, 3 mois d'écart au plus) sont fusionnées ; de même pour les opérations (même cible et même acquéreur).",
      "- Investisseurs : un fonds a une fiche s'il est dans l'annuaire, s'il a un véhicule en déploiement, s'il fait partie des grands fonds internationaux, ou s'il apparaît sur au moins deux levées.",
      "- Fonds en déploiement « en France » : véhicule français, ou fonds ayant fait au moins un deal français sur 24 mois ; les autres sont présentés à part.",
      "- Business Angel : personne physique (prénom + nom) ; les clubs et réseaux d'angels sont des « clubs d'investisseurs ».",
      "- Scores find_investors /100 : secteur 35, stade 25, rythme 12 mois 15, ticket 15, fonds en déploiement 10.",
    ].join("\n") }],
  }));

  return s;
}

module.exports = { createServer };
