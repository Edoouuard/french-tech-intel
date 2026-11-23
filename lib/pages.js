// Pages indexables d'Insights French Tech : une page par startup, par fonds et par mois de levées,
// leurs index, le sitemap et la table de correspondance utilisée par l'application.
// Rendues côté serveur à partir des mêmes données que le site (lignes *_BASE d'index.html) et
// habillées avec la feuille de style du site (servie sur /site.css), donc identiques visuellement
// et à jour à chaque déploiement, sans fichiers générés à committer.
const I = require("./insights.js");
const { build } = require("./model.js");

const SITE = "https://www.insights-french-tech.com";
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS_C = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MIN_FUND_DEALS = 3; // en dessous, la fiche fonds serait trop mince pour être utile
const STAGE_ORDER = ["Pre-seed", "Seed", "Série A", "Série B", "Série C", "Growth", "Post-IPO", "Secondary", "NC"];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slugify = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " et ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return `${MOIS[+m - 1]} ${y}`; };
const MonthLabel = (ym) => { const l = monthLabel(ym); return l[0].toUpperCase() + l.slice(1); };
const shortDate = (d) => { const [y, m] = d.date.split("-"); return (d.day ? d.day + " " : "") + MOIS_C[+m - 1] + " " + y.slice(2); };
const amt = (m) => (m == null ? "n.c." : m >= 1000 ? "€" + (m / 1000).toFixed(m >= 10000 ? 0 : 1).replace(".", ",").replace(",0", "") + " Md" : m >= 10 ? "€" + Math.round(m) + "M" : "€" + String(Math.round(m * 10) / 10).replace(".", ",") + "M");
const amtLong = (m) => (m == null ? "montant non communiqué" : m >= 1000 ? (m / 1000).toFixed(1).replace(".", ",").replace(",0", "") + " Md€" : String(m >= 10 ? Math.round(m) : Math.round(m * 10) / 10).replace(".", ",") + " M€");
const sum = (arr) => arr.reduce((s, x) => s + (x || 0), 0);
const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1).replace(/[\s,;:.]+\S*$/, "") + "…" : s || "");
const listFr = (a) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " et " + a[a.length - 1]);
const initials = (n) => String(n).split(/[\s-]+/).filter((w) => /[A-Za-zÀ-ÿ0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "·";
const stageColor = (s) => `var(--s${Math.min(6, Math.max(0, STAGE_ORDER.indexOf(s || "NC")))})`;
const pill = (s) => `<span class="pill"><i style="background:${stageColor(s)}"></i>${esc(s || "NC")}</span>`;

// Feuille de style du site : le bloc <style> d'index.html, complété par les styles propres aux pages.
const PAGE_CSS = `
.top .tabs a.tab{text-decoration:none}
.top .tabs a.tab[aria-current="page"]{color:var(--fg)}
.top .tabs a.tab[aria-current="page"]::after{content:"";position:absolute;left:14px;right:14px;bottom:0;height:2px;border-radius:2px;background:var(--accent)}
.top a.searchbtn{text-decoration:none}
.crumbs{font-family:var(--f-mono);font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:14px}
.crumbs a{color:var(--muted);text-decoration:none}.crumbs a:hover{color:var(--accent)}
.hero{display:flex;gap:18px;align-items:center;margin-bottom:10px}
.hero .av{width:64px;height:64px;border-radius:18px;font-size:1.1rem}
.view-head.pg{align-items:flex-start;margin-bottom:22px}
.view-head.pg h1{max-width:22ch}
.view-head.pg .lede{max-width:62ch;margin-top:12px;color:var(--fg);opacity:.86;font-size:1.04rem;line-height:1.6}
.head-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.tagrow{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
a.kpi{display:block;color:inherit;text-decoration:none;cursor:default}
.kpi .v.sm{font-size:clamp(1.5rem,2.6vw,2rem)}
.sec{margin-top:16px}
a.tr{color:inherit;text-decoration:none}
.t-pdeals{grid-template-columns:72px minmax(0,2fr) 96px 80px minmax(0,2.6fr)}
.t-pstart{grid-template-columns:72px 96px 80px minmax(0,3fr)}
@media (max-width:860px){.t-pdeals,.t-pstart{grid-template-columns:minmax(0,1fr) auto;gap:4px 12px}.t-pdeals>:nth-child(1),.t-pstart>:nth-child(1){grid-column:1/-1}.t-pdeals>.inv,.t-pstart>.inv{grid-column:1/-1}}
.inv a{color:var(--signal);text-decoration:none}.inv a:hover{text-decoration:underline}
.tl{position:relative;padding-left:22px}
.tl::before{content:"";position:absolute;left:6px;top:8px;bottom:8px;width:2px;background:var(--line-strong);border-radius:2px}
.tl-it{position:relative;padding:4px 0 18px}
.tl-it::before{content:"";position:absolute;left:-21px;top:9px;width:12px;height:12px;border-radius:50%;background:var(--bg-2);border:3px solid var(--accent)}
.tl-it .when{font-family:var(--f-mono);font-size:.72rem;color:var(--muted);letter-spacing:.04em}
.tl-it .what{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin:4px 0 6px}
.tl-it .what b{font-family:var(--f-display);font-size:1.5rem;font-weight:500;letter-spacing:-.03em}
.tl-it p{font-size:.92rem;line-height:1.55;opacity:.86;max-width:70ch}
.tl-it .inv{margin-top:8px;font-size:.86rem;color:var(--muted)}
a.chip{text-decoration:none;display:inline-flex;align-items:center;gap:6px}
a.chip:hover{color:var(--fg);border-color:var(--fg)}
.chip .n{font-family:var(--f-mono);font-size:.7rem;color:var(--accent)}
a.icard{color:inherit;text-decoration:none}
.cta{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:16px;align-items:center;padding:18px 20px;border:1px solid color-mix(in srgb,var(--accent) 45%,var(--line));border-radius:var(--r);background:linear-gradient(120deg,color-mix(in srgb,var(--accent) 12%,var(--bg-2)),var(--bg-2) 60%)}
.cta .ic{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:var(--fg);color:var(--bg)}
.cta b{font-family:var(--f-display);font-size:1.05rem}.cta p{font-size:.88rem;color:var(--muted);margin-top:2px}
@media (max-width:700px){.cta{grid-template-columns:1fr}.cta .ic{display:none}}
.mbars{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px;align-items:end;height:150px;margin-top:6px}
.mbars a{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px;height:100%;text-decoration:none;color:var(--muted);font-family:var(--f-mono);font-size:.64rem}
.mbars a i{display:block;width:100%;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,var(--signal),color-mix(in srgb,var(--signal) 45%,transparent));min-height:3px;transition:filter .2s}
.mbars a:hover{color:var(--fg)}.mbars a:hover i{filter:brightness(1.2)}
.mbars a.cur i{background:linear-gradient(180deg,var(--accent),color-mix(in srgb,var(--accent) 45%,transparent))}
.mbars a span.n{color:var(--fg)}
.mbars a.empty{pointer-events:none;opacity:.35}
.pnav{display:flex;justify-content:space-between;gap:10px;margin-top:16px;flex-wrap:wrap}
.search-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.search-row .input{flex:1 1 280px;font-size:1rem;padding:12px 14px}
.letters{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}
.letters a{font-family:var(--f-mono);font-size:.74rem;min-width:28px;height:28px;display:grid;place-items:center;border:1px solid var(--line);border-radius:8px;color:var(--muted);text-decoration:none}
.letters a:hover{border-color:var(--accent);color:var(--fg)}
.lgroup h3{font-family:var(--f-mono);font-size:.8rem;color:var(--accent);margin:18px 0 4px;letter-spacing:.1em}
a.lrow{color:inherit;text-decoration:none}
.lrow .v.muted{color:var(--muted)}
.count{font-family:var(--f-mono);font-size:.74rem;color:var(--muted)}
[data-hide]{display:none!important}
.mcp-ask{font-size:.9rem;color:var(--muted);margin-top:10px}.mcp-ask code{font-family:var(--f-mono);font-size:.8rem;color:var(--fg);background:var(--bg-3);padding:2px 6px;border-radius:6px}
`;

function createPages(html, VEH, logosJs) {
  const INS = I.parse(html);
  const M = build(INS, VEH);
  const D = INS.deals.filter((d) => d.company && d.date);
  const GENERIC = /^(business angels?|angels?|fondateurs?|founders?|family offices?|nc|nd|non communiqu.*|non divulgu.*|investisseurs? historiques?|actionnaires historiques.*|existing investors|undisclosed|dirigeants|management|autres?)$/i;
  const siteCss = (() => { const m = html.match(/<style>([\s\S]*?)<\/style>/); return (m ? m[1] : "") + PAGE_CSS; })();

  // Logos des investisseurs (même clé que l'application : nom réduit à son cœur, sans parenthèses)
  let LOGOS = {};
  if (logosJs) { const i = logosJs.indexOf("{"), j = logosJs.lastIndexOf("}"); try { LOGOS = JSON.parse(logosJs.slice(i, j + 1)); } catch (e) { LOGOS = {}; } }
  const logoKey = (n) => I.coreName(String(n || "").replace(/\(.*?\)/g, " "));
  // Les logos sont servis à part (/logo/<clé>, cache long) pour garder des pages légères.
  const avatar = (name, cls = "av") => { const k = logoKey(name); return LOGOS[k] ? `<span class="${cls} has-logo"><img src="/logo/${encodeURIComponent(k)}" alt="" loading="lazy" width="32" height="32"></span>` : `<span class="${cls}">${esc(initials(name))}</span>`; };
  const logoFile = (k) => { const src = LOGOS[k]; const m = src && src.match(/^data:([^;,]+);base64,(.*)$/); return m ? { type: m[1], body: Buffer.from(m[2], "base64"), immutable: true } : null; };

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
  const funds = new Map(); // slug -> { key, name, info }
  const fundByName = new Map();
  for (const e of M.listInvestors({ limit: 100000 })) {
    if (!e || !e.name || GENERIC.test(e.name.trim()) || (e.deals || []).length < MIN_FUND_DEALS) continue;
    const info = M.getInvestor(e.name);
    if (!info || /business angel/i.test(info.type || "")) continue;
    let slug = slugify(e.name), n = 2;
    while (funds.has(slug)) slug = slugify(e.name) + "-" + n++;
    funds.set(slug, { key: e.key, name: e.name, info });
    fundByName.set(info.name, slug);
  }
  const fundUrlCache = new Map();
  const fundUrl = (name) => {
    if (fundUrlCache.has(name)) return fundUrlCache.get(name);
    let url = null;
    const info = GENERIC.test(String(name).trim()) ? null : M.getInvestor(name);
    if (info && fundByName.has(info.name)) url = `/fonds/${fundByName.get(info.name)}`;
    fundUrlCache.set(name, url);
    return url;
  };

  // --- Mois
  const months = new Map();
  for (const d of D) (months.get(d.date) || months.set(d.date, []).get(d.date)).push(d);
  const monthKeys = [...months.keys()].sort().reverse();
  const LATEST = INS.meta.latest_deal_month || monthKeys[0];
  const byRecent = (a, b) => (b.date || "").localeCompare(a.date || "") || (b.day || 0) - (a.day || 0);

  // ---------- gabarit commun
  const LOGO_SVG = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="29" height="29" rx="9" stroke="currentColor" stroke-width="1.5"/><path d="M8 22V14M13 22V10M18 22v-6M23 22V8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".55"/><circle cx="23" cy="8" r="2.8" fill="var(--accent)"/></svg>`;
  const MCP_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h10M4 18h7"/><path d="m16 15 3 3-3 3"/></svg>`;
  const TABS = [["/", "Vue d'ensemble", "home"], ["/levees", "Levées par mois", "levees"], ["/startups", "Startups", "startups"], ["/fonds", "Fonds", "fonds"], ["/#mcp", "MCP", "mcp"]];

  function page({ path, title, description, h1, lede = "", crumbs = [], head = "", body, jsonld = [], app = "/", nav, script = "" }) {
    const url = SITE + path;
    const ld = [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ name: "Insights French Tech", path: "/" }, ...crumbs].map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: SITE + c.path })) }, ...jsonld];
    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<script>try{var t=localStorage.getItem("ift-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Insights French Tech"><meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary"><meta name="theme-color" content="#0A1D30">
<link rel="icon" href="/icon-192.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.json">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Hanken+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/site.css">
${ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head><body>
<header class="top"><div class="wrap">
  <div class="top-row">
    <a class="brand" href="/" aria-label="Insights French Tech, accueil">${LOGO_SVG}Insights French Tech <small>INTELLIGENCE</small></a>
    <span class="live">Mis à jour chaque lundi</span>
    <a class="searchbtn" href="/startups#q" aria-label="Rechercher"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>Startup, fonds…</span></a>
    <button class="themebtn" id="themeBtn" type="button" aria-label="Changer de thème"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/></svg></button>
  </div>
  <nav class="tabs" aria-label="Sections">${TABS.map(([href, label, key]) => `<a class="tab" href="${href}"${key === nav ? ' aria-current="page"' : ""}>${esc(label)}</a>`).join("")}</nav>
</div></header>
<main class="wrap">
  ${crumbs.length ? `<nav class="crumbs" aria-label="Fil d'Ariane"><a href="/">Accueil</a>${crumbs.map((c, i) => " / " + (i < crumbs.length - 1 ? `<a href="${c.path}">${esc(c.name)}</a>` : esc(c.name))).join("")}</nav>` : ""}
  <div class="view-head pg"><div>${head}<h1>${h1}</h1>${lede ? `<p class="lede">${lede}</p>` : ""}${app ? `<div class="head-acts"><a class="btn btn-primary sm" href="${esc(app)}">Ouvrir dans l'application →</a></div>` : ""}</div></div>
  ${body}
  <div class="cta sec"><span class="ic">${MCP_SVG}</span><div><b>Interrogez ces données depuis Claude ou ChatGPT</b><p>Branchez le serveur MCP d'Insights French Tech : votre assistant cherche lui-même les levées, les fonds et les comparables.</p></div><a class="btn sm" href="/#mcp">Comment ça marche →</a></div>
</main>
<footer><div class="wrap"><span>Insights French Tech · levées, exits, fonds VC et PE de la French Tech, à partir de sources publiques. Données à jour : ${esc(monthLabel(LATEST))}.</span><span><a href="/levees">Levées par mois</a> · <a href="/startups">Startups</a> · <a href="/fonds">Fonds</a> · <a href="/#mcp">MCP</a></span></div></footer>
<script>document.getElementById("themeBtn").addEventListener("click",function(){var r=document.documentElement,c=r.dataset.theme||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"),n=c==="light"?"dark":"light";r.dataset.theme=n;try{localStorage.setItem("ift-theme",n)}catch(e){}});${script}</script>
</body></html>`;
  }

  const kpi = (k, v, s, cls = "c3", small = false) => `<div class="kpi ${cls}"><span class="k">${esc(k)}</span><span class="v${small ? " sm" : ""}">${esc(v)}</span>${s ? `<span class="s">${esc(s)}</span>` : ""}</div>`;
  const panel = (title, note, inner, cls = "") => `<section class="panel sec ${cls}"><div class="ph"><h3>${title}</h3>${note ? `<p>${note}</p>` : ""}</div>${inner}</section>`;
  const invLinks = (list) => list.map((n) => { const u = fundUrl(n); return u ? `<a href="${u}">${esc(n)}</a>` : esc(n); }).join(", ");
  const dealTable = (deals) => `<div class="table"><div class="tr head t-pdeals"><span>Date</span><span>Startup</span><span>Stade</span><span class="r">Montant</span><span>Investisseurs</span></div>${deals.map((d) => {
    const su = startupUrl(d.company);
    return `<a class="tr row t-pdeals" href="${su || "#"}"><span class="dt">${esc(shortDate(d))}</span><span class="nm">${esc(d.company)}<small>${esc(d.sector_raw || "")}${d.pitch ? " · " + esc(truncate(d.pitch, 90)) : ""}</small></span><span>${pill(d.stage_raw)}</span><span class="r amt">${esc(amt(d.amount_eur_m))}</span><span class="inv">${esc(d.investors.join(", "))}</span></a>`;
  }).join("")}</div>`;
  const hbars = (rows, fmt = (n) => n, link = () => null) => { const mx = Math.max(1, ...rows.map((r) => r[1])); return rows.map(([k, n]) => { const u = link(k); const inner = `<span>${esc(k)}</span><span class="t"><i style="width:${Math.max(2, (n / mx) * 100).toFixed(1)}%"></i></span><span class="r">${esc(fmt(n))}</span>`; return u ? `<a class="hbar" href="${u}" style="color:inherit;text-decoration:none">${inner}</a>` : `<div class="hbar" style="cursor:default">${inner}</div>`; }).join(""); };
  const stageBar = (deals) => {
    const c = {}; deals.forEach((d) => { const s = STAGE_ORDER.includes(d.stage_raw) ? d.stage_raw : "NC"; c[s] = (c[s] || 0) + 1; });
    const rows = STAGE_ORDER.filter((s) => c[s]).map((s) => [s, c[s]]);
    const tot = sum(rows.map((r) => r[1]));
    return `<div class="stagebar">${rows.map(([s, n]) => `<div style="flex:${n};background:${stageColor(s)};cursor:default" title="${esc(s)} : ${n}">${n / tot > 0.08 ? n : ""}</div>`).join("")}</div><div style="margin-top:10px">${rows.map(([s, n]) => `<div class="srow" style="cursor:default"><i style="background:${stageColor(s)}"></i><span>${esc(s)}</span><span class="r">${n}</span><span class="r">${Math.round((n / tot) * 100)} %</span></div>`).join("")}</div>`;
  };
  const chips = (names, withCount = null) => `<div class="chips">${names.map((n) => { const u = fundUrl(n); const cnt = withCount ? `<span class="n">${withCount(n)}</span>` : ""; return u ? `<a class="chip chip-logo" href="${u}">${avatar(n, "av xs")}${esc(n)}${cnt}</a>` : `<span class="chip chip-logo" style="cursor:default">${avatar(n, "av xs")}${esc(n)}${cnt}</span>`; }).join("")}</div>`;

  // ---------- pages
  function startupPage(slug) {
    const s = startups.get(slug);
    if (!s) return null;
    const deals = s.deals.slice().sort(byRecent);
    const info = M.getStartup(s.name) || {};
    const pitch = info.pitch || deals.find((d) => d.pitch)?.pitch || "";
    const total = sum(deals.map((d) => d.amount_eur_m));
    const last = deals[0], first = deals[deals.length - 1];
    const investors = [...new Set(deals.flatMap((d) => d.investors))].filter((x) => !GENERIC.test(x));
    const sector = last.sector_raw || info.sector || "";
    const exits = (info.exits || []).filter((o) => o.acquirer);
    const peers = D.filter((d) => d.sector_raw === sector && I.norm(d.company) !== I.norm(s.name)).sort(byRecent).slice(0, 8);
    const desc = `${s.name}${sector ? ` (${sector})` : ""} : ${deals.length > 1 ? `${deals.length} levées de fonds` : "levée de fonds"}${total ? `, ${amtLong(total)} au total` : ""}. Dernier tour : ${last.stage_raw || "tour"} ${last.amount_eur_m != null ? "de " + amtLong(last.amount_eur_m) + " " : ""}en ${monthLabel(last.date)}${last.investors.length ? " avec " + listFr(last.investors.slice(0, 3)) : ""}.`;
    const timeline = `<div class="tl">${deals.map((d) => `<div class="tl-it"><div class="when">${esc(d.day ? `${d.day} ${monthLabel(d.date)}` : MonthLabel(d.date))}</div><div class="what"><b class="amt">${esc(amtLong(d.amount_eur_m))}</b>${pill(d.stage_raw)}</div>${d.pitch && d.pitch !== pitch ? `<p>${esc(d.pitch)}</p>` : ""}${d.investors.length ? `<div class="inv">Avec ${invLinks(d.investors)}</div>` : ""}</div>`).join("")}</div>`;
    const body = `<div class="grid">${kpi("Total levé", total ? amtLong(total) : "n.c.", "montants communiqués")}${kpi("Tours recensés", String(deals.length), deals.length > 1 ? `depuis ${monthLabel(first.date)}` : monthLabel(first.date))}${kpi("Dernier tour", last.stage_raw || "NC", MonthLabel(last.date), "c3", true)}${kpi("Investisseurs", String(investors.length), "fonds et business angels cités", "c3")}</div>
<div class="grid">
  ${panel(`Historique des levées de ${esc(s.name)}`, "du plus récent au plus ancien", timeline, "c7")}
  ${panel(`Investisseurs de ${esc(s.name)}`, investors.length ? `${investors.length} au capital` : "", investors.length ? chips(investors) : `<p class="muted">Investisseurs non communiqués.</p>`, "c5")}
</div>
${exits.length ? panel("Opérations de M&amp;A", "", `<div class="table">${exits.map((o) => `<div class="tr t-pstart" style="grid-template-columns:90px minmax(0,1fr) 90px"><span class="dt">${esc(o.date ? MonthLabel(o.date) : "n.c.")}</span><span class="nm">${esc(o.type || "Opération")} par ${esc(o.acquirer)}</span><span class="r amt">${esc(amt(o.amount_eur_m))}</span></div>`).join("")}</div>`) : ""}
${peers.length ? panel(`Autres levées récentes en ${esc(sector)}`, `<a href="/levees/${last.date}">Toutes les levées de ${esc(monthLabel(last.date))} →</a>`, dealTable(peers)) : ""}`;
    return page({
      path: `/startup/${slug}`, app: "/#startup:" + encodeURIComponent(s.name), nav: "startups",
      title: `${s.name} : levées de fonds, investisseurs et montants | Insights French Tech`,
      description: truncate(desc, 158), h1: `${esc(s.name)} <em>levées de fonds</em>`,
      head: `<div class="tagrow" style="margin:0 0 12px">${sector ? `<span class="tag">${esc(sector)}</span>` : ""}${pill(last.stage_raw)}</div>`,
      lede: esc(pitch), crumbs: [{ name: "Startups", path: "/startups" }, { name: s.name, path: `/startup/${slug}` }], body,
      jsonld: [{ "@context": "https://schema.org", "@type": "Organization", name: s.name, description: pitch || undefined, url: SITE + `/startup/${slug}`, funder: investors.slice(0, 20).map((n) => ({ "@type": "Organization", name: n })) }],
    });
  }

  function fundPage(slug) {
    const f = funds.get(slug);
    if (!f) return null;
    const v = f.info;
    const recent = (v.recent_deals || []).slice(0, 25);
    const obs = (v.thesis && v.thesis.observed) || {};
    const act = v.activity || {};
    const co = (v.frequent_coinvestors || []).slice(0, 16);
    const largest = (v.largest_deals || []).slice(0, 8);
    const asDeal = (x) => ({ company: x.company, date: x.date, day: null, stage_raw: x.stage, amount_eur_m: x.amount_eur_m, sector_raw: x.sector, investors: x.investors || [], pitch: x.pitch });
    const years = Object.entries(act.by_year || {}).sort((a, b) => a[0].localeCompare(b[0]));
    const stages = (act.by_stage || []).slice(0, 7), sectors = (act.by_sector || []).slice(0, 8);
    const mainSt = (obs.main_stages || []).map((x) => `${x.name} (${x.share_pct} %)`), mainSe = (obs.main_sectors || []).map((x) => `${x.name} (${x.share_pct} %)`);
    const desc = `${v.name} : ${v.deals_tracked} investissements recensés dans des startups françaises, dont ${v.deals_last_12m} sur 12 mois.${mainSt.length ? " Stades : " + mainSt.slice(0, 2).join(", ") + "." : ""}${mainSe.length ? " Secteurs : " + mainSe.slice(0, 2).join(", ") + "." : ""} Derniers deals et co-investisseurs.`;
    const lede = [v.focus && v.focus !== "Tous secteurs" ? esc(v.focus) : "", mainSt.length ? `Investit surtout en ${esc(listFr((obs.main_stages || []).slice(0, 2).map((x) => x.name)))}` : "", mainSe.length ? `principalement ${esc(listFr((obs.main_sectors || []).slice(0, 2).map((x) => x.name)))}` : ""].filter(Boolean).join(", ") + (mainSt.length || mainSe.length ? "." : "");
    const body = `<div class="grid">${kpi("Deals recensés", String(v.deals_tracked), "dans des startups françaises")}${kpi("12 derniers mois", String(v.deals_last_12m), "nouveaux investissements")}${kpi("Tour médian", obs.median_round_eur_m ? amtLong(obs.median_round_eur_m) : "n.c.", obs.round_iqr_eur_m ? `la moitié entre ${amtLong(obs.round_iqr_eur_m[0])} et ${amtLong(obs.round_iqr_eur_m[1])}` : "taille des tours cofinancés", "c3", true)}${kpi("Ticket annoncé", v.ticket_eur_m ? v.ticket_eur_m.replace("→", " à ") + " M€" : "n.c.", v.type || "", "c3", true)}</div>
<div class="grid">
  ${panel("Stades", "répartition des deals", stages.length ? stageBar(stages.flatMap(([s, n]) => Array(n).fill({ stage_raw: s }))) : "", "c4")}
  ${panel("Secteurs", "nombre de deals", hbars(sectors), "c4")}
  ${panel("Activité par an", "deals recensés", hbars(years), "c4")}
</div>
${panel(`Derniers investissements de ${esc(v.name)}`, `${recent.length} plus récents`, dealTable(recent.map(asDeal)))}
${largest.length ? panel("Plus gros tours cofinancés", "", dealTable(largest.map(asDeal))) : ""}
${co.length ? panel("Co-investisseurs fréquents", "nombre de deals en commun", chips(co.map((c) => c.name), (n) => (co.find((c) => c.name === n) || {}).deals_together)) : ""}`;
    return page({
      path: `/fonds/${slug}`, app: "/#ent:" + encodeURIComponent(f.key), nav: "fonds",
      title: `${v.name} : investissements en France, stades et secteurs | Insights French Tech`,
      description: truncate(desc, 158), h1: `${esc(v.name)} <em>dans la French Tech</em>`,
      head: `<div class="hero">${avatar(v.name)}<div class="tagrow" style="margin:0"><span class="tag">${esc(v.type || "Investisseur")}</span>${v.deploying_vehicles && v.deploying_vehicles.length ? '<span class="deploy-tag">Fonds en déploiement</span>' : ""}</div></div>`,
      lede, crumbs: [{ name: "Fonds", path: "/fonds" }, { name: v.name, path: `/fonds/${slug}` }], body,
      jsonld: [{ "@context": "https://schema.org", "@type": "Organization", name: v.name, url: SITE + `/fonds/${slug}` }],
    });
  }

  function monthPage(ym) {
    const deals = (months.get(ym) || []).slice().sort(byRecent);
    if (!deals.length) return null;
    const total = sum(deals.map((d) => d.amount_eur_m));
    const known = deals.filter((d) => d.amount_eur_m != null).map((d) => d.amount_eur_m).sort((a, b) => a - b);
    const median = known.length ? known[Math.floor(known.length / 2)] : null;
    const top = deals.filter((d) => d.amount_eur_m != null).sort((a, b) => b.amount_eur_m - a.amount_eur_m).slice(0, 3);
    const bySector = Object.entries(deals.reduce((a, d) => { const k = d.sector_raw || "Autre"; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const invCount = {}; deals.forEach((d) => d.investors.forEach((n) => { if (!GENERIC.test(n)) invCount[n] = (invCount[n] || 0) + 1; }));
    const topInv = Object.entries(invCount).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 14);
    const i = monthKeys.indexOf(ym), prev = monthKeys[i + 1], next = monthKeys[i - 1];
    const partial = ym === LATEST;
    const desc = `Levées de fonds des startups françaises en ${monthLabel(ym)} : ${deals.length} tours${total ? ` pour ${amtLong(total)}` : ""}${top.length ? `, dont ${listFr(top.map((d) => `${d.company} (${amtLong(d.amount_eur_m)})`))}` : ""}.`;
    const body = `<div class="grid">${kpi("Levées", String(deals.length), partial ? "mois en cours, mis à jour chaque lundi" : "tours recensés")}${kpi("Montant total", total ? amtLong(total) : "n.c.", "montants communiqués")}${kpi("Tour médian", median != null ? amtLong(median) : "n.c.", `${known.length} montants connus`, "c3", true)}${top[0] ? kpi("Plus gros tour", top[0].company, `${amtLong(top[0].amount_eur_m)} · ${top[0].stage_raw || "NC"}`, "c3", true) : ""}</div>
${panel(`Toutes les levées de ${esc(monthLabel(ym))}`, "cliquez pour ouvrir la fiche", dealTable(deals))}
<div class="grid">
  ${panel("Par stade", "", stageBar(deals), "c4")}
  ${panel("Par secteur", "nombre de levées", hbars(bySector), "c4")}
  ${panel("Investisseurs les plus actifs", "2 deals ou plus ce mois-ci", topInv.length ? chips(topInv.map(([n]) => n), (n) => invCount[n]) : `<p class="muted">Aucun investisseur n'a fait plus d'un deal ce mois-ci.</p>`, "c4")}
</div>
<div class="pnav">${prev ? `<a class="btn sm" href="/levees/${prev}">← ${esc(MonthLabel(prev))}</a>` : "<span></span>"}<a class="btn sm" href="/levees">Tous les mois</a>${next ? `<a class="btn sm" href="/levees/${next}">${esc(MonthLabel(next))} →</a>` : "<span></span>"}</div>`;
    return page({
      path: `/levees/${ym}`, app: "/#levees", nav: "levees",
      title: `Levées de fonds French Tech ${monthLabel(ym)} : ${deals.length} startups | Insights French Tech`,
      description: truncate(desc, 158), h1: `Levées de fonds <em>${esc(monthLabel(ym))}</em>`,
      lede: `${deals.length} startups françaises ont annoncé une levée${total ? `, pour ${esc(amtLong(total))} au total` : ""}${top.length ? `. Les plus gros tours : ${esc(listFr(top.map((d) => `${d.company} (${amtLong(d.amount_eur_m)})`)))}` : ""}.`,
      crumbs: [{ name: "Levées", path: "/levees" }, { name: MonthLabel(ym), path: `/levees/${ym}` }], body,
    });
  }

  function leveesIndex() {
    const years = [...new Set(monthKeys.map((k) => k.slice(0, 4)))];
    const yearPanel = (y) => {
      const ks = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
      const tot = ks.map((k) => sum((months.get(k) || []).map((d) => d.amount_eur_m)));
      const cnt = ks.map((k) => (months.get(k) || []).length);
      const mx = Math.max(1, ...cnt);
      const all = sum(cnt), allAmt = sum(tot);
      return panel(y, `${all} levées · ${esc(amtLong(allAmt))}`, `<div class="mbars">${ks.map((k, i) => cnt[i] ? `<a href="/levees/${k}" class="${k === LATEST ? "cur" : ""}" title="${esc(MonthLabel(k))} : ${cnt[i]} levées, ${esc(amtLong(tot[i]))}"><span class="n">${cnt[i]}</span><i style="height:${Math.max(3, (cnt[i] / mx) * 100).toFixed(1)}%"></i><span>${MOIS_C[i]}</span></a>` : `<a class="empty"><i style="height:3px"></i><span>${MOIS_C[i]}</span></a>`).join("")}</div>
<div class="table" style="margin-top:16px">${ks.filter((k) => months.has(k)).reverse().map((k) => { const ds = months.get(k); const t = sum(ds.map((d) => d.amount_eur_m)); const big = ds.filter((d) => d.amount_eur_m != null).sort((a, b) => b.amount_eur_m - a.amount_eur_m)[0]; return `<a class="tr row" href="/levees/${k}" style="grid-template-columns:minmax(0,1.2fr) 90px 100px minmax(0,2fr)"><span class="nm">${esc(MonthLabel(k))}</span><span class="r">${ds.length} levées</span><span class="r amt">${esc(amt(t))}</span><span class="inv">${big ? `Plus gros tour : ${esc(big.company)} (${esc(amt(big.amount_eur_m))})` : ""}</span></a>`; }).join("")}</div>`);
    };
    const total = D.length, totAmt = sum(D.map((d) => d.amount_eur_m));
    const body = `<div class="grid">${kpi("Levées recensées", String(total), `depuis ${monthLabel(monthKeys[monthKeys.length - 1])}`)}${kpi("Montant total", amtLong(totAmt), "montants communiqués")}${kpi("Mois couverts", String(monthKeys.length), "mis à jour chaque lundi")}${kpi("Dernier mois", MonthLabel(LATEST), `${(months.get(LATEST) || []).length} levées`, "c3", true)}</div>${years.map(yearPanel).join("")}`;
    return page({ path: "/levees", nav: "levees", app: "/#levees", title: "Levées de fonds de la French Tech, mois par mois | Insights French Tech", description: "Toutes les levées de fonds des startups françaises classées par mois : montants, stades, secteurs et investisseurs, mises à jour chaque semaine.", h1: "Levées de fonds <em>mois par mois</em>", lede: "Toutes les levées des startups françaises, avec montants, stades, secteurs et investisseurs. Cliquez sur un mois pour voir le détail.", crumbs: [{ name: "Levées", path: "/levees" }], body });
  }

  const filterScript = (itemSel, groupSel) => `(function(){var q=document.getElementById("q"),items=[].slice.call(document.querySelectorAll("${itemSel}")),groups=[].slice.call(document.querySelectorAll("${groupSel}")),chipsEl=[].slice.call(document.querySelectorAll("[data-f]")),cnt=document.getElementById("cnt"),f="";function norm(s){return(s||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase()}function run(){var t=norm(q.value),n=0;items.forEach(function(el){var ok=(!t||norm(el.dataset.s).indexOf(t)>=0)&&(!f||el.dataset.c===f);if(ok){el.removeAttribute("data-hide");n++}else el.setAttribute("data-hide","")});groups.forEach(function(g){g.toggleAttribute("data-hide",!g.querySelector("${itemSel}:not([data-hide])"))});cnt.textContent=n+" résultat"+(n>1?"s":"")}q.addEventListener("input",run);chipsEl.forEach(function(c){c.addEventListener("click",function(){f=f===c.dataset.f?"":c.dataset.f;chipsEl.forEach(function(x){x.setAttribute("aria-pressed",x.dataset.f===f?"true":"false")});run()})});if(location.hash==="#q")q.focus();run()})();`;

  function startupsIndex() {
    const list = [...startups.entries()].map(([slug, s]) => { const ds = s.deals.slice().sort(byRecent); return { slug, name: s.name, last: ds[0], total: sum(ds.map((d) => d.amount_eur_m)), n: ds.length }; }).sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
    const groups = new Map();
    list.forEach((x) => { const L = /^[a-z]/.test(x.slug[0]) ? x.slug[0].toUpperCase() : "#"; (groups.get(L) || groups.set(L, []).get(L)).push(x); });
    const sectors = Object.entries(list.reduce((a, x) => { const k = x.last.sector_raw || "Autre"; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const body = `<section class="panel sec"><div class="search-row"><input class="input" id="q" type="search" placeholder="Rechercher une startup, un secteur, un investisseur…" aria-label="Rechercher une startup" autocomplete="off"><span class="count" id="cnt"></span></div>
<div class="chips" style="margin-bottom:12px">${sectors.map(([k, n]) => `<button class="chip" type="button" data-f="${esc(k)}" aria-pressed="false">${esc(k)} · ${n}</button>`).join("")}</div>
<nav class="letters" aria-label="Lettres">${[...groups.keys()].map((L) => `<a href="#l-${L === "#" ? "0" : L}">${L}</a>`).join("")}</nav>
${[...groups.entries()].map(([L, arr]) => `<div class="lgroup"><h3 id="l-${L === "#" ? "0" : L}">${L}</h3>${arr.map((x) => `<a class="lrow" href="/startup/${x.slug}" data-s="${esc(x.name + " " + (x.last.sector_raw || "") + " " + x.last.investors.slice(0, 5).join(" "))}" data-c="${esc(x.last.sector_raw || "Autre")}"><span class="dt">${esc(shortDate(x.last))}</span><span class="co">${esc(x.name)}<small>${esc(x.last.sector_raw || "")} · ${esc(x.last.stage_raw || "NC")}${x.n > 1 ? ` · ${x.n} tours` : ""}</small></span><span class="v${x.total ? "" : " muted"}">${esc(x.total ? amt(x.total) : "n.c.")}</span></a>`).join("")}</div>`).join("")}</section>`;
    return page({ path: "/startups", nav: "startups", app: "/#levees", title: `Startups françaises financées : ${list.length} fiches | Insights French Tech`, description: `Annuaire de ${list.length} startups françaises ayant levé des fonds : montants, stades, dates et investisseurs de chaque tour.`, h1: `${list.length} startups <em>financées</em>`, lede: "Toutes les startups françaises qui ont annoncé une levée depuis 2024, avec le montant total levé et leur dernier tour. Recherchez par nom, secteur ou investisseur.", crumbs: [{ name: "Startups", path: "/startups" }], body, script: filterScript("a.lrow", ".lgroup") });
  }

  function fondsIndex() {
    const rows = [...funds.entries()].map(([slug, f]) => ({ slug, name: f.name, v: f.info })).sort((a, b) => b.v.deals_last_12m - a.v.deals_last_12m || b.v.deals_tracked - a.v.deals_tracked);
    const typeOf = (v) => v.type || "Investisseur";
    const types = Object.entries(rows.reduce((a, r) => { const k = typeOf(r.v); a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
    const card = (r) => { const obs = (r.v.thesis && r.v.thesis.observed) || {}; const st = (obs.main_stages || [])[0], se = (obs.main_sectors || [])[0]; return `<a class="icard${r.v.deploying_vehicles && r.v.deploying_vehicles.length ? " dep" : ""}" href="/fonds/${r.slug}" data-s="${esc(r.name + " " + typeOf(r.v) + " " + (r.v.focus || "") + " " + (obs.main_sectors || []).map((x) => x.name).join(" "))}" data-c="${esc(typeOf(r.v))}"><div class="ih">${avatar(r.name)}<div style="min-width:0"><div class="nm">${esc(r.name)}</div><div class="ty">${esc(typeOf(r.v))}</div></div></div><div class="facts"><div><b>${r.v.deals_last_12m}</b><span>deals 12 mois</span></div><div><b>${esc(st ? st.name : "n.c.")}</b><span>stade principal</span></div><div><b>${esc(se ? se.name : "n.c.")}</b><span>secteur principal</span></div></div></a>`; };
    const body = `<section class="panel sec"><div class="search-row"><input class="input" id="q" type="search" placeholder="Rechercher un fonds, un secteur, un type d'investisseur…" aria-label="Rechercher un fonds" autocomplete="off"><span class="count" id="cnt"></span></div>
<div class="chips" style="margin-bottom:16px">${types.map(([k, n]) => `<button class="chip" type="button" data-f="${esc(k)}" aria-pressed="false">${esc(k)} · ${n}</button>`).join("")}</div>
<div class="icards fgroup">${rows.map(card).join("")}</div></section>`;
    return page({ path: "/fonds", nav: "fonds", app: "/#fonds", title: `Fonds VC actifs en France : ${rows.length} investisseurs | Insights French Tech`, description: "Les fonds VC et investisseurs les plus actifs dans la French Tech : nombre de deals, stades, secteurs, derniers investissements et co-investisseurs.", h1: `${rows.length} investisseurs <em>de la French Tech</em>`, lede: "Fonds VC, corporates, investisseurs publics et clubs actifs dans les startups françaises, classés par nombre de deals sur les 12 derniers mois.", crumbs: [{ name: "Fonds", path: "/fonds" }], body, script: filterScript("a.icard", ".fgroup") });
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

  // Correspondance utilisée par l'application pour afficher « Page dédiée » dans les fiches
  function pagesIndex() {
    const s = {}; startupSlug.forEach((slug, k) => { s[k] = slug; });
    const f = {}; funds.forEach((v, slug) => { f[v.key] = slug; });
    return JSON.stringify({ startups: s, funds: f });
  }

  function render(pathname) {
    const p = decodeURIComponent(pathname).replace(/\/+$/, "") || "/";
    let m;
    if (p === "/sitemap.xml") return { type: "application/xml; charset=utf-8", body: sitemap() };
    if (p === "/site.css") return { type: "text/css; charset=utf-8", body: siteCss };
    if (p === "/pages-index.json") return { type: "application/json; charset=utf-8", body: pagesIndex() };
    if ((m = p.match(/^\/logo\/(.+)$/))) return logoFile(m[1]) || { body: null };
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
