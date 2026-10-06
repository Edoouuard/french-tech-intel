// Définition des outils MCP Insights French Tech, partagée par le serveur local (server.js)
// et la fonction hébergée (api/mcp.js). ctx = { M(): modèle, INS(): données, refresh?(), lastRefresh() }.
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");
let ctx; // contexte courant (un seul jeu de données par processus)

const NOTE = () => `Source : Insights French Tech (${ctx.INS().meta.url}), France uniquement, données jusqu'à ${ctx.INS().meta.latest_deal_month}. Montants en M€ tels qu'annoncés ; null = non communiqué. Les fonds en déploiement sont rattachés aux investisseurs par nom de gestionnaire.`;
const out = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }], structuredContent: obj });
const notFound = (what, q, suggestions) => out({ error: `${what} introuvable pour « ${q} ».`, suggestions });
const ym = z.string().regex(/^\d{4}-\d{2}$/).describe("Mois au format AAAA-MM.");
const lim = (d, max = 100) => z.number().int().min(1).max(max).optional().describe(`Nombre de résultats (défaut ${d}).`);

function createServer(c) {
  ctx = c;
  const s = new McpServer(
    { name: "insights-french-tech", version: "1.0.0" },
    {
      instructions:
        "Insights French Tech couvre l'écosystème startup français depuis janvier 2024 : ~1 400 levées, ~270 exits & M&A, ~450 investisseurs (dont les fonds en cours de déploiement, avec thèse, ticket, LPs et équipe), 35 participations PE. " +
        "Pour aider une startup à lever : find_investors (classement), puis get_investor sur les meilleurs, et comparables pour situer le montant. " +
        "Pour une veille : search_deals, top_investors, market_overview, exits_and_ma. Cite les montants comme « annoncés », jamais comme vérifiés.",
    }
  );

  s.registerTool("search_deals", {
    title: "Rechercher des levées",
    description: "Levées de fonds de startups françaises. Filtres : texte, secteur (FR/EN, ex. IA, climat, santé, fintech), stade, investisseur, période, montant. Tri par date ou montant.",
    inputSchema: {
      query: z.string().optional().describe("Texte libre : société, techno, investisseur…"),
      sector: z.string().optional(), stage: z.string().optional().describe("Pre-seed, Seed, Série A, Série B, Série C, Growth."),
      investor: z.string().optional(), since: ym.optional(), until: ym.optional(),
      min_amount_eur_m: z.number().optional(), max_amount_eur_m: z.number().optional(),
      with_deploying_fund: z.boolean().optional().describe("Seulement les tours avec un investisseur qui a un fonds en déploiement."),
      sort: z.enum(["date", "amount"]).optional(), limit: lim(20),
    },
  }, async (a) => {
    const r = ctx.M().searchDeals(a);
    return out({ total: r.length, total_announced_eur_m: Math.round(r.reduce((x, d) => x + (d.amount_eur_m || 0), 0)), deals: r.slice(0, a.limit || 20).map(ctx.M().dealOut), note: NOTE() });
  });

  s.registerTool("get_startup", {
    title: "Fiche startup",
    description: "Historique de financement d'une startup française : tours (date, stade, montant, investisseurs), total levé, exit éventuel, PE.",
    inputSchema: { name: z.string() },
  }, async ({ name }) => {
    const r = ctx.M().getStartup(name);
    return r ? out({ ...r, note: NOTE() }) : notFound("Startup", name, ctx.M().globalSearch(name, 5).map((x) => x.title));
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
    description: "Liste les investisseurs actifs en France (VC, CVC, family offices, publics…), filtrables par type, secteur investi, stade, texte, et « fonds en cours de déploiement ».",
    inputSchema: { query: z.string().optional(), type: z.string().optional(), sector: z.string().optional(), stage: z.string().optional(), deploying_only: z.boolean().optional(), sort: z.enum(["activity", "deals", "name"]).optional(), limit: lim(25) },
  }, async (a) => {
    const r = ctx.M().listInvestors(a);
    return out({ total: r.length, investors: r.slice(0, a.limit || 25).map(ctx.M().entBrief), note: NOTE() });
  });

  s.registerTool("get_investor", {
    title: "Fiche investisseur",
    description: "Fiche complète d'un fonds ou investisseur : profil (type, stades, ticket, focus), fonds en cours de déploiement (taille, thèse, ticket, secteurs, LPs, équipe, réserves), activité par année / stade / secteur, derniers et plus gros deals, co-investisseurs fréquents, opérations comme acquéreur.",
    inputSchema: { name: z.string().describe("Nom du fonds, du gestionnaire ou d'un de ses véhicules.") },
  }, async ({ name }) => {
    const r = ctx.M().getInvestor(name);
    return r ? out({ ...r, note: NOTE() }) : notFound("Investisseur", name, ctx.M().globalSearch(name, 5).map((x) => x.title));
  });

  s.registerTool("deploying_funds", {
    title: "Fonds en cours de déploiement",
    description: "Véhicules VC en cours d'investissement qui investissent en France (fonds français, ou gestionnaire ayant fait un deal français sur 24 mois) : taille, stade, ticket, thèse, LPs, équipe, deals français récents. Les fonds étrangers sans deal français récent sont exclus, sauf include_foreign=true.",
    inputSchema: { sector: z.string().optional(), stage: z.string().optional(), country: z.string().optional(), include_foreign: z.boolean().optional().describe("Inclure les fonds étrangers qui n'investissent pas en France."), limit: lim(20) },
  }, async (a) => {
    const r = ctx.M().deployingFunds(a);
    return out({ total: r.length, funds: r.slice(0, a.limit || 20), note: NOTE() });
  });

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
    inputSchema: { query: z.string().optional(), type: z.string().optional().describe("Acquisition, IPO, OPA, LBO, Fusion, Minoritaire."), sector: z.string().optional(), since: ym.optional(), sort: z.enum(["date", "amount"]).optional(), limit: lim(20) },
  }, async (a) => {
    const r = ctx.M().exits(a);
    return out({ total: r.length, operations: r.slice(0, a.limit || 20), note: NOTE() });
  });

  s.registerTool("get_acquirer", {
    title: "Fiche acquéreur",
    description: "Toutes les opérations d'un acquéreur (corporate, ETI, fonds, SPAC) : cibles, montants, secteurs, types.",
    inputSchema: { name: z.string() },
  }, async ({ name }) => {
    const r = ctx.M().getAcquirer(name);
    return r ? out({ ...r, note: NOTE() }) : notFound("Acquéreur", name, ctx.M().globalSearch(name, 5).map((x) => x.title));
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
    return out({ ...ctx.M().meta, last_refresh: res });
  });

  return s;
}

module.exports = { createServer };
