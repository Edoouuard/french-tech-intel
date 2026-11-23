// Pages indexables d'Insights French Tech : une page par startup, par fonds et par mois de levées,
// leurs index, et le sitemap. Rendues côté serveur à partir des mêmes données que le site
// (lignes *_BASE d'index.html), donc à jour à chaque déploiement, sans fichiers générés à committer.
const I = require("./insights.js");
const { build } = require("./model.js");

const SITE = "https://www.insights-french-tech.com";
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MIN_FUND_DEALS = 3; // en dessous, la fiche fonds serait trop mince pour être utile

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slugify = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " et ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return `${MOIS[+m - 1]} ${y}`; };
const MonthLabel = (ym) => { const l = monthLabel(ym); return l[0].toUpperCase() + l.slice(1); };
const amt = (m) => (m == null ? "n.c." : m >= 1000 ? (m / 1000).toFixed(1).replace(".", ",").replace(",0", "") + " Md€" : (m >= 10 ? Math.round(m) : Math.round(m * 10) / 10).toString().replace(".", ",") + " M€");
const dayLabel = (d) => (d.day ? `${d.day} ${monthLabel(d.date)}` : monthLabel(d.date));
const sum = (arr) => arr.reduce((s, x) => s + (x || 0), 0);
const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1).replace(/[\s,;:.]+\S*$/, "") + "…" : s || "");
const listFr = (a) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " et " + a[a.length - 1]);

