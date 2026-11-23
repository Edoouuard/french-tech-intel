// Section « Financements non dilutifs » d'Insights French Tech (/non-dilutif).
// L'application (non-dilutif/app.js) s'exécute dans le navigateur ; ce module rend côté serveur,
// pour chaque adresse, la coquille HTML avec un titre, une description, une adresse canonique et
// un contenu lisible sans JavaScript (pour Google), plus le sitemap et une recherche pour le MCP.
// Données : non-dilutif/data.js (window.DZ), la même source que l'application.
const vm = require("vm");

const SITE = "https://www.insights-french-tech.com";
const BASE = "/non-dilutif";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1).replace(/[\s,;:.]+\S*$/, "") + "…" : s || "");
const eur = (n) => (n == null ? null : n >= 1e6 ? (n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " M€" : n >= 1e3 ? Math.round(n / 1e3).toLocaleString("fr-FR") + " k€" : n.toLocaleString("fr-FR") + " €");
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function loadData(dataJs) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(dataJs, ctx, { timeout: 2000 });
  return ctx.window.DZ;
}

function createNonDilutif(dataJs) {
  const D = loadData(dataJs);
  const byId = Object.fromEntries(D.dispositifs.map((d) => [d.id, d]));
  const opById = Object.fromEntries(D.fournisseurs.map((o) => [o.id, o]));
  const opName = (d) => (opById[d.op] ? opById[d.op].nom : d.op);
  const ticket = (d) => (d.max == null && d.min == null ? "Montant variable" : d.min && d.max ? `${eur(d.min)} à ${eur(d.max)}` : d.max ? `Jusqu'à ${eur(d.max)}` : `À partir de ${eur(d.min)}`);
  const stades = (d) => d.stades.map((s) => (D.stades[s] || {}).label || s).join(", ");
  const secteurs = (d) => d.secteurs.map((s) => D.secteurs[s] || s).join(", ");
  const catLabel = (c) => (D.categories[c] || {}).label || c;
  const delai = (d) => (Array.isArray(d.delai) ? `${d.delai[0]} à ${d.delai[1]} semaines` : null);
  const cumulsOf = (id) => D.cumuls.filter((c) => c[0] === id || c[1] === id).map((c) => ({ other: c[0] === id ? c[1] : c[0], type: c[2], txt: c[3] })).filter((c) => byId[c.other]);
  const CUM = { levier: "Effet levier", cumul: "Cumulable", condition: "Sous conditions", exclusif: "Exclusif" };

  // Coquille commune : en-tête de la section sous la barre Insights, contenu rendu côté serveur dans <main id="app">.
  function shell({ path, title, description, body, home = false, jsonld = [] }) {
    const url = SITE + path;
    const crumbs = [{ name: "Insights French Tech", item: SITE + "/" }, { name: "Non-dilutif", item: SITE + BASE }];
    if (path !== BASE) crumbs.push({ name: title.split(" | ")[0], item: url });
    const ld = [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, ...c })) }, ...jsonld];
    return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website"><meta property="og:site_name" content="Insights French Tech"><meta property="og:locale" content="fr_FR">
  <meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='4' fill='%231f5a5d'/%3E%3Cpath d='M16 5c-3 5-4 12-1 22h2c3-10 2-17-1-22z' fill='%23f4ecdb'/%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${BASE}/styles.css">
  <link rel="stylesheet" href="${BASE}/insights-bar.css">