function createPages(html, VEH) {
  const INS = I.parse(html);
  const M = build(INS, VEH);
  const D = INS.deals.filter((d) => d.company && d.date);
  const GENERIC = /^(business angels?|angels?|fondateurs?|founders?|family offices?|nc|nd|non communiqu.*|non divulgu.*|investisseurs? historiques?|actionnaires historiques.*|existing investors|undisclosed|dirigeants|management|autres?)$/i;

  // --- Startups : un slug unique par société (variantes de casse et d'accents regroupées)
  const startups = new Map(); // slug -> { name, deals }
  const startupSlug = new Map(); // norm(name) -> slug
  for (const d of D) {
    const k = I.norm(d.company);
    let slug = startupSlug.get(k);
    if (!slug) {
      slug = slugify(d.company);
      let n = 2; while (startups.has(slug)) slug = slugify(d.company) + "-" + n++;
      startupSlug.set(k, slug);
      startups.set(slug, { name: d.company, deals: [] });
    }
    startups.get(slug).deals.push(d);
  }
  const startupUrl = (name) => { const s = startupSlug.get(I.norm(name)); return s ? `/startup/${s}` : null; };

  // --- Fonds : entités investisseurs du modèle, hors business angels individuels et noms génériques
  const funds = new Map(); // slug -> { key, name }
  const fundSlugByKey = new Map();
  for (const e of M.listInvestors({ limit: 100000 })) {
    if (!e || !e.name || GENERIC.test(e.name.trim()) || (e.deals || []).length < MIN_FUND_DEALS) continue;
    const info = M.getInvestor(e.name);
    if (!info || /business angel/i.test(info.type || "")) continue;
    let slug = slugify(e.name), n = 2;
    while (funds.has(slug)) slug = slugify(e.name) + "-" + n++;
    funds.set(slug, { key: e.key, name: e.name });
    fundSlugByKey.set(e.key, slug);
  }
  // Retrouve la fiche fonds d'un nom d'investisseur tel qu'écrit sur une levée
  const fundUrlCache = new Map();
  const fundUrl = (name) => {
    if (fundUrlCache.has(name)) return fundUrlCache.get(name);
    let url = null;
    const info = GENERIC.test(String(name).trim()) ? null : M.getInvestor(name);
    if (info) for (const [slug, f] of funds) if (f.name === info.name) { url = `/fonds/${slug}`; break; }
    fundUrlCache.set(name, url);
    return url;
  };

  // --- Mois
  const months = new Map();
  for (const d of D) (months.get(d.date) || months.set(d.date, []).get(d.date)).push(d);
  const monthKeys = [...months.keys()].sort().reverse();
  const LATEST = INS.meta.latest_deal_month || monthKeys[0];

  // ---------- gabarit
  const css = `
:root{--bg:#0A1D30;--bg2:#0F2740;--line:rgba(206,224,242,.13);--fg:#E7EEF5;--muted:#8FA5BB;--accent:#F3B648;--signal:#72C6E3;color-scheme:dark}
@media (prefers-color-scheme:light){:root{--bg:#EDF1F4;--bg2:#fff;--line:rgba(10,29,48,.12);--fg:#0A1D30;--muted:#4F6478;--accent:#B9790A;--signal:#1D6E93;color-scheme:light}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:400 16px/1.6 "Hanken Grotesk","Helvetica Neue","Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--signal);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:980px;margin:0 auto;padding:0 20px}
header{border-bottom:1px solid var(--line);background:var(--bg2)}header .wrap{display:flex;gap:18px;align-items:center;height:56px;flex-wrap:wrap}
.brand{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-weight:700;color:var(--fg);letter-spacing:-.02em}
nav a{color:var(--muted);font-size:.92rem;margin-right:14px}nav a:hover{color:var(--fg)}
.cta{margin-left:auto;background:var(--accent);color:#1A1205!important;padding:6px 12px;border-radius:8px;font-weight:600;font-size:.88rem}
main{padding:28px 0 56px}h1,h2{font-family:"Bricolage Grotesque",system-ui,sans-serif;letter-spacing:-.02em;line-height:1.15}
h1{font-size:clamp(1.7rem,4vw,2.4rem);margin:.2em 0 .3em}h2{font-size:1.25rem;margin:2em 0 .6em}
.crumbs{font-size:.85rem;color:var(--muted)}.crumbs a{color:var(--muted)}
.lead{font-size:1.08rem;color:var(--fg);max-width:760px}
.kpis{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0}.kpi{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:12px 16px;min-width:150px}
.kpi b{display:block;font-size:1.35rem;font-family:"Bricolage Grotesque",system-ui,sans-serif}.kpi span{color:var(--muted);font-size:.85rem}
table{width:100%;border-collapse:collapse;font-size:.94rem}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:500;font-size:.82rem;text-transform:uppercase;letter-spacing:.05em}td.num{white-space:nowrap;font-variant-numeric:tabular-nums}
.muted{color:var(--muted)}.tags a,.tags span{display:inline-block;margin:0 6px 6px 0;padding:3px 10px;border:1px solid var(--line);border-radius:99px;font-size:.88rem}
.cols{columns:3 220px;column-gap:28px}.cols li{break-inside:avoid;margin-bottom:4px}ul.plain{list-style:none;padding:0}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:.85rem;padding:24px 0}
@media (max-width:640px){td.hide,th.hide{display:none}}`;

  function page({ path, title, description, h1, crumbs = [], body, jsonld = [], app = "/" }) {
    const url = SITE + path;
    const ld = [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ name: "Insights French Tech", path: "/" }, ...crumbs].map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: SITE + c.path })) }, ...jsonld];
    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Insights French Tech">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/icon-192.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..700&family=Hanken+Grotesk:wght@400;500;600&display=swap">
<style>${css}</style>
${ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head><body>
<header><div class="wrap"><a class="brand" href="/">Insights French Tech</a><nav><a href="/levees">Levées</a><a href="/startups">Startups</a><a href="/fonds">Fonds</a></nav><a class="cta" href="${esc(app)}">Ouvrir l'application</a></div></header>
<main class="wrap">
${crumbs.length ? `<div class="crumbs"><a href="/">Accueil</a>${crumbs.map((c, i) => " › " + (i < crumbs.length - 1 ? `<a href="${c.path}">${esc(c.name)}</a>` : esc(c.name))).join("")}</div>` : ""}
<h1>${esc(h1)}</h1>
${body}
</main>
<footer><div class="wrap">Insights French Tech : levées, exits, fonds VC et PE de la French Tech, mis à jour chaque semaine à partir de sources publiques. Données arrêtées à ${esc(monthLabel(LATEST))}. <a href="/">Explorer toutes les données</a> · <a href="/#mcp">Serveur MCP pour Claude et ChatGPT</a></div></footer>
</body></html>`;
  }

  const invLinks = (list) => list.map((n) => { const u = fundUrl(n); return u ? `<a href="${u}">${esc(n)}</a>` : esc(n); }).join(", ");
  const dealRows = (deals, { company = true } = {}) => `<table><thead><tr><th>Date</th>${company ? "<th>Startup</th>" : ""}<th>Stade</th><th>Montant</th><th class="hide">Investisseurs</th></tr></thead><tbody>${deals.map((d) => {
    const su = startupUrl(d.company);
    return `<tr><td class="num">${esc(dayLabel(d))}</td>${company ? `<td>${su ? `<a href="${su}">${esc(d.company)}</a>` : esc(d.company)}<div class="muted">${esc(d.sector_raw || "")}</div></td>` : ""}<td>${esc(d.stage_raw || "n.c.")}</td><td class="num">${esc(amt(d.amount_eur_m))}</td><td class="hide">${invLinks(d.investors)}</td></tr>`;
  }).join("")}</tbody></table>`;
  const byRecent = (a, b) => (b.date || "").localeCompare(a.date || "") || (b.day || 0) - (a.day || 0);

  // ---------- pages
  function startupPage(slug) {
    const s = startups.get(slug);
    if (!s) return null;
    const deals = s.deals.slice().sort(byRecent);
    const info = M.getStartup(s.name) || {};
    const pitch = info.pitch || deals.find((d) => d.pitch)?.pitch || "";
    const total = sum(deals.map((d) => d.amount_eur_m));
    const last = deals[0];
    const investors = [...new Set(deals.flatMap((d) => d.investors))].filter((x) => !GENERIC.test(x));
    const sector = last.sector_raw || info.sector || "";
    const exits = (info.exits || []).filter((o) => o.acquirer);
    const desc = `${s.name}${sector ? ` (${sector})` : ""} : ${deals.length > 1 ? `${deals.length} levées de fonds` : "levée de fonds"}${total ? `, ${amt(total)} au total` : ""}. Dernier tour : ${last.stage_raw || "tour"} ${last.amount_eur_m != null ? "de " + amt(last.amount_eur_m) + " " : ""}en ${monthLabel(last.date)}${last.investors.length ? " avec " + listFr(last.investors.slice(0, 3)) : ""}.`;
    const body = `<p class="lead">${esc(pitch)}</p>
<div class="kpis"><div class="kpi"><b>${esc(total ? amt(total) : "n.c.")}</b><span>levés au total (montants connus)</span></div><div class="kpi"><b>${deals.length}</b><span>${deals.length > 1 ? "tours recensés" : "tour recensé"}</span></div><div class="kpi"><b>${esc(MonthLabel(last.date))}</b><span>dernière levée (${esc(last.stage_raw || "n.c.")})</span></div>${sector ? `<div class="kpi"><b>${esc(sector)}</b><span>secteur</span></div>` : ""}</div>
<h2>Historique des levées de fonds de ${esc(s.name)}</h2>
${dealRows(deals, { company: false })}
${deals.some((d) => d.pitch && d.pitch !== pitch) ? deals.filter((d) => d.pitch && d.pitch !== pitch).map((d) => `<p class="muted"><b>${esc(d.stage_raw || "Tour")} (${esc(monthLabel(d.date))})</b> : ${esc(d.pitch)}</p>`).join("") : ""}
${investors.length ? `<h2>Investisseurs de ${esc(s.name)}</h2><div class="tags">${investors.map((n) => { const u = fundUrl(n); return u ? `<a href="${u}">${esc(n)}</a>` : `<span>${esc(n)}</span>`; }).join("")}</div>` : ""}
${exits.length ? `<h2>Opérations de M&amp;A</h2><ul>${exits.map((o) => `<li>${esc(o.type || "Opération")} par ${esc(o.acquirer)} (${esc(o.date ? monthLabel(o.date) : "date n.c.")})${o.amount_eur_m ? `, ${esc(amt(o.amount_eur_m))}` : ""}</li>`).join("")}</ul>` : ""}
<h2>Voir aussi</h2><p><a href="/levees/${last.date}">Toutes les levées de ${esc(monthLabel(last.date))}</a> · <a href="/startups">Toutes les startups</a></p>`;
    return page({
      path: `/startup/${slug}`, app: "/#startup:" + encodeURIComponent(s.name),
      title: `${s.name} : levées de fonds, investisseurs et montants | Insights French Tech`,
      description: truncate(desc, 158), h1: `${s.name} : levées de fonds et investisseurs`,
      crumbs: [{ name: "Startups", path: "/startups" }, { name: s.name, path: `/startup/${slug}` }], body,
      jsonld: [{ "@context": "https://schema.org", "@type": "Organization", name: s.name, description: pitch || undefined, funder: investors.slice(0, 20).map((n) => ({ "@type": "Organization", name: n })) }],
    });
  }

  function fundPage(slug) {
    const f = funds.get(slug);
    if (!f) return null;
    const v = M.getInvestor(f.name);
    if (!v) return null;
    const recent = (v.recent_deals || []).slice(0, 25);
    const obs = (v.thesis && v.thesis.observed) || {};
    const stages = (obs.main_stages || []).map((x) => `${x.name} (${x.share_pct} %)`);
    const sectors = (obs.main_sectors || []).map((x) => `${x.name} (${x.share_pct} %)`);
    const co = (v.frequent_coinvestors || []).slice(0, 12);
    const largest = (v.largest_deals || []).slice(0, 8);
    const desc = `${v.name} : ${v.deals_tracked} investissements recensés dans des startups françaises, dont ${v.deals_last_12m} sur 12 mois.${stages.length ? " Stades : " + stages.slice(0, 2).join(", ") + "." : ""}${sectors.length ? " Secteurs : " + sectors.slice(0, 2).join(", ") + "." : ""} Derniers deals et co-investisseurs.`;
    const asDeal = (x) => ({ company: x.company, date: x.date, day: null, stage_raw: x.stage, amount_eur_m: x.amount_eur_m, sector_raw: x.sector, investors: x.investors || [] });
    const body = `<p class="lead">${esc(v.type || "Investisseur")}${v.focus ? " · " + esc(v.focus) : ""}${v.ticket_eur_m ? " · ticket annoncé " + esc(v.ticket_eur_m) + " M€" : ""}</p>
<div class="kpis"><div class="kpi"><b>${v.deals_tracked}</b><span>investissements recensés en France</span></div><div class="kpi"><b>${v.deals_last_12m}</b><span>sur les 12 derniers mois</span></div>${obs.median_round_eur_m ? `<div class="kpi"><b>${esc(amt(obs.median_round_eur_m))}</b><span>taille médiane des tours</span></div>` : ""}${v.activity && v.activity.total_rounds_cofinanced_eur_m ? `<div class="kpi"><b>${esc(amt(v.activity.total_rounds_cofinanced_eur_m))}</b><span>montant total des tours cofinancés</span></div>` : ""}</div>
${stages.length || sectors.length ? `<h2>Où investit ${esc(v.name)}</h2><p>${stages.length ? `<b>Stades</b> : ${esc(stages.join(", "))}<br>` : ""}${sectors.length ? `<b>Secteurs</b> : ${esc(sectors.join(", "))}` : ""}</p>` : ""}
<h2>Derniers investissements de ${esc(v.name)}</h2>
${dealRows(recent.map(asDeal))}
${largest.length ? `<h2>Plus gros tours</h2>${dealRows(largest.map(asDeal))}` : ""}
${co.length ? `<h2>Co-investisseurs fréquents</h2><div class="tags">${co.map((c) => { const u = fundUrl(c.name); return (u ? `<a href="${u}">` : "<span>") + esc(c.name) + ` (${c.deals_together})` + (u ? "</a>" : "</span>"); }).join("")}</div>` : ""}
<h2>Voir aussi</h2><p><a href="/fonds">Tous les fonds</a> · <a href="/#fonds">Fonds en déploiement dans l'application</a></p>`;
    return page({
      path: `/fonds/${slug}`, app: "/#ent:" + encodeURIComponent(f.key),
      title: `${v.name} : investissements en France, stades et secteurs | Insights French Tech`,
      description: truncate(desc, 158), h1: `${v.name} : investissements dans la French Tech`,
      crumbs: [{ name: "Fonds", path: "/fonds" }, { name: v.name, path: `/fonds/${slug}` }], body,
    });
  }

  function monthPage(ym) {
    const deals = (months.get(ym) || []).slice().sort(byRecent);
    if (!deals.length) return null;
    const total = sum(deals.map((d) => d.amount_eur_m));
    const top = deals.filter((d) => d.amount_eur_m != null).sort((a, b) => b.amount_eur_m - a.amount_eur_m).slice(0, 3);
    const bySector = Object.entries(deals.reduce((a, d) => { const k = d.sector_raw || "Autre"; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const i = monthKeys.indexOf(ym);
    const prev = monthKeys[i + 1], next = monthKeys[i - 1];
    const partial = ym === LATEST;
    const desc = `Levées de fonds des startups françaises en ${monthLabel(ym)} : ${deals.length} tours${total ? ` pour ${amt(total)}` : ""}${top.length ? `, dont ${listFr(top.map((d) => `${d.company} (${amt(d.amount_eur_m)})`))}` : ""}.`;
    const body = `<p class="lead">${deals.length} levées de fonds recensées${total ? ` pour ${esc(amt(total))} de montants communiqués` : ""}${partial ? " (mois en cours, mis à jour chaque semaine)" : ""}.</p>
<div class="kpis"><div class="kpi"><b>${deals.length}</b><span>levées</span></div><div class="kpi"><b>${esc(total ? amt(total) : "n.c.")}</b><span>montants communiqués</span></div>${top[0] ? `<div class="kpi"><b>${esc(top[0].company)}</b><span>plus gros tour (${esc(amt(top[0].amount_eur_m))})</span></div>` : ""}</div>
<p class="tags">${bySector.map(([k, n]) => `<span>${esc(k)} · ${n}</span>`).join("")}</p>
<h2>Toutes les levées de ${esc(monthLabel(ym))}</h2>
${dealRows(deals)}
<p>${prev ? `<a href="/levees/${prev}">← ${esc(MonthLabel(prev))}</a>` : ""}${prev && next ? " · " : ""}${next ? `<a href="/levees/${next}">${esc(MonthLabel(next))} →</a>` : ""} · <a href="/levees">Tous les mois</a></p>`;
    return page({
      path: `/levees/${ym}`, title: `Levées de fonds French Tech ${monthLabel(ym)} : ${deals.length} startups | Insights French Tech`,
      description: truncate(desc, 158), h1: `Levées de fonds des startups françaises : ${monthLabel(ym)}`,
      crumbs: [{ name: "Levées", path: "/levees" }, { name: MonthLabel(ym), path: `/levees/${ym}` }], body,
    });
  }

  function leveesIndex() {
    const years = [...new Set(monthKeys.map((k) => k.slice(0, 4)))];
    const body = `<p class="lead">Toutes les levées de fonds des startups françaises, mois par mois, avec montants, stades et investisseurs.</p>
${years.map((y) => `<h2>${y}</h2><ul class="plain cols">${monthKeys.filter((k) => k.startsWith(y)).map((k) => { const ds = months.get(k); const t = sum(ds.map((d) => d.amount_eur_m)); return `<li><a href="/levees/${k}">${esc(MonthLabel(k))}</a> <span class="muted">· ${ds.length} levées${t ? ", " + esc(amt(t)) : ""}</span></li>`; }).join("")}</ul>`).join("")}`;
    return page({ path: "/levees", title: "Levées de fonds de la French Tech, mois par mois | Insights French Tech", description: "Toutes les levées de fonds des startups françaises classées par mois : montants, stades, secteurs et investisseurs, mises à jour chaque semaine.", h1: "Levées de fonds de la French Tech", crumbs: [{ name: "Levées", path: "/levees" }], body });
  }

  function startupsIndex() {
    const list = [...startups.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, "fr", { sensitivity: "base" }));
    const groups = new Map();
    list.forEach(([slug, s]) => { const L = /^[a-z]/i.test(slug[0]) ? slug[0].toUpperCase() : "0-9"; (groups.get(L) || groups.set(L, []).get(L)).push([slug, s]); });
    const body = `<p class="lead">${list.length} startups françaises qui ont levé des fonds, avec l'historique de leurs tours et leurs investisseurs.</p>
<p class="tags">${[...groups.keys()].map((L) => `<a href="#l-${L}">${L}</a>`).join("")}</p>
${[...groups.entries()].map(([L, arr]) => `<h2 id="l-${L}">${L}</h2><ul class="plain cols">${arr.map(([slug, s]) => `<li><a href="/startup/${slug}">${esc(s.name)}</a></li>`).join("")}</ul>`).join("")}`;
    return page({ path: "/startups", title: `Startups françaises financées : ${list.length} fiches | Insights French Tech`, description: `Annuaire de ${list.length} startups françaises ayant levé des fonds : montants, stades, dates et investisseurs de chaque tour.`, h1: "Startups françaises financées", crumbs: [{ name: "Startups", path: "/startups" }], body });
  }

  function fondsIndex() {
    const rows = [...funds.entries()].map(([slug, f]) => { const v = M.getInvestor(f.name); return { slug, name: f.name, n: v ? v.deals_tracked : 0, n12: v ? v.deals_last_12m : 0, type: v ? v.type : "" }; }).sort((a, b) => b.n12 - a.n12 || b.n - a.n);
    const body = `<p class="lead">${rows.length} fonds et investisseurs actifs dans les startups françaises, classés par nombre de deals sur les 12 derniers mois.</p>
<table><thead><tr><th>Investisseur</th><th class="hide">Type</th><th>Deals 12 mois</th><th>Deals recensés</th></tr></thead><tbody>${rows.map((r) => `<tr><td><a href="/fonds/${r.slug}">${esc(r.name)}</a></td><td class="hide">${esc(r.type)}</td><td class="num">${r.n12}</td><td class="num">${r.n}</td></tr>`).join("")}</tbody></table>`;
    return page({ path: "/fonds", title: `Fonds VC actifs en France : ${rows.length} investisseurs | Insights French Tech`, description: "Les fonds VC et investisseurs les plus actifs dans la French Tech : nombre de deals, stades, secteurs, derniers investissements et co-investisseurs.", h1: "Fonds et investisseurs de la French Tech", crumbs: [{ name: "Fonds", path: "/fonds" }], body });
  }

  function sitemap() {
    const lastmod = new Date().toISOString().slice(0, 10);
    const urls = [
      { loc: "/", pr: "1.0", cf: "weekly" }, { loc: "/levees", pr: "0.9", cf: "weekly" }, { loc: "/startups", pr: "0.8", cf: "weekly" }, { loc: "/fonds", pr: "0.8", cf: "weekly" },
      ...monthKeys.map((k) => ({ loc: `/levees/${k}`, pr: k === LATEST ? "0.8" : "0.6", cf: k === LATEST ? "weekly" : "monthly" })),
      ...[...funds.keys()].map((s) => ({ loc: `/fonds/${s}`, pr: "0.7", cf: "weekly" })),
      ...[...startups.keys()].map((s) => ({ loc: `/startup/${s}`, pr: "0.6", cf: "monthly" })),
    ];
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${SITE}${u.loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${u.cf}</changefreq><priority>${u.pr}</priority></url>`).join("\n")}\n</urlset>\n`;
  }

  function render(pathname) {
    const p = decodeURIComponent(pathname).replace(/\/+$/, "") || "/";
    let m;
    if (p === "/sitemap.xml") return { type: "application/xml; charset=utf-8", body: sitemap() };
    if (p === "/levees") return { body: leveesIndex() };
    if (p === "/startups") return { body: startupsIndex() };
    if (p === "/fonds") return { body: fondsIndex() };
    if ((m = p.match(/^\/levees\/(\d{4}-\d{2})$/))) return { body: monthPage(m[1]) };
    if ((m = p.match(/^\/startup\/([a-z0-9-]+)$/))) return { body: startupPage(m[1]) };
    if ((m = p.match(/^\/fonds\/([a-z0-9-]+)$/))) return { body: fundPage(m[1]) };
    return { body: null };
  }

  return { render, counts: { startups: startups.size, funds: funds.size, months: monthKeys.length }, startupSlugs: [...startups.keys()], fundSlugs: [...funds.keys()], monthKeys };
}

module.exports = { createPages, slugify };