${ld.map((x) => `  <script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body>
  <header class="top">
    <nav class="ift-bar" aria-label="Insights French Tech"><div class="wrap">
      <a class="ift-brand" href="/"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="29" height="29" rx="9" stroke="currentColor" stroke-width="1.5"/><path d="M8 22V14M13 22V10M18 22v-6M23 22V8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".55"/><circle cx="23" cy="8" r="2.8" fill="#F3B648"/></svg>Insights French Tech</a>
      <span class="ift-links"><a href="/">Vue d'ensemble</a><a href="/levees">Levées</a><a href="/startups">Startups</a><a href="/fonds">Fonds</a><a href="${BASE}" aria-current="page">Non-dilutif</a><a href="/#mcp">MCP</a></span>
    </div></nav>
    <div class="wrap">
      <a class="brand" href="${BASE}" aria-label="Financements non dilutifs, accueil de la section">
        <svg class="brand-mark" viewBox="0 0 30 30" fill="currentColor" aria-hidden="true"><path d="M15 2c-3.4 5.6-4.6 13.2-1.2 24h2.4C19.6 15.2 18.4 7.6 15 2z" /><rect x="3" y="27" width="24" height="1.4" /></svg>
        <b><span class="bw">Financements </span>non dilutifs</b>
      </a>
      <nav class="nav" id="nav" aria-label="Navigation de la section">
        <a href="${BASE}/explorer" data-r="explorer">Explorer</a>
        <a href="${BASE}/venture-debt" data-r="venture-debt">Venture debt</a>
        <a href="${BASE}/parcours" data-r="parcours">Parcours</a>
        <a href="${BASE}/cumuls" data-r="cumuls">Cumuls</a>
        <a href="${BASE}/simulateur" data-r="simulateur">Chiffrer</a>
        <a href="${BASE}/operateurs" data-r="operateurs">Opérateurs</a>
      </nav>
      <a class="cta-top" href="${BASE}/trouver">Trouver mes aides</a>
      <button class="icon-btn menu-btn" id="menu" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="nav"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
      <button class="icon-btn" id="theme" aria-label="Changer de thème" title="Changer de thème"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button>
    </div>
  </header>
  <main id="app" tabindex="-1"${home ? ' class="home"' : ""}><div class="wrap ssr">${body}</div></main>
  <footer>
    <span id="foot-h"></span>
    <div class="wrap">
      <div><b>Insights French Tech</b>Financements non dilutifs : un point d'entrée, pas un conseil en financement.<br>Seules les conditions officielles des opérateurs font foi.</div>
      <div>Relevé : <span id="releve">${esc(D.meta.releve)}</span><br><a href="${BASE}/methodologie">Méthodologie</a> · <a href="${BASE}/trouver">Trouver mes aides</a><br>Une section d'<a href="/">Insights French Tech</a> · <a href="/fonds">Fonds VC</a> · <a href="/levees">Levées</a></div>
    </div>
  </footer>
  <div class="tip" id="tip" role="tooltip"></div>
  <script src="${BASE}/data.js"></script>
  <script src="${BASE}/walk.js"></script>
  <script src="${BASE}/app.js"></script>
</body>
</html>`;
  }

  const link = (d) => `<a href="${BASE}/aides/${d.id}">${esc(d.nom)}</a>`;
  const listByCat = (list) => Object.keys(D.categories).map((c) => { const ds = list.filter((d) => d.cat === c); return ds.length ? `<h2>${esc(catLabel(c))}</h2><p>${esc(D.categories[c].desc)}</p><ul>${ds.map((d) => `<li>${link(d)} : ${esc(ticket(d))}, ${esc(opName(d))}</li>`).join("")}</ul>` : ""; }).join("");

  function aidePage(id) {
    const d = byId[id];
    if (!d) return null;
    const cum = cumulsOf(id);
    const facts = [["Catégorie", catLabel(d.cat)], ["Forme", d.forme], ["Montant", ticket(d)], ["Couverture", d.couverture], ["Durée", d.duree], ["Délai d'obtention", delai(d)], ["Stades", stades(d)], ["Secteurs", secteurs(d)], ["Zone", (D.geos[d.geo] || d.geo)], ["Opérateur", opName(d)], ["Fiabilité", (D.statuts[d.statut] || {}).label]].filter(([, v]) => v);
    const body = `<p><a href="${BASE}/explorer">Toutes les aides</a> / ${esc(catLabel(d.cat))}</p>
<h1>${esc(d.nom)}</h1>
<p>${esc(d.desc)}</p>
<dl>${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
${d.elig ? `<h2>Conditions d'éligibilité</h2><p>${esc(d.elig)}</p>` : ""}
${d.note ? `<h2>À savoir</h2><p>${esc(d.note)}</p>` : ""}
${cum.length ? `<h2>Cumuls avec d'autres aides</h2><ul>${cum.map((c) => `<li>${link(byId[c.other])} (${esc(CUM[c.type] || c.type)}) : ${esc(c.txt)}</li>`).join("")}</ul>` : ""}
<p>Opérateur : <a href="${BASE}/operateurs/${esc(d.op)}">${esc(opName(d))}</a>${d.url ? ` · Source officielle : <a href="${esc(d.url)}" rel="nofollow noopener">${esc(d.source || d.url)}</a>` : ""}</p>`;
    const desc = `${d.nom} (${opName(d)}) : ${ticket(d).toLowerCase()}. ${d.desc}`;
    return shell({ path: `${BASE}/aides/${id}`, title: `${d.nom} : montant, conditions et cumuls | Insights French Tech`, description: truncate(desc, 158), body,
      jsonld: [{ "@context": "https://schema.org", "@type": d.cat === "venture-debt" || d.cat === "pret" ? "LoanOrCredit" : "FinancialProduct", name: d.nom, description: d.desc, provider: { "@type": "Organization", name: opName(d) }, url: SITE + `${BASE}/aides/${id}`, areaServed: "FR" }] });
  }

  function opPage(id) {
    const o = opById[id];
    if (!o) return null;
    const ds = D.dispositifs.filter((d) => d.op === id);
    const body = `<p><a href="${BASE}/operateurs">Tous les opérateurs</a></p><h1>${esc(o.nom)}</h1><p>${esc(o.focus || "")}</p>
${ds.length ? `<h2>Financements proposés par ${esc(o.nom)}</h2><ul>${ds.map((d) => `<li>${link(d)} : ${esc(ticket(d))}. ${esc(d.desc)}</li>`).join("")}</ul>` : ""}
${o.url ? `<p>Site : <a href="${esc(o.url)}" rel="nofollow noopener">${esc(o.url)}</a></p>` : ""}`;
    return shell({ path: `${BASE}/operateurs/${id}`, title: `${o.nom} : financements non dilutifs pour startups | Insights French Tech`, description: truncate(`${o.nom} : ${ds.length} dispositif${ds.length > 1 ? "s" : ""} non dilutif${ds.length > 1 ? "s" : ""} pour les startups françaises. ${o.focus || ""}`, 158), body,
      jsonld: [{ "@context": "https://schema.org", "@type": "Organization", name: o.nom, url: o.url || undefined, description: o.focus || undefined }] });
  }

  const STATIC = {
    "": { title: "Financements non dilutifs des startups françaises : subventions, prêts, CIR, venture debt | Insights French Tech", desc: `Subventions, prêts, garanties, crédits d'impôt et venture debt : ${D.dispositifs.length} dispositifs pour financer une startup sans diluer, avec montants, conditions et cumuls.`, body: () => `<h1>Financer sa startup sans diluer</h1><p>${D.dispositifs.length} dispositifs non dilutifs pour les startups françaises : subventions, prêts, garanties, avantages fiscaux et venture debt. Relevé : ${esc(D.meta.releve)}.</p>${listByCat(D.dispositifs)}`, home: true },
    explorer: { title: "Toutes les aides non dilutives pour startups | Insights French Tech", desc: `Base complète de ${D.dispositifs.length} financements non dilutifs : filtrez par stade, secteur, catégorie et opérateur.`, body: () => `<h1>Explorer les ${D.dispositifs.length} dispositifs</h1>${listByCat(D.dispositifs)}` },
    "venture-debt": { title: "Venture debt et revenue-based financing en France | Insights French Tech", desc: "Panorama de la venture debt en France et en Europe : prêteurs, tickets, taux, warrants, et financement sur revenus (RBF).", body: () => { const ds = D.dispositifs.filter((d) => d.cat === "venture-debt"); const m = D.vdMarche || {}; return `<h1>Venture debt et RBF</h1><p>${m.annee ? `En ${m.annee}, ${esc(eur(m.volume))} de venture debt en Europe sur ${m.operations} opérations, à des taux de ${esc(m.taux)} (${esc(m.source || "")}).` : ""}</p><ul>${ds.map((d) => `<li>${link(d)} : ${esc(ticket(d))}. ${esc(d.desc)}</li>`).join("")}</ul>`; } },
    operateurs: { title: "Opérateurs des financements non dilutifs : Bpifrance, Europe, banques, prêteurs | Insights French Tech", desc: `Les ${D.fournisseurs.length} opérateurs des aides et financements non dilutifs pour startups : publics, européens, réseaux, banques, fonds de dette.`, body: () => `<h1>Opérateurs</h1><ul>${D.fournisseurs.map((o) => `<li><a href="${BASE}/operateurs/${o.id}">${esc(o.nom)}</a> : ${esc(o.focus || "")}</li>`).join("")}</ul>` },
    trouver: { title: "Trouver mes aides non dilutives en 2 minutes | Insights French Tech", desc: "Questionnaire : stade, secteur, besoins. Obtenez la liste des subventions, prêts et crédits d'impôt adaptés à votre startup.", body: () => `<h1>Trouver mes aides</h1><p>Répondez à quelques questions sur votre startup pour obtenir les dispositifs adaptés.</p>` },
    parcours: { title: "Parcours de financement non dilutif type, mois par mois | Insights French Tech", desc: "Trois parcours types (logiciel, deeptech, industrie) : quelles aides demander, dans quel ordre, du premier mois à la série A.", body: () => `<h1>Parcours types</h1>${D.parcours.map((p) => `<h2>${esc(p.titre)}</h2><p>${esc(p.sous || "")}</p><ol>${p.etapes.map((e) => `<li>${esc(e.mois)} : ${e.items.filter((i) => byId[i]).map((i) => link(byId[i])).join(", ")}. ${esc(e.txt)}</li>`).join("")}</ol>`).join("")}` },
    cumuls: { title: "Cumuler les aides : CIR, JEI, Bourse French Tech, prêts d'honneur | Insights French Tech", desc: "Quelles aides non dilutives se cumulent, lesquelles s'excluent, et lesquelles font effet de levier sur un prêt bancaire.", body: () => `<h1>Cumuls</h1><ul>${D.cumuls.filter((c) => byId[c[0]] && byId[c[1]]).map((c) => `<li>${link(byId[c[0]])} et ${link(byId[c[1]])} : ${esc(CUM[c[2]] || c[2])}. ${esc(c[3])}</li>`).join("")}</ul>` },
    simulateur: { title: "Chiffrer son financement non dilutif | Insights French Tech", desc: "Simulateur : estimez le montant d'aides, de prêts et de crédits d'impôt mobilisables selon votre budget et vos effectifs.", body: () => `<h1>Chiffrer</h1><p>Estimez le financement non dilutif mobilisable selon votre budget de R&amp;D, vos effectifs et votre stade.</p>` },
    methodologie: { title: "Méthodologie et sources | Insights French Tech", desc: "Comment la base des financements non dilutifs est construite : sources officielles, niveaux de fiabilité, date de relevé.", body: () => `<h1>Méthodologie</h1><p>Relevé : ${esc(D.meta.releve)}. Chaque dispositif porte un niveau de fiabilité : ${Object.values(D.statuts).map((s) => esc(s.label + " (" + s.desc + ")")).join(", ")}.</p>` },
    comparer: { title: "Comparer des aides non dilutives | Insights French Tech", desc: "Comparez jusqu'à trois dispositifs non dilutifs côte à côte.", body: () => `<h1>Comparer</h1>`, noindex: true },
  };

  function render(pathname) {
    const p = decodeURIComponent(pathname).replace(/\/+$/, "");
    if (p === BASE || p.startsWith(BASE + "/")) {
      const parts = p.slice(BASE.length).split("/").filter(Boolean);
      if (parts[0] === "aides" && parts[1]) return { body: aidePage(parts[1]) };
      if (parts[0] === "operateurs" && parts[1]) return { body: opPage(parts[1]) };
      if (parts[0] === "aides" && !parts[1]) return { redirect: `${BASE}/explorer` };
      const key = parts[0] || "";
      const s = STATIC[key];
      if (s && parts.length <= 1) {
        let html = shell({ path: BASE + (key ? "/" + key : ""), title: s.title, description: s.desc, body: s.body(), home: !!s.home });
        if (s.noindex) html = html.replace("<head>", '<head>\n  <meta name="robots" content="noindex">');
        return { body: html };
      }
    }
    return { body: null };
  }

  const sitemapUrls = () => [
    { loc: BASE, pr: "0.9", cf: "monthly" },
    ...Object.entries(STATIC).filter(([k, s]) => k && !s.noindex).map(([k]) => ({ loc: `${BASE}/${k}`, pr: "0.7", cf: "monthly" })),
    ...D.dispositifs.map((d) => ({ loc: `${BASE}/aides/${d.id}`, pr: "0.7", cf: "monthly" })),
    ...D.fournisseurs.filter((o) => D.dispositifs.some((d) => d.op === o.id)).map((o) => ({ loc: `${BASE}/operateurs/${o.id}`, pr: "0.5", cf: "monthly" })),
  ];

  // Recherche pour le MCP et les liens croisés : filtres optionnels, texte libre.
  const STADE_ALIAS = { "pre-seed": "amorcage", preseed: "amorcage", amorcage: "amorcage", creation: "amorcage", seed: "seed", "serie a": "serie-a", "series a": "serie-a", "serie-a": "serie-a", a: "serie-a", growth: "croissance", croissance: "croissance", "serie b": "croissance", "serie c": "croissance" };
  const SECT_ALIAS = { ia: "numerique", ai: "numerique", saas: "numerique", logiciel: "numerique", fintech: "numerique", numerique: "numerique", deeptech: "deeptech", "deep tech": "deeptech", quantique: "deeptech", spatial: "deeptech", biotech: "sante", medtech: "sante", sante: "sante", healthtech: "sante", climat: "environnement", greentech: "environnement", energie: "environnement", environnement: "environnement", industrie: "industrie", hardware: "industrie", robotique: "industrie", impact: "impact", ess: "impact" };
  const CAT_ALIAS = { subvention: "subvention", subventions: "subvention", bourse: "subvention", pret: "pret", prets: "pret", "pret d honneur": "pret", garantie: "garantie", fiscal: "fiscal", "credit d impot": "fiscal", cir: "fiscal", "venture debt": "venture-debt", dette: "venture-debt", rbf: "venture-debt", "revenue based financing": "venture-debt" };
  function search(o = {}) {
    const st = o.stage ? STADE_ALIAS[norm(o.stage)] || norm(o.stage).replace(/ /g, "-") : null;
    const se = o.sector ? SECT_ALIAS[norm(o.sector)] || norm(o.sector) : null;
    const ca = o.category ? CAT_ALIAS[norm(o.category)] || norm(o.category).replace(/ /g, "-") : null;
    const q = norm(o.query || "");
    const minAmt = o.min_amount_eur || 0;
    return D.dispositifs.filter((d) =>
      (!st || d.stades.includes(st)) && (!se || d.secteurs.includes("tous") || d.secteurs.includes(se)) && (!ca || d.cat === ca) &&
      (!o.region || d.geo === "national" || d.geo === "europe" || norm(D.geos[d.geo] || d.geo).includes(norm(o.region))) &&
      (!minAmt || (d.max || 0) >= minAmt) &&
      (!q || norm([d.nom, d.desc, d.elig, opName(d), d.forme].join(" ")).includes(q))
    ).map((d) => ({ id: d.id, name: d.nom, category: catLabel(d.cat), form: d.forme, operator: opName(d), amount: ticket(d), max_eur: d.max, coverage: d.couverture || null, stages: stades(d), sectors: secteurs(d), zone: D.geos[d.geo] || d.geo, delay: delai(d), selective: !!d.selectif, eligibility: d.elig || null, description: d.desc, note: d.note || null, reliability: (D.statuts[d.statut] || {}).label, official_source: d.url || null, page: SITE + `${BASE}/aides/${d.id}`, cumulates_with: cumulsOf(d.id).filter((c) => c.type !== "exclusif").map((c) => byId[c.other].nom) }));
  }
  const operatorIds = new Set(D.fournisseurs.map((o) => o.id));

  return { render, sitemapUrls, search, meta: { releve: D.meta.releve, count: D.dispositifs.length }, data: D, operatorIds, opById, BASE };
}

module.exports = { createNonDilutif };
