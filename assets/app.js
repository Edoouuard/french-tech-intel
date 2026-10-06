(() => {
"use strict";
// Données : variables *_BASE de la page (mises à jour chaque semaine), véhicules en déploiement, logos.
const RAW = window.InsightsFT.fromBases(window);
const VEH = window.INSIGHTS_VEHICLES || { funds: [], people: [] };
const LOGOS = window.INSIGHTS_LOGOS || {};
const IFT = window.InsightsFT;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasGsap = typeof gsap !== "undefined" && !reduce;
const nf = new Intl.NumberFormat("fr-FR");
const norm = IFT.norm;

/* ================= DONNÉES ================= */
const D = RAW.deals, OPS = RAW.operations, INV = RAW.investors, PE = RAW.pe, ST = RAW.startups;
const AF = VEH.funds, AP = VEH.people;
const LATEST = RAW.meta.latest_deal_month;
const ymAdd = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const SINCE12 = ymAdd(LATEST, -11);
const SINCE24 = ymAdd(LATEST, -23);
// Mise à jour hebdomadaire : les deals datés au jour près servent à repérer ceux de la dernière semaine.
const dayKey = (d) => (d.date && d.day ? `${d.date}-${String(d.day).padStart(2, "0")}` : null);
const LATEST_DAY = D.map(dayKey).filter(Boolean).sort().pop() || `${LATEST}-28`;
const WEEK_START = (() => { const [y, m, dd] = LATEST_DAY.split("-").map(Number); const x = new Date(y, m - 1, dd - 6); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; })();
const isNew = (d) => { const k = dayKey(d); return k ? k >= WEEK_START : false; };
const fmtDay = (k) => { const [y, m, dd] = k.split("-"); return `${+dd} ${MOIS[+m - 1]} ${y}`; };
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const fmtMonth = (ym) => { if (!ym) return "—"; const [y, m] = ym.split("-"); return MOIS[+m - 1] + " " + y.slice(2); };
const fmtAmt = (m) => (m == null ? "n.c." : m >= 1000 ? "€" + (m / 1000).toFixed(m >= 10000 ? 0 : 1).replace(".", ",") + " Md" : m >= 10 ? "€" + Math.round(m) + "M" : m >= 1 ? "€" + (Math.round(m * 10) / 10).toString().replace(".", ",") + "M" : "€" + Math.round(m * 1000) + "k");
// Grands fonds internationaux : profil éditorial + alias (« a16z » = « Andreessen Horowitz »).
const INTL = (window.INSIGHTS_VEHICLES && window.INSIGHTS_VEHICLES.intl) || [];
const rawCore = (n) => IFT.coreName(String(n || "").replace(/\(.*?\)/g, " "));
const ALIAS = new Map();
INTL.forEach((f) => { const k = rawCore(f.name); f.aliases.concat(f.name).forEach((a) => { const ak = rawCore(a); if (ak) ALIAS.set(ak, k); }); });
const core = (n) => { const k = rawCore(n); return ALIAS.get(k) || k; };
const GENERIC = /^(business angels?|angels?|fondateurs?|founders?|family offices?|nc|n c|nd|non communique.*|non divulgue.*|investisseurs? historiques?|existing investors|autres?|undisclosed|management|salaries|business angels non nommes)$/;
const isGeneric = (i) => GENERIC.test(norm(i));
const fmtTicket = (t) => (t && /\d/.test(t) ? String(t).replace(/→/g, "–") + " M€" : "");
const initials = (n) => String(n).replace(/\(.*?\)/g, "").split(/[\s\-&]+/).filter((w) => /[A-Za-zÀ-ÿ0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "·";
const STAGE_ORDER = ["Pre-seed", "Seed", "Série A", "Série B", "Série C", "Growth", "Post-IPO", "Secondary", "NC"];
const stageColor = (s) => `var(--s${Math.min(6, Math.max(0, STAGE_ORDER.indexOf(s)))})`;
const median = (a) => { a = a.slice().sort((x, y) => x - y); const n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null; };
const quant = (a, q) => { a = a.slice().sort((x, y) => x - y); if (!a.length) return null; const p = (a.length - 1) * q, lo = Math.floor(p); return a[lo] + (a[Math.ceil(p)] - a[lo]) * (p - lo); };

// Index investisseur (nom « cœur ») → deals
const DBC = new Map();
D.forEach((d) => { new Set(d.investors.map(core)).forEach((k) => { if (k) (DBC.get(k) || DBC.set(k, []).get(k)).push(d); }); });
// Index nom de gestionnaire → véhicules en déploiement
const ABC = new Map();
AF.forEach((f) => { const k = core(f.name); if (k) (ABC.get(k) || ABC.set(k, []).get(k)).push(f); });
// Entités « fonds » : annuaire Insights + véhicules en déploiement français ou actifs en France
const ENT = new Map();
const mkEnt = (key, name, ins) => {
  const deals = DBC.get(key) || [];
  const vehicles = ABC.get(key) || [];
  const n24 = deals.filter((d) => d.date >= SINCE24).length;
  // Un véhicule compte comme « en déploiement en France » s'il est français ou si son gestionnaire a investi
  // en France sur 24 mois ; les autres (fonds étrangers sans deal français récent) sont présentés à part.
  const veh = vehicles.filter((f) => f.country === "France" || n24 > 0);
  const foreign = vehicles.filter((f) => !veh.includes(f));
  return { key, name, ins, veh, foreign, deals, n24, intl: INTL_BY.get(key) || null, n12: deals.filter((d) => d.date >= SINCE12).length, nb: ins && ins.deals_tracked ? Math.max(ins.deals_tracked, deals.length) : deals.length };
};
const INTL_BY = new Map(INTL.map((f) => [rawCore(f.name), f]));
// Type d'un investisseur : annuaire Insights, profil international, sinon déduit du nom.
const ORG_WORDS = /\b(capital|ventures?|venture|invest\w*|fund|fonds|partners|group|groupe|holding|bank|banque|cr[ée]dit|caisse|angels|club|r[ée]gion|sas?|gestion|equity|labs?|studio|foundation|fondation|corp|inc|ltd|gmbh|ag|bv|family|office|accelerat\w*|incubat\w*|bpi\w*|universit\w*|[ée]cole|school|participations?|d[ée]veloppement|innovation|impact|vc|tech|ai|management|assets?|finance|financi[eè]re|mutuel\w*|assurances?|insurance|systems|industries|global|international|network|collective|syndicate|seed|growth|pe|cvc|sa\b|spa)\b/i;
const personLike = (n) => /^[A-ZÀ-Ý][a-zà-ÿ'’-]+(?:[ -](?:de |du |le |la |van |von )?[A-ZÀ-Ý][a-zà-ÿ'’-]+){1,2}$/.test(String(n).trim()) && !ORG_WORDS.test(n);
// Familles de types pour le filtre (le type précis reste affiché sur la fiche).
const typeFamily = (t) => { const n = norm(t);
  if (/business angel/.test(n)) return "Business angel";
  if (/cvc|corporate/.test(n)) return "Corporate (CVC)";
  if (/souverain|public|institutionnel|gestionnaire d actifs|^banque$|regional/.test(n)) return "Public, souverain et institutionnel";
  if (/growth|hedge|private equity|^pe$|buyout/.test(n)) return "Growth et private equity";
  if (/accelerateur|studio/.test(n)) return "Accélérateur et studio";
  if (/family/.test(n)) return "Family office";
  if (/crowd/.test(n)) return "Crowdfunding";
  if (/^investisseur$/.test(n)) return "Autre investisseur";
  return "Fonds VC"; };
const entType = (e) => (e.intl ? e.intl.type : e.ins ? e.ins.type : e.veh.length || e.foreign.length ? "Fonds VC" : personLike(e.name) ? "Business angel" : "Investisseur");
INV.forEach((v) => { if (isGeneric(v.name) || /business angel/i.test(v.type)) return; const k = core(v.name) || norm(v.name); if (!ENT.has(k)) ENT.set(k, mkEnt(k, v.name, v)); });
AF.forEach((f) => { const k = core(f.name); if (!k || ENT.has(k)) return; if (f.country === "France" || DBC.has(k)) ENT.set(k, mkEnt(k, f.name, null)); });
INTL.forEach((f) => { const k = rawCore(f.name); if (!ENT.has(k)) ENT.set(k, mkEnt(k, f.name, null)); else { const e = ENT.get(k); e.intl = f; e.name = f.name; } });
// Tout investisseur cité sur une levée a sa page : on prend sa graphie la plus fréquente.
{
  const spell = new Map();
  D.forEach((d) => d.investors.forEach((i) => { if (isGeneric(i) || i.length < 2) return; const k = core(i) || norm(i); if (!k) return; const m = spell.get(k) || spell.set(k, new Map()).get(k); m.set(i, (m.get(i) || 0) + 1); }));
  spell.forEach((m, k) => { if (ENT.has(k)) return; const name = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0].replace(/\s+/g, " ").trim(); ENT.set(k, mkEnt(k, name, null)); });
}
const ENTS = [...ENT.values()];
const DEPLOYING = ENTS.filter((e) => e.veh.length);
const FOREIGN = ENTS.flatMap((e) => e.foreign.map((f) => ({ e, f }))).sort((a, b) => (b.f.size_eur_m || 0) - (a.f.size_eur_m || 0));
const entFor = (name) => ENT.get(core(name)) || ENT.get(norm(name)) || null;
const INTL_ENTS = ENTS.filter((e) => e.intl).sort((a, b) => b.deals.length - a.deals.length || a.name.localeCompare(b.name));
// Acquéreurs
const BUY = new Map();
OPS.forEach((o) => { if (!o.acquirer || /^(nd|nc|n d|n c|non communique.*|non divulgue.*|inconnu|undisclosed)$/.test(norm(o.acquirer))) return; const k = norm(o.acquirer); (BUY.get(k) || BUY.set(k, { name: o.acquirer, ops: [] }).get(k)).ops.push(o); });
const BUYERS = [...BUY.values()];
// Startups
const STI = new Map(ST.map((s) => [norm(s.name), s]));
const VEH_PEOPLE = new Map();
AP.forEach((p) => (VEH_PEOPLE.get(p.fund_id) || VEH_PEOPLE.set(p.fund_id, []).get(p.fund_id)).push(p));
// Logo embarqué (data URI) ou initiales en repli
const logo = (name, cls = "av") => { const src = LOGOS[core(name)]; return src ? `<span class="${cls} has-logo"><img src="${src}" alt="" loading="lazy"></span>` : `<span class="${cls}">${esc(initials(name))}</span>`; };

/* ================= OUTILS UI ================= */
const tip = $("#tip");
function showTip(html, x, y) { tip.innerHTML = html; tip.classList.add("on"); const w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = Math.min(innerWidth - w - 10, Math.max(10, x + 14)) + "px"; tip.style.top = Math.max(10, y - h - 12) + "px"; }
const hideTip = () => tip.classList.remove("on");
const invLinks = (list) => list.map((i) => { const e = entFor(i); return e && !isGeneric(i) ? `<button class="ent${e.veh.length ? " dep" : ""}" type="button" data-ent="${esc(e.key)}">${esc(i)}</button>` : esc(i); }).join(", ");
const stagePill = (s) => (s && s !== "NC" ? `<span class="pill"><i style="background:${stageColor(s)}"></i>${esc(s)}</span>` : `<span class="pill">NC</span>`);
const lrowDeal = (d) => `<div class="lrow" data-startup="${esc(d.company)}"><span class="dt">${fmtMonth(d.date)}</span><span class="co">${esc(d.company)}<small>${esc(d.sector_raw || "")} · ${esc(d.stage_raw || "NC")}</small>${isNew(d) ? '<span class="new-tag">CETTE SEMAINE</span>' : ""}</span><span class="v">${fmtAmt(d.amount_eur_m)}</span><span class="sub">${invLinks(d.investors) || "Investisseurs non communiqués"}</span></div>`;
const lrowOp = (o) => `<div class="lrow" data-op="${esc(o.id)}"><span class="dt">${fmtMonth(o.date)}</span><span class="co">${esc(o.target)} <span class="muted">→</span> ${esc(o.acquirer || "?")}</span><span class="v">${fmtAmt(o.amount_eur_m)}</span><span class="sub">${esc(o.type)}${o.sector_raw ? " · " + esc(o.sector_raw) : ""}</span></div>`;
function countUp(el, to, fmt, delay = 0) {
  if (!hasGsap) { el.textContent = fmt(to); return; }
  const o = { v: 0 };
  gsap.to(o, { v: to, duration: 1.4, delay, ease: "power3.out", onUpdate: () => (el.textContent = fmt(o.v)), onComplete: () => (el.textContent = fmt(to)) });
}
function reveal(root) {
  if (!hasGsap) return;
  gsap.fromTo($$(".reveal", root), { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "expo.out", stagger: 0.05, clearProps: "transform,opacity" });
}
function pager(el, total, page, per, onGo) {
  const pages = Math.ceil(total / per);
  if (pages <= 1) { el.innerHTML = ""; return; }
  const nums = [...new Set([1, page - 1, page, page + 1, pages].filter((p) => p >= 1 && p <= pages))].sort((a, b) => a - b);
  let html = `<button type="button" data-p="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="Page précédente">←</button>`;
  nums.forEach((p, i) => { if (i && p - nums[i - 1] > 1) html += `<span class="muted">…</span>`; html += `<button type="button" data-p="${p}" ${p === page ? 'aria-current="true"' : ""}>${p}</button>`; });
  html += `<button type="button" data-p="${page + 1}" ${page === pages ? "disabled" : ""} aria-label="Page suivante">→</button>`;
  el.innerHTML = html;
  $$("button[data-p]", el).forEach((b) => b.addEventListener("click", () => onGo(+b.dataset.p)));
}
const opt = (arr, all) => `<option value="">${all}</option>` + arr.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
const yearsOpts = () => `<option value="">Depuis 2024</option><option value="12m">12 derniers mois</option><option value="2026">2026</option><option value="2025">2025</option><option value="2024">2024</option>`;
const inPeriod = (date, p) => !p || (p === "12m" ? (date || "") >= SINCE12 : (date || "").startsWith(p));
const SECTORS = Object.entries(D.reduce((a, d) => ((a[d.sector_raw] = (a[d.sector_raw] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).map(([k]) => k).filter(Boolean);

/* ================= ROUTAGE ================= */
const VIEWS = ["ov", "levees", "exits", "fonds", "europe", "pe", "comps", "acq", "mcp"];
const built = new Set();
const BUILDERS = {};
let current = null;
function moveInk() {
  const t = $(`.tab[data-view="${current}"]`), ink = $("#tabInk");
  if (!t) return;
  ink.style.left = t.offsetLeft + 12 + "px"; ink.style.width = t.offsetWidth - 24 + "px";
}
function go(view, opts = {}) {
  if (!VIEWS.includes(view)) view = "ov";
  if (view === current && !opts.force) return;
  current = view;
  $$(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.view === view));
  $$(".view").forEach((v) => (v.hidden = v.dataset.view !== view));
  if (!built.has(view)) { BUILDERS[view](); built.add(view); }
  if (opts.after) opts.after();
  if (view === "europe" && built.has("europe")) { layoutEuMap(); startEuMap(); }
  moveInk();
  const t = $(`.tab[data-view="${view}"]`), bar = $("#tabs");
  if (t && (t.offsetLeft < bar.scrollLeft || t.offsetLeft + t.offsetWidth > bar.scrollLeft + bar.clientWidth)) bar.scrollTo({ left: t.offsetLeft - 24, behavior: "smooth" });
  if (!opts.silent) { try { history.replaceState(null, "", "#" + view); } catch (e) { /* hôte sans historique */ } window.scrollTo({ top: 0, behavior: "instant" }); reveal($("#v-" + view)); }
}
$$(".tab").forEach((t) => t.addEventListener("click", () => go(t.dataset.view)));
addEventListener("resize", moveInk);

/* ================= VUE D'ENSEMBLE ================= */
BUILDERS.ov = () => {
  const m = RAW.meta;
  const tot = D.reduce((s, d) => s + (d.amount_eur_m || 0), 0);
  $("#ovLede").innerHTML = `${nf.format(D.length)} levées, ${OPS.length} exits et ${ENTS.length} investisseurs suivis depuis janvier 2024. Mise à jour chaque semaine : ${D.filter(isNew).length} nouvelles levées entre le ${fmtDay(WEEK_START)} et le ${fmtDay(LATEST_DAY)}. ${DEPLOYING.length} gestionnaires ont un fonds en cours de déploiement.`;
  $("#ctaUrl").textContent = "insights-french-tech.com/mcp";
  $("#topUrl").textContent = "insights-french-tech.com/mcp";
  $("#topCopy").addEventListener("click", () => copyText("https://www.insights-french-tech.com/mcp", $("#topUrl")));
  buildWeek();
  const ticker = D.slice(0, 24).map((d) => `<li data-startup="${esc(d.company)}"><b>${esc(d.company)}</b>${esc(d.stage_raw || "")}<span>${fmtAmt(d.amount_eur_m)}</span></li>`).join("");
  $("#ticker").innerHTML = ticker + ticker;
  const big = OPS.filter((o) => (o.amount_eur_m || 0) > 100).length;
  const peLive = PE.filter((p) => p.status !== "Exit").length;
  const kpis = [
    { k: "Levées suivies", v: D.length, f: (x) => nf.format(Math.round(x)), s: `${fmtAmt(tot)} depuis janvier 2024`, go: "levees" },
    { k: "Exits & M&A", v: OPS.length, f: (x) => nf.format(Math.round(x)), s: `dont ${big} opérations > 100 M€`, go: "exits" },
    { k: "Fonds & investisseurs", v: ENTS.filter((e) => entType(e) !== "Business angel").length, f: (x) => nf.format(Math.round(x)), s: `${INTL_ENTS.length} grands fonds internationaux inclus`, go: "fonds", deploy: DEPLOYING.length },
    { k: "PE Watch", v: PE.length, f: (x) => nf.format(Math.round(x)), s: `${peLive} participations en portefeuille`, go: "pe" },
  ];
  $("#ovKpis").innerHTML = kpis.map((k, i) => `<button class="kpi c3 reveal" type="button" data-go="${k.go}"><span class="k">${k.k}</span><span class="v" id="ovk${i}">${k.f(k.v)}</span><span class="s">${k.s}</span>${k.deploy ? `<span class="deploy"><i></i><b>${k.deploy}</b> fonds en cours de déploiement</span>` : ""}</button>`).join("");
  kpis.forEach((k, i) => countUp($("#ovk" + i), k.v, k.f, 0.3 + i * 0.08));
  drawTrend("v");
  $$("#trendMode button").forEach((b) => b.addEventListener("click", () => { $$("#trendMode button").forEach((x) => x.setAttribute("aria-pressed", x === b)); drawTrend(b.dataset.m); }));
  // stades
  const st = STAGE_ORDER.map((s) => { const ds = D.filter((d) => (d.stage_raw || "NC") === s); return { s, n: ds.length, v: ds.reduce((a, d) => a + (d.amount_eur_m || 0), 0) }; }).filter((x) => x.n);
  $("#stageNote").textContent = `${nf.format(D.length)} deals`;
  $("#ovStages").innerHTML = `<div class="stagebar">${st.map((x) => `<div data-stage="${esc(x.s)}" style="flex-grow:${x.n};background:${stageColor(x.s)}" title="${esc(x.s)} · ${x.n}">${x.n / D.length > 0.09 ? Math.round((x.n / D.length) * 100) + "%" : ""}</div>`).join("")}</div>
    <div style="margin-top:14px">${st.map((x) => `<div class="srow" data-stage="${esc(x.s)}"><i style="background:${stageColor(x.s)}"></i><span>${esc(x.s)}</span><span class="r">${x.n}</span><span class="r">${fmtAmt(x.v)}</span></div>`).join("")}</div>`;
  $$("#ovStages [data-stage]").forEach((el) => el.addEventListener("click", () => go("levees", { after: () => setLStage(el.dataset.stage) })));
  drawSectors("noai");
  $$("#secMode button").forEach((b) => b.addEventListener("click", () => { $$("#secMode button").forEach((x) => x.setAttribute("aria-pressed", x === b)); drawSectors(b.dataset.m); }));
  // déploiement
  const dep = DEPLOYING.slice().sort((a, b) => b.n12 - a.n12 || b.deals.length - a.deals.length).slice(0, 7);
  const mx = Math.max(1, ...dep.map((e) => e.n12));
  $("#ovDeploy").innerHTML = dep.map((e, i) => `<div class="lb" data-ent="${esc(e.key)}" style="cursor:pointer"><span class="rk">${String(i + 1).padStart(2, "0")}</span><div class="lbn">${logo(e.name, "av sm")}<div style="min-width:0;flex:1"><b>${esc(e.name)}</b> <span class="muted" style="font-size:.8rem">· ${esc(e.veh.map((f) => f.name).join(", "))} · ${esc(e.veh[0].size_label)}</span><div class="bar"><i style="width:${(e.n12 / mx) * 100}%;background:var(--accent)"></i></div></div></div><span class="n">${e.n12}</span></div>`).join("");
  $("#ovDeals").innerHTML = D.slice(0, 8).map(lrowDeal).join("");
  $("#ovOps").innerHTML = OPS.filter((o) => o.date).slice(0, 8).map(lrowOp).join("");
  // leaders
  const c = new Map();
  D.filter((d) => d.date >= SINCE12).forEach((d) => new Set(d.investors).forEach((i) => { if (!isGeneric(i)) c.set(i, (c.get(i) || 0) + 1); }));
  const lead = [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12), lmax = lead[0] ? lead[0][1] : 1;
  $("#ovLeaders").innerHTML = [lead.slice(0, 6), lead.slice(6)].map((col, ci) => `<div class="c6">${col.map(([n, k], i) => { const e = entFor(n); return `<div class="lb"${e ? ` data-ent="${esc(e.key)}" style="cursor:pointer"` : ""}><span class="rk">${String(ci * 6 + i + 1).padStart(2, "0")}</span><div class="lbn">${logo(n, "av sm")}<div style="min-width:0;flex:1"><span>${esc(n)}</span>${e && e.veh.length ? ' <span class="deploy-tag">EN DÉPLOIEMENT</span>' : ""}<div class="bar"><i style="width:${(k / lmax) * 100}%"></i></div></div></div><span class="n">${k}</span></div>`; }).join("")}</div>`).join("");
  if (hasGsap) gsap.fromTo("#v-ov .lb .bar i", { scaleX: 0 }, { scaleX: 1, duration: 1, ease: "power3.out", stagger: 0.02, delay: 0.4 });
};
function drawTrend(mode) {
  const years = ["2024", "2025", "2026"];
  const val = (y, m) => { const k = `${y}-${String(m + 1).padStart(2, "0")}`; if (k > LATEST) return null; const ds = D.filter((d) => d.date === k); return mode === "v" ? ds.reduce((s, d) => s + (d.amount_eur_m || 0), 0) : ds.length; };
  const series = years.map((y) => ({ y, pts: MOIS.map((_, m) => val(y, m)) }));
  const all = series.flatMap((s) => s.pts).filter((v) => v != null);
  const max = Math.max(...all, 1);
  const step = mode === "v" ? (max > 3000 ? 1000 : 500) : 20, top = Math.ceil(max / step) * step;
  const W = 760, H = 270, pl = 46, pr = 12, pt = 14, pb = 28;
  const x = (m) => pl + (m / 11) * (W - pl - pr), yv = (v) => pt + (H - pt - pb) * (1 - v / top);
  const colors = { 2024: "var(--muted)", 2025: "var(--signal)", 2026: "var(--accent)" };
  const ticks = []; for (let v = 0; v <= top; v += step) ticks.push(v);
  let svg = ticks.map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${yv(v)}" y2="${yv(v)}" stroke="var(--line)"/><text x="${pl - 8}" y="${yv(v) + 4}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="10.5" fill="var(--muted)">${mode === "v" ? (v >= 1000 ? v / 1000 + " Md" : v) : v}</text>`).join("");
  svg += MOIS.map((mo, m) => `<text x="${x(m)}" y="${H - 8}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="var(--muted)">${mo}</text>`).join("");
  series.forEach((s) => {
    const pts = s.pts.map((v, m) => (v == null ? null : [x(m), yv(v)])).filter(Boolean);
    if (!pts.length) return;
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const area = d + ` L${pts[pts.length - 1][0].toFixed(1)} ${yv(0)} L${pts[0][0].toFixed(1)} ${yv(0)} Z`;
    if (s.y === "2026") svg += `<path d="${area}" fill="${colors[s.y]}" fill-opacity=".09"/>`;
    svg += `<path class="tline" d="${d}" fill="none" stroke="${colors[s.y]}" stroke-width="${s.y === "2026" ? 2.6 : 1.6}" stroke-linejoin="round" stroke-linecap="round"/>`;
    svg += s.pts.map((v, m) => (v == null ? "" : `<circle class="tpt" data-y="${s.y}" data-m="${m}" cx="${x(m).toFixed(1)}" cy="${yv(v).toFixed(1)}" r="${s.y === "2026" ? 4 : 3}" fill="var(--bg-2)" stroke="${colors[s.y]}" stroke-width="2"/>`)).join("");
  });
  $("#trend").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Montant ou nombre de levées par mois, 2024 à 2026">${svg}</svg>`;
  $("#trendLegend").innerHTML = years.map((y) => `<span><i style="background:${colors[y]}"></i>${y}</span>`).join("");
  $$("#trend .tpt").forEach((c) => {
    const y = c.dataset.y, m = +c.dataset.m, k = `${y}-${String(m + 1).padStart(2, "0")}`;
    const ds = D.filter((d) => d.date === k), v = ds.reduce((s, d) => s + (d.amount_eur_m || 0), 0);
    const top3 = ds.slice().sort((a, b) => (b.amount_eur_m || 0) - (a.amount_eur_m || 0)).slice(0, 2).map((d) => esc(d.company)).join(", ");
    c.style.cursor = "pointer";
    c.addEventListener("mousemove", (e) => showTip(`<b>${MOIS[m]} ${y}</b><small>${ds.length} deals · ${fmtAmt(v)}${top3 ? " · " + top3 : ""}</small>`, e.clientX, e.clientY));
    c.addEventListener("mouseleave", hideTip);
    c.addEventListener("click", () => go("levees", { after: () => { L.month = k; L.page = 1; renderLevees(); } }));
  });
  if (hasGsap) $$("#trend .tline").forEach((p, i) => { const len = p.getTotalLength(); gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.4, delay: 0.15 * i, ease: "power2.inOut", clearProps: "strokeDasharray,strokeDashoffset" }); });
}
function drawSectors(mode) {
  const agg = {};
  D.forEach((d) => { if (!d.sector_raw || (mode === "noai" && d.sector_raw === "IA")) return; agg[d.sector_raw] = (agg[d.sector_raw] || 0) + (d.amount_eur_m || 0); });
  const rows = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 9), mx = rows[0] ? rows[0][1] : 1;
  $("#ovSectors").innerHTML = rows.map(([k, v]) => `<div class="hbar" data-sec="${esc(k)}"><span>${esc(k)}</span><div class="t"><i style="width:${(v / mx) * 100}%"></i></div><span class="r">${fmtAmt(v)}</span></div>`).join("");
  $$("#ovSectors .hbar").forEach((el) => el.addEventListener("click", () => go("levees", { after: () => { $("#lSec").value = el.dataset.sec; L.page = 1; renderLevees(); } })));
  if (hasGsap) gsap.fromTo("#ovSectors .t i", { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "power3.out", stagger: 0.04, delay: 0.3 });
}

/* ================= LEVÉES ================= */
const L = { page: 1, stage: "", month: "", per: 40 };
function setLStage(s) { L.stage = s; L.page = 1; $$("#lStages .chip").forEach((c) => c.setAttribute("aria-pressed", c.dataset.s === s)); renderLevees(); }
BUILDERS.levees = () => {
  $("#lSec").innerHTML = opt(SECTORS, "Tous");
  $("#lYear").innerHTML = yearsOpts();
  $("#lStages").innerHTML = [["", "Tous les stades"], ...STAGE_ORDER.filter((s) => D.some((d) => d.stage_raw === s)).map((s) => [s, s])].map(([v, l]) => `<button class="chip" type="button" data-s="${esc(v)}" aria-pressed="${v === L.stage}">${esc(l)}</button>`).join("");
  $$("#lStages .chip").forEach((c) => c.addEventListener("click", () => setLStage(c.dataset.s)));
  ["#lQ", "#lSec", "#lYear", "#lMin", "#lSort", "#lDep"].forEach((s) => $(s).addEventListener(s === "#lQ" ? "input" : "change", () => { L.page = 1; if (s === "#lYear") L.month = ""; renderLevees(); }));
  renderLevees();
};
function renderLevees() {
  const q = norm($("#lQ").value), sec = $("#lSec").value, yr = $("#lYear").value, mn = $("#lMin").value, dep = $("#lDep").checked;
  const [lo, hi] = mn ? mn.split("-").map(Number) : [null, null];
  let r = D.filter((d) => (!L.week || isNew(d)) && (!sec || d.sector_raw === sec) && (!L.stage || d.stage_raw === L.stage) && (L.month ? d.date === L.month : inPeriod(d.date, yr)) &&
    (!mn || (d.amount_eur_m != null && d.amount_eur_m >= lo && d.amount_eur_m < hi)) &&
    (!dep || d.investors.some((i) => (entFor(i) || {}).veh?.length)) &&
    (!q || norm([d.company, d.pitch, d.sector_raw, d.investors.join(" ")].join(" ")).includes(q)));
  const so = $("#lSort").value;
  if (so === "amt") r = r.slice().sort((a, b) => (b.amount_eur_m || 0) - (a.amount_eur_m || 0));
  if (so === "amta") r = r.slice().sort((a, b) => (a.amount_eur_m ?? 1e9) - (b.amount_eur_m ?? 1e9));
  const amts = r.map((d) => d.amount_eur_m).filter((v) => v != null);
  L.rows = r;
  $("#lCount").textContent = `${nf.format(r.length)} levées`;
  $("#lStrip").innerHTML = [[nf.format(r.length), L.month ? "deals en " + fmtMonth(L.month) : "deals"], [fmtAmt(amts.reduce((a, b) => a + b, 0)), "montant annoncé"], [fmtAmt(median(amts)), "ticket médian"], [fmtAmt(amts.length ? amts.reduce((a, b) => a + b, 0) / amts.length : null), "ticket moyen"]].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");
  const page = r.slice((L.page - 1) * L.per, L.page * L.per);
  $("#lTable").innerHTML = `<div class="tr head t-deals"><span>Date</span><span>Startup</span><span>Stade</span><span class="r">Montant</span><span>Secteur</span><span>Investisseurs</span></div>` +
    (page.map((d) => `<div class="tr row t-deals" data-startup="${esc(d.company)}"><span class="dt">${fmtMonth(d.date)}</span><span class="nm">${esc(d.company)}${isNew(d) ? '<span class="new-tag">CETTE SEMAINE</span>' : ""}<small>${esc(d.pitch || "")}</small></span><span>${stagePill(d.stage_raw)}</span><span class="r amt">${fmtAmt(d.amount_eur_m)}</span><span class="muted" style="font-size:.84rem">${esc(d.sector_raw || "")}</span><span class="inv">${invLinks(d.investors) || "—"}</span></div>`).join("") || `<div class="empty">Aucune levée pour ces filtres.${L.month ? ` <button class="linkbtn" type="button" id="clrMonth">Retirer le filtre ${fmtMonth(L.month)}</button>` : ""}</div>`);
  if (L.month && r.length) $("#lTable").insertAdjacentHTML("afterbegin", `<p class="mono" style="padding:8px 0">Filtre mois : ${fmtMonth(L.month)} · <button class="linkbtn" type="button" id="clrMonth">retirer</button></p>`);
  if (L.week) $("#lTable").insertAdjacentHTML("afterbegin", `<p class="mono" style="padding:8px 0">Filtre : levées de la semaine (${fmtDay(WEEK_START)} – ${fmtDay(LATEST_DAY)}) · <button class="linkbtn" type="button" id="clrWeek">retirer</button></p>`);
  const cw = $("#clrWeek"); if (cw) cw.addEventListener("click", () => { L.week = false; renderLevees(); });
  wireExports();
  const cm = $("#clrMonth"); if (cm) cm.addEventListener("click", () => { L.month = ""; renderLevees(); });
  pager($("#lPager"), r.length, L.page, L.per, (p) => { L.page = p; renderLevees(); $("#lTable").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); });
  if (hasGsap) gsap.fromTo("#lTable .tr.row", { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.35, stagger: 0.012, ease: "power2.out", clearProps: "transform,opacity" });
}

/* ================= EXITS ================= */
const E = { page: 1, type: "", per: 30 };
const TYPE_GROUP = (t) => { const n = norm(t); return /ipo/.test(n) ? "IPO" : /opa/.test(n) ? "OPA" : /lbo|buyout|mbo/.test(n) ? "LBO / Buyout" : /fusion|merger/.test(n) ? "Fusion" : /minoritaire/.test(n) ? "Minoritaire" : "Acquisition"; };
BUILDERS.exits = () => {
  const secs = Object.entries(OPS.reduce((a, o) => ((a[o.sector_raw] = (a[o.sector_raw] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).map(([k]) => k).filter(Boolean).slice(0, 40);
  $("#eSec").innerHTML = opt(secs, "Tous");
  $("#eYear").innerHTML = `<option value="">Toutes</option><option>2026</option><option>2025</option><option>2024</option>`;
  const types = ["", "Acquisition", "IPO", "OPA", "LBO / Buyout", "Fusion", "Minoritaire"];
  $("#eTypes").innerHTML = types.map((t) => `<button class="chip" type="button" data-t="${t}" aria-pressed="${t === E.type}">${t || "Tous les types"} <span class="muted">${t ? OPS.filter((o) => TYPE_GROUP(o.type) === t).length : OPS.length}</span></button>`).join("");
  $$("#eTypes .chip").forEach((c) => c.addEventListener("click", () => { E.type = c.dataset.t; E.page = 1; $$("#eTypes .chip").forEach((x) => x.setAttribute("aria-pressed", x === c)); renderExits(); }));
  ["#eQ", "#eSec", "#eYear", "#eSort"].forEach((s) => $(s).addEventListener(s === "#eQ" ? "input" : "change", () => { E.page = 1; renderExits(); }));
  renderExits();
};
function renderExits() {
  const q = norm($("#eQ").value), sec = $("#eSec").value, yr = $("#eYear").value;
  let r = OPS.filter((o) => (!E.type || TYPE_GROUP(o.type) === E.type) && (!sec || o.sector_raw === sec) && (!yr || (o.date || "").startsWith(yr)) && (!q || norm([o.target, o.acquirer, o.sector_raw, o.description, o.context].join(" ")).includes(q)));
  if ($("#eSort").value === "amt") r = r.slice().sort((a, b) => (b.amount_eur_m || 0) - (a.amount_eur_m || 0));
  E.rows = r;
  $("#eCount").textContent = `${nf.format(r.length)} opérations`;
  const amts = r.map((o) => o.amount_eur_m).filter((v) => v != null);
  $("#eStrip").innerHTML = [[nf.format(r.length), "opérations"], [fmtAmt(amts.reduce((a, b) => a + b, 0)), "montants publiés"], [nf.format(new Set(r.map((o) => o.acquirer)).size), "acquéreurs"], [nf.format(r.filter((o) => (o.amount_eur_m || 0) > 100).length), "deals > 100 M€"]].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");
  const page = r.slice((E.page - 1) * E.per, E.page * E.per);
  $("#eTable").innerHTML = `<div class="tr head t-ops"><span>Date</span><span>Cible → acquéreur</span><span>Type</span><span>Secteur</span><span class="r">Montant</span></div>` +
    (page.map((o) => `<div class="tr row t-ops" data-op="${esc(o.id)}"><span class="dt">${fmtMonth(o.date)}</span><span class="nm">${esc(o.target)} <span class="muted">→</span> ${esc(o.acquirer || "?")}<small>${esc(o.description || "")}</small></span><span><span class="pill">${esc(o.type)}</span></span><span class="muted" style="font-size:.84rem">${esc(o.sector_raw || "")}</span><span class="r amt">${fmtAmt(o.amount_eur_m)}</span></div>`).join("") || `<div class="empty">Aucune opération pour ces filtres.</div>`);
  pager($("#ePager"), r.length, E.page, E.per, (p) => { E.page = p; renderExits(); });
  wireExports();
  if (hasGsap) gsap.fromTo("#eTable .tr.row", { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.35, stagger: 0.015, ease: "power2.out", clearProps: "transform,opacity" });
}

/* ================= FONDS ================= */
const FS = { shown: 36 };
const quarterKeys = (() => { const out = []; for (let y = 2024; y <= +LATEST.slice(0, 4); y++) for (let q = 1; q <= 4; q++) { const k = `${y}-Q${q}`; if (`${y}-${String(q * 3 - 2).padStart(2, "0")}` <= LATEST) out.push(k); } return out; })();
const qOf = (ym) => `${ym.slice(0, 4)}-Q${Math.ceil(+ym.slice(5, 7) / 3)}`;
const spark = (deals) => { const c = Object.fromEntries(quarterKeys.map((k) => [k, 0])); deals.forEach((d) => { const k = qOf(d.date || "0000-01"); if (k in c) c[k]++; }); const mx = Math.max(1, ...Object.values(c)); return `<div class="spark" title="Deals par trimestre depuis 2024">${quarterKeys.map((k) => `<i style="height:${(c[k] / mx) * 100}%"></i>`).join("")}</div>`; };
const railItems = () => {
  const items = [];
  DEPLOYING.forEach((e) => e.veh.forEach((f) => items.push({ e, f })));
  return items.sort((a, b) => b.e.n12 - a.e.n12 || (b.f.size_eur_m || 0) - (a.f.size_eur_m || 0));
};
BUILDERS.fonds = () => {
  const types = [...new Set(ENTS.map((e) => typeFamily(entType(e))))].sort((a, b) => a.localeCompare(b));
  $("#fType").innerHTML = opt(types, "Tous");
  $("#fSec").innerHTML = opt(SECTORS, "Tous");
  const items = railItems();
  const vcN = ENTS.filter((e) => entType(e) !== "Business angel").length;
  $("#fStrip").innerHTML = [[nf.format(ENTS.length), "investisseurs avec une page"], [nf.format(vcN), "fonds et sociétés d'investissement"], [nf.format(ENTS.filter((e) => e.ins && e.ins.type === "CVC").length), "fonds corporate (CVC)"], [`<span style="color:var(--accent)">${nf.format(DEPLOYING.length)}</span>`, `gestionnaires avec un fonds en déploiement · ${items.length} véhicules`]].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");
  $("#dlNote").textContent = `${items.length} véhicules qui investissent en France · faites défiler`;
  $("#foreignCount").textContent = `${FOREIGN.length} véhicule${FOREIGN.length > 1 ? "s" : ""}`;
  $("#foreignBox").hidden = !FOREIGN.length;
  $("#intlCount").textContent = `${INTL_ENTS.length} fonds · ${INTL_ENTS.filter((e) => e.deals.length).length} présents sur des levées françaises`;
  $("#intlGrid").innerHTML = INTL_ENTS.map((e) => { const last = e.deals.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0]; return `<button class="dcard intl" type="button" data-ent="${esc(e.key)}"><span class="dtop">${logo(e.name)}<span class="deploy-tag" style="background:color-mix(in srgb,var(--signal) 16%,transparent);color:var(--signal)">${esc(e.intl.country)}</span></span><span class="vn">${esc(e.name)}</span><span class="mg">${esc(e.intl.hq)} · ${esc(e.intl.type)}</span><span class="big" style="font-size:${e.intl.aum ? "1.35rem" : "1rem"}">${esc(e.intl.aum || e.intl.stages)}</span><span class="meta"><span class="act${e.deals.length ? "" : " zero"}">${e.deals.length ? `${e.deals.length} deal${e.deals.length > 1 ? "s" : ""} en France · dernier ${fmtMonth(last.date)}` : "Aucun deal français suivi"}</span></span></button>`; }).join("");
  $("#foreignGrid").innerHTML = FOREIGN.map(({ e, f }) => { const last = e.deals.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0]; return `<button class="fcard" type="button" data-ent="${esc(e.key)}">${logo(e.name, "av sm")}<span style="min-width:0"><b>${esc(f.name)}</b><span class="muted">${esc(f.country)} · ${esc(f.size_label)}${f.stage ? " · " + esc(f.stage) : ""}</span><span class="fl">${last ? "Dernier deal en France : " + fmtMonth(last.date) : "Aucun deal en France suivi"}</span></span></button>`; }).join("");
  $("#rail").innerHTML = items.map(({ e, f }) => `<button class="dcard" type="button" data-ent="${esc(e.key)}"><span class="dtop">${logo(e.name)}<span class="deploy-tag">EN DÉPLOIEMENT</span></span><span class="vn">${esc(f.name)}</span><span class="mg">${esc(e.name)} · ${esc(f.country)}${f.country !== "France" ? " · investit en France" : ""}</span><span class="big">${esc(f.size_label)}</span><span class="meta"><span>${esc(f.stage || "")}${f.ticket ? " · ticket " + esc(f.ticket) : ""}</span></span><span class="meta"><span class="act${e.n12 ? "" : " zero"}">${e.n12 ? `${e.n12} deal${e.n12 > 1 ? "s" : ""} FR sur 12 mois` : "Aucun deal FR récent"}</span><span>${esc((f.sectors || []).slice(0, 2).join(" · "))}</span></span></button>`).join("");
  const rail = $("#rail");
  $("#railPrev").addEventListener("click", () => rail.scrollBy({ left: -rail.clientWidth * 0.8, behavior: "smooth" }));
  $("#railNext").addEventListener("click", () => rail.scrollBy({ left: rail.clientWidth * 0.8, behavior: "smooth" }));
  ["#fQ", "#fType", "#fStage", "#fSec", "#fSort", "#fDep"].forEach((s) => $(s).addEventListener(s === "#fQ" ? "input" : "change", () => { FS.shown = 36; renderFonds(); }));
  $("#fMore").addEventListener("click", () => { FS.shown += 48; renderFonds(); });
  renderFonds();
  if (hasGsap) gsap.fromTo("#rail .dcard", { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "expo.out", stagger: 0.04, delay: 0.2, clearProps: "transform,opacity" });
};
// Position d'un libellé de stade sur l'échelle Pre-seed (0) → Growth (5).
function stageIdx(t) {
  t = " " + norm(t) + " ";
  if (/pre ?seed|pre amorcage/.test(t)) return 0;
  if (/seed|amorcage/.test(t)) return 1;
  if (/ seri(e|es)? a /.test(t)) return 2;
  if (/ seri(e|es)? b /.test(t)) return 3;
  if (/ seri(e|es)? c /.test(t)) return 4;
  if (/growth|croissance|late|lbo|buyout|tous/.test(t)) return 5;
  return -1;
}
// Un investisseur couvre un stade si sa fourchette déclarée l'inclut, ou s'il y a déjà fait un deal.
function stageCovers(e, stg) {
  const want = stageIdx(stg);
  if (e.deals.some((d) => d.stage_raw === stg)) return true;
  const ranges = [e.ins && e.ins.stages, ...e.veh.map((f) => f.stage)].filter(Boolean);
  return ranges.some((r) => { const parts = String(r).split(/→|->|–/).map(stageIdx).filter((i) => i >= 0); if (!parts.length) return false; return want >= Math.min(...parts) && want <= Math.max(...parts); });
}
function renderFonds() {
  const q = norm($("#fQ").value), ty = $("#fType").value, stg = $("#fStage").value, sec = $("#fSec").value, dep = $("#fDep").checked;
  let r = ENTS.filter((e) => {
    const type = typeFamily(entType(e));
    if (ty && type !== ty) return false;
    if (dep && !e.veh.length) return false;
    if (stg && !stageCovers(e, stg)) return false;
    if (sec && !e.deals.some((d) => d.sector_raw === sec) && !(e.ins && e.ins.sectors.includes(sec))) return false;
    if (q && !norm([e.name, e.ins && e.ins.focus, e.ins && e.ins.type, e.veh.map((f) => f.name + " " + (f.thesis || "")).join(" ")].join(" ")).includes(q)) return false;
    return true;
  });
  const so = $("#fSort").value;
  r.sort(so === "name" ? (a, b) => a.name.localeCompare(b.name) : so === "nb" ? (a, b) => b.nb - a.nb : (a, b) => b.n12 - a.n12 || b.nb - a.nb);
  FS.rows = r;
  $("#fCount").textContent = `${nf.format(r.length)} investisseurs`;
  $("#fGrid").innerHTML = r.slice(0, FS.shown).map((e) => {
    const ins = e.ins || {};
    const a0 = e.veh[0];
    const sects = (ins.sectors && ins.sectors.length ? ins.sectors : a0 ? a0.sectors : []).slice(0, 4);
    return `<button class="icard${e.veh.length ? " dep" : ""}" type="button" data-ent="${esc(e.key)}">
      <div class="ih">${logo(e.name)}<div style="min-width:0"><div class="nm">${esc(e.name)}</div><div class="ty">${esc(entType(e))}${e.intl ? " · " + esc(e.intl.hq) : ""}${ins.stages ? " · " + esc(ins.stages.replace(/→/g, " → ")) : a0 && a0.stage ? " · " + esc(a0.stage) : ""}</div></div></div>
      <div class="facts"><div><b>${e.nb}</b><span>deals suivis</span></div><div><b>${e.n12}</b><span>sur 12 mois</span></div><div><b>${fmtTicket(ins.ticket_eur_m) ? fmtTicket(ins.ticket_eur_m) : a0 && a0.ticket ? esc(a0.ticket) : "—"}</b><span>ticket</span></div></div>
      ${spark(e.deals)}
      <div>${sects.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div>
      ${e.veh.length ? `<div class="depline">● En déploiement : ${e.veh.map((f) => `<b>${esc(f.name)}</b> · ${esc(f.size_label)}${f.stage ? " · " + esc(f.stage) : ""}`).join(" ; ")}</div>` : ""}
    </button>`;
  }).join("") || `<div class="empty">Aucun investisseur pour ces filtres.</div>`;
  $("#fMore").hidden = r.length <= FS.shown;
  wireExports();
  if (hasGsap) gsap.fromTo("#fGrid .icard", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.015, ease: "power2.out", clearProps: "transform,opacity" });
}

/* ================= PE WATCH ================= */
const P = { status: "", mat: "" };
const peLate = (p) => p.status !== "Exit" && p.exit_window && +LATEST.slice(0, 4) > p.exit_window[1];
BUILDERS.pe = () => {
  const live = PE.filter((p) => p.status !== "Exit");
  const hold = median(PE.map((p) => p.holding_years).filter((v) => v != null));
  $("#pStrip").innerHTML = [[PE.length, "participations suivies"], [live.length, "en portefeuille"], [PE.filter(peLate).length, "en retard sur la fenêtre"], [fmtAmt(PE.reduce((s, p) => s + (p.ev_eur_m || 0), 0)), "valeur d'entreprise cumulée"]].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");
  $("#pStatus").innerHTML = [["", "Toutes"], ["En portefeuille", "En portefeuille"], ["Exit", "Cédées"]].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === P.status}">${l}</button>`).join("");
  $("#pMat").innerHTML = [["", "Toutes"], ["late", "En retard"], ["ok", "Dans les temps"]].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === P.mat}">${l}</button>`).join("");
  $$("#pStatus button").forEach((b) => b.addEventListener("click", () => { P.status = b.dataset.v; $$("#pStatus button").forEach((x) => x.setAttribute("aria-pressed", x === b)); drawGantt(); }));
  $$("#pMat button").forEach((b) => b.addEventListener("click", () => { P.mat = b.dataset.v; $$("#pMat button").forEach((x) => x.setAttribute("aria-pressed", x === b)); drawGantt(); }));
  drawGantt();
};
function drawGantt() {
  const nowY = +LATEST.slice(0, 4) + (+LATEST.slice(5, 7) - 1) / 12;
  const r = PE.filter((p) => (!P.status || p.status === P.status) && (!P.mat || (P.mat === "late" ? peLate(p) : !peLate(p)))).slice().sort((a, b) => (a.entry || "").localeCompare(b.entry || ""));
  const minY = Math.min(2012, ...r.map((p) => +(p.entry || "2015").slice(0, 4))), maxY = Math.ceil(nowY) + 1;
  const W = 900, row = 30, pl = 190, pr = 70, pt = 26, H = pt + r.length * row + 10;
  const x = (y) => pl + ((y - minY) / (maxY - minY)) * (W - pl - pr);
  let svg = "";
  for (let y = minY; y <= maxY; y++) svg += `<line x1="${x(y)}" x2="${x(y)}" y1="${pt - 6}" y2="${H}" stroke="var(--line)"/>` + ((y - minY) % 2 === 0 ? `<text x="${x(y)}" y="${pt - 12}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="var(--muted)">${y}</text>` : "");
  svg += `<line x1="${x(nowY)}" x2="${x(nowY)}" y1="${pt - 6}" y2="${H}" stroke="var(--accent)" stroke-dasharray="3 3"/>`;
  r.forEach((p, i) => {
    const y0 = pt + i * row, e = +(p.entry || "2015-01").slice(0, 4) + (+(p.entry || "2015-01").slice(5, 7) - 1) / 12;
    const end = p.status === "Exit" ? (p.exit_year || nowY) + 0.5 : nowY;
    const late = peLate(p);
    const col = p.status === "Exit" ? "var(--accent)" : late ? "var(--warn)" : "var(--signal)";
    svg += `<g class="grow" data-pe="${i}">`;
    svg += `<text x="${pl - 12}" y="${y0 + 18}" text-anchor="end" font-size="12.5" fill="var(--fg)" font-family="Hanken Grotesk, sans-serif">${esc(p.target.length > 24 ? p.target.slice(0, 23) + "…" : p.target)}</text>`;
    if (p.exit_window) svg += `<rect x="${x(p.exit_window[0])}" y="${y0 + 5}" width="${Math.max(2, x(p.exit_window[1] + 1) - x(p.exit_window[0]))}" height="${row - 10}" rx="4" fill="var(--line-strong)" fill-opacity=".55"/>`;
    svg += `<rect class="b" x="${x(e)}" y="${y0 + 9}" width="${Math.max(3, x(end) - x(e))}" height="${row - 18}" rx="6" fill="${col}"/>`;
    svg += `<text x="${x(end) + 8}" y="${y0 + 19}" font-family="JetBrains Mono, monospace" font-size="10.5" fill="var(--muted)">${p.ev_eur_m ? fmtAmt(p.ev_eur_m) : ""}</text></g>`;
  });
  $("#pGantt").innerHTML = r.length ? `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Chronologie des participations PE, de l'entrée à la sortie">${svg}</svg>` : `<div class="empty">Aucune participation pour ces filtres.</div>`;
  $$("#pGantt .grow").forEach((g) => {
    const p = r[+g.dataset.pe];
    g.addEventListener("mousemove", (ev) => showTip(`<b>${esc(p.target)}</b><small>${esc(p.funds.join(", "))} · entrée ${fmtMonth(p.entry)} · ${esc(p.status)}</small>`, ev.clientX, ev.clientY));
    g.addEventListener("mouseleave", hideTip);
    g.addEventListener("click", () => openDetail({ t: "pe", id: PE.indexOf(p) }));
  });
  if (hasGsap) gsap.fromTo("#pGantt rect.b", { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 0.9, ease: "power3.out", stagger: 0.02 });
}

/* ================= COMPARABLES ================= */
BUILDERS.comps = () => {
  $("#cSec").innerHTML = opt(SECTORS, "Tous");
  $("#cYear").innerHTML = yearsOpts();
  $("#cSec").value = "IA"; $("#cStage").value = "Seed"; $("#cYear").value = "12m";
  ["#cSec", "#cStage", "#cYear", "#cMine", "#cQ"].forEach((s) => $(s).addEventListener("input", renderComps));
  renderComps();
};
function renderComps() {
  const sec = $("#cSec").value, stg = $("#cStage").value, yr = $("#cYear").value, q = norm($("#cQ").value), mine = parseFloat($("#cMine").value);
  const r = D.filter((d) => d.amount_eur_m != null && (!sec || d.sector_raw === sec) && (!stg || d.stage_raw === stg) && inPeriod(d.date, yr) && (!q || norm([d.company, d.pitch].join(" ")).includes(q)));
  const a = r.map((d) => d.amount_eur_m);
  const p25 = quant(a, 0.25), p50 = quant(a, 0.5), p75 = quant(a, 0.75);
  $("#cStrip").innerHTML = [[nf.format(r.length), "deals comparables"], [fmtAmt(p50), "médiane"], [p25 != null ? `${fmtAmt(p25)}–${fmtAmt(p75).replace("€", "")}` : "—", "écart interquartile"], [fmtAmt(a.length ? Math.max(...a) : null), "plus gros tour"]].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");
  // distribution
  const W = 760, H = 150, pl = 20, pr = 20, base = 70;
  const lo = Math.log10(0.05), hi = Math.log10(5000);
  const x = (v) => pl + ((Math.log10(Math.max(0.05, v)) - lo) / (hi - lo)) * (W - pl - pr);
  const pts = r.map((d) => ({ d, x: x(d.amount_eur_m) })).sort((u, v) => u.x - v.x), placed = [];
  pts.forEach((p) => { let off = 0; for (let k = 0; k < 40; k++) { const o = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 8; if (placed.every((u) => Math.abs(u.x - p.x) > 8 || Math.abs(u.y - (base + o)) >= 8)) { off = o; break; } } p.y = base + off; placed.push(p); });
  const ticks = [[0.1, "100k"], [1, "1M"], [10, "10M"], [100, "100M"], [1000, "1Md"]];
  let svg = ticks.map(([v, l]) => `<line x1="${x(v)}" x2="${x(v)}" y1="8" y2="${H - 22}" stroke="var(--line)" stroke-dasharray="2 4"/><text x="${x(v)}" y="${H - 6}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="var(--muted)">€${l}</text>`).join("");
  if (p25 != null) svg += `<rect x="${x(p25)}" y="14" width="${Math.max(2, x(p75) - x(p25))}" height="${H - 42}" rx="6" fill="var(--signal)" fill-opacity=".1"/><line x1="${x(p50)}" x2="${x(p50)}" y1="14" y2="${H - 28}" stroke="var(--signal)" stroke-width="1.5"/>`;
  svg += placed.map((p, i) => `<circle class="cpt" data-i="${i}" cx="${p.x.toFixed(1)}" cy="${Math.max(12, Math.min(H - 30, p.y)).toFixed(1)}" r="3.6" fill="${stageColor(p.d.stage_raw)}" fill-opacity=".85"/>`).join("");
  if (mine > 0) svg += `<g><line x1="${x(mine)}" x2="${x(mine)}" y1="4" y2="${H - 24}" stroke="var(--accent)" stroke-width="2"/><text x="${x(mine) + 6}" y="14" font-family="JetBrains Mono, monospace" font-size="11" fill="var(--accent)">vous · ${fmtAmt(mine)}</text></g>`;
  $("#cDist").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Distribution des montants des deals comparables">${svg}</svg>`;
  $$("#cDist .cpt").forEach((c) => { const d = placed[+c.dataset.i].d; c.style.cursor = "pointer"; c.addEventListener("mousemove", (e) => showTip(`<b>${esc(d.company)}</b><small>${fmtAmt(d.amount_eur_m)} · ${esc(d.stage_raw)} · ${fmtMonth(d.date)}</small>`, e.clientX, e.clientY)); c.addEventListener("mouseleave", hideTip); c.addEventListener("click", () => openDetail({ t: "startup", id: d.company })); });
  if (mine > 0 && a.length) {
    const pct = Math.round((a.filter((v) => v < mine).length / a.length) * 100);
    $("#cPos").innerHTML = `Avec ${fmtAmt(mine)}, votre tour se situe au-dessus de <b>${pct} %</b> des ${a.length} deals comparables. ${mine < p25 ? "C'est sous la fourchette habituelle de ce segment." : mine > p75 ? "C'est au-dessus de la fourchette habituelle de ce segment." : "C'est dans la fourchette habituelle de ce segment."}`;
  } else $("#cPos").textContent = a.length ? "" : "Aucun deal comparable : élargissez la période ou retirez un filtre.";
  $("#cCount").textContent = `${r.length} deals`;
  $("#cList").innerHTML = r.slice().sort((u, v) => Math.abs(Math.log((u.amount_eur_m || 0.01) / (mine || p50 || 1))) - Math.abs(Math.log((v.amount_eur_m || 0.01) / (mine || p50 || 1)))).slice(0, 12).map(lrowDeal).join("");
  if (hasGsap) $$("#cDist .cpt").forEach((c, i) => gsap.fromTo(c, { attr: { cy: base }, opacity: 0 }, { attr: { cy: +c.getAttribute("cy") }, opacity: 1, duration: 0.6, delay: i * 0.004, ease: "power2.out" }));
}

/* ================= ACQUÉREURS ================= */
const A = { page: 1, per: 30 };
BUILDERS.acq = () => {
  const withM = OPS.filter((o) => o.amount_eur_m);
  const top = BUYERS.slice().sort((a, b) => b.ops.length - a.ops.length)[0];
  $("#aStrip").innerHTML = [[BUYERS.length, "acquéreurs"], [OPS.length, "opérations suivies"], [fmtAmt(median(withM.map((o) => o.amount_eur_m))), "montant médian publié"], [esc(top ? top.name : "—"), `le plus actif · ${top ? top.ops.length : 0} opérations`]].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");
  ["#aQ", "#aSort"].forEach((s) => $(s).addEventListener(s === "#aQ" ? "input" : "change", () => { A.page = 1; renderAcq(); }));
  renderAcq();
};
function renderAcq() {
  const q = norm($("#aQ").value), so = $("#aSort").value;
  let r = BUYERS.filter((b) => !q || norm([b.name, b.ops.map((o) => o.sector_raw + " " + o.target).join(" ")].join(" ")).includes(q));
  const sum = (b) => b.ops.reduce((s, o) => s + (o.amount_eur_m || 0), 0), last = (b) => b.ops.map((o) => o.date || "").sort().pop();
  r.sort(so === "v" ? (a, b) => sum(b) - sum(a) : so === "d" ? (a, b) => last(b).localeCompare(last(a)) : (a, b) => b.ops.length - a.ops.length || sum(b) - sum(a));
  const page = r.slice((A.page - 1) * A.per, A.page * A.per);
  $("#aTable").innerHTML = `<div class="tr head t-acq"><span>Acquéreur</span><span class="r">Ops</span><span>Cibles</span><span>Secteurs</span><span class="r">Cumul</span></div>` +
    (page.map((b) => `<div class="tr row t-acq" data-buyer="${esc(norm(b.name))}"><span class="nm" style="display:flex;gap:10px;align-items:center">${logo(b.name, "av sm")}<span style="min-width:0">${esc(b.name)}${entFor(b.name) ? ' <span class="deploy-tag" style="background:color-mix(in srgb,var(--signal) 16%,transparent);color:var(--signal)">AUSSI INVESTISSEUR</span>' : ""}<small>dernière : ${fmtMonth(last(b))}</small></span></span><span class="r">${b.ops.length}</span><span class="inv">${esc(b.ops.map((o) => o.target).join(", "))}</span><span class="muted" style="font-size:.82rem">${esc([...new Set(b.ops.map((o) => o.sector_raw))].slice(0, 3).join(", "))}</span><span class="r amt">${fmtAmt(sum(b) || null)}</span></div>`).join("") || `<div class="empty">Aucun acquéreur.</div>`);
  pager($("#aPager"), r.length, A.page, A.per, (p) => { A.page = p; renderAcq(); });
}

/* ================= FICHES ================= */
const stack = [];
function openDetail(ref, push = true) {
  const html = ref.t === "fund" ? fundDetail(ref.id) : ref.t === "ent" ? entDetail(ref.id) : ref.t === "startup" ? startupDetail(ref.id) : ref.t === "op" ? opDetail(ref.id) : ref.t === "buyer" ? buyerDetail(ref.id) : ref.t === "pe" ? peDetail(ref.id) : null;
  if (!html) return;
  if (push) stack.push(ref);
  $("#dBack").disabled = stack.length < 2;
  $("#dCrumb").textContent = { fund: "Fonds européen", ent: "Fonds", startup: "Startup", op: "Opération", buyer: "Acquéreur", pe: "PE Watch" }[ref.t] + " · " + (ref.label || ref.id);
  $("#dBody").innerHTML = html;
  $("#dBody").scrollTop = 0;
  $("#drawer").classList.add("on"); $("#scrim").classList.add("on"); $("#drawer").setAttribute("aria-hidden", "false");
  if (hasGsap) {
    gsap.fromTo("#dBody > *", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.04, ease: "power3.out", delay: 0.08, clearProps: "transform,opacity" });
    gsap.fromTo("#dBody .hbar .t i", { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "power3.out", stagger: 0.02, delay: 0.25 });
    gsap.fromTo("#dBody .qbar", { scaleY: 0 }, { scaleY: 1, duration: 0.8, ease: "power3.out", stagger: 0.02, delay: 0.25 });
  }
  try { history.replaceState(null, "", "#" + ref.t + ":" + encodeURIComponent(ref.id)); } catch (e) { /* hôte sans historique */ }
}
function closeDetail() { $("#drawer").classList.remove("on"); $("#scrim").classList.remove("on"); $("#drawer").setAttribute("aria-hidden", "true"); stack.length = 0; try { history.replaceState(null, "", "#" + current); } catch (e) { /* hôte sans historique */ } }
$("#dLink").addEventListener("click", () => copyText(location.href));
$("#dClose").addEventListener("click", closeDetail);
$("#scrim").addEventListener("click", closeDetail);
$("#dBack").addEventListener("click", () => { stack.pop(); const prev = stack[stack.length - 1]; if (prev) openDetail(prev, false); });
const sec = (t, body) => (body ? `<div class="d-sec"><h4>${t}</h4>${body}</div>` : "");
const facts4 = (arr) => `<div class="facts4">${arr.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("")}</div>`;
function qChart(deals) {
  const c = Object.fromEntries(quarterKeys.map((k) => [k, 0]));
  deals.forEach((d) => { const k = qOf(d.date || "0000-01"); if (k in c) c[k]++; });
  const mx = Math.max(1, ...Object.values(c)), W = 640, H = 120, bw = W / quarterKeys.length;
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H + 20}" role="img" aria-label="Deals par trimestre">${quarterKeys.map((k, i) => `<rect class="qbar" style="transform-origin:${(i * bw + bw / 2).toFixed(1)}px ${H}px" x="${(i * bw + 4).toFixed(1)}" y="${(H - (c[k] / mx) * (H - 14)).toFixed(1)}" width="${(bw - 8).toFixed(1)}" height="${((c[k] / mx) * (H - 14)).toFixed(1)}" rx="3" fill="var(--signal)"/><text x="${(i * bw + bw / 2).toFixed(1)}" y="${(H - (c[k] / mx) * (H - 14) - 4).toFixed(1)}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="var(--muted)">${c[k] || ""}</text>${k.endsWith("Q1") ? `<text x="${(i * bw + 4).toFixed(1)}" y="${H + 16}" font-family="JetBrains Mono, monospace" font-size="10" fill="var(--muted)">${k.slice(0, 4)}</text>` : ""}`).join("")}</svg></div>`;
}
function hbars(entries, fmt = (v) => v) { const mx = Math.max(1, ...entries.map((e) => e[1])); return entries.map(([k, v]) => `<div class="hbar" style="cursor:default"><span>${esc(k)}</span><div class="t"><i style="width:${(v / mx) * 100}%"></i></div><span class="r">${fmt(v)}</span></div>`).join(""); }
function intlBlock(p) {
  return `<div class="vehicle" style="border-color:color-mix(in srgb,var(--signal) 40%,var(--line));background:linear-gradient(170deg,color-mix(in srgb,var(--signal) 7%,var(--bg-2)),var(--bg-2) 60%)">
    <div class="vh"><div><span class="deploy-tag" style="background:color-mix(in srgb,var(--signal) 16%,transparent);color:var(--signal)">PROFIL INTERNATIONAL</span><h3 style="margin-top:8px">${esc(p.name)}</h3><p class="muted" style="font-size:.84rem">${esc(p.hq)} · ${esc(p.country)} · fondé en ${p.founded}</p></div>${p.aum ? `<div style="text-align:right"><div style="font-family:var(--f-display);font-size:1.7rem;font-weight:500;letter-spacing:-.04em">${esc(p.aum)}</div><div class="mono muted">actifs sous gestion (public)</div></div>` : ""}</div>
    <dl class="kv"><dt>Type</dt><dd>${esc(p.type)}</dd><dt>Stades</dt><dd>${esc(p.stages)}</dd><dt>Focus</dt><dd>${esc(p.focus)}</dd>${p.notable ? `<dt>Portefeuille</dt><dd>${esc(p.notable)}</dd>` : ""}<dt>Site</dt><dd class="mono">${esc(p.domain)}</dd></dl>
    <p class="mono muted">Profil éditorial à partir d'informations publiques ; chiffres indicatifs.</p>
  </div>`;
}
function vehicleBlock(f, foreign = false) {
  const ppl = VEH_PEOPLE.get(f.id) || [];
  const roles = ppl.filter((p) => p.role).map((p) => p.role);
  return `<div class="vehicle">
    <div class="vh"><div><span class="deploy-tag"${foreign ? ' style="background:var(--bg-3);color:var(--muted)"' : ""}>${foreign ? "ÉTRANGER · HORS FRANCE" : "EN DÉPLOIEMENT"}</span><h3 style="margin-top:8px">${esc(f.name)}</h3><p class="muted" style="font-size:.84rem">${esc(f.country)} · ${esc(f.stage || "")} ${f.consolidation !== "full" ? "· fiche partiellement consolidée" : ""}</p></div><div style="text-align:right"><div style="font-family:var(--f-display);font-size:1.9rem;font-weight:500;letter-spacing:-.04em">${esc(f.size_label)}</div><div class="mono muted">taille affichée, non vérifiée</div></div></div>
    <dl class="kv">
      ${f.thesis ? `<dt>Thèse</dt><dd>${esc(f.thesis)}</dd>` : ""}
      ${f.ticket ? `<dt>Ticket initial</dt><dd>${esc(f.ticket)}</dd>` : ""}
      ${f.sectors && f.sectors.length ? `<dt>Secteurs</dt><dd>${f.sectors.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</dd>` : ""}
      ${f.geo_scope ? `<dt>Géographie</dt><dd>${esc(f.geo_scope)}</dd>` : ""}
      ${f.lps ? `<dt>LPs visibles</dt><dd>${esc(f.lps)}</dd>` : ""}
      ${f.signals ? `<dt>Signaux</dt><dd>${esc(f.signals)}</dd>` : ""}
      ${f.contact ? `<dt>Contact</dt><dd class="mono">${esc(f.contact)}</dd>` : ""}
      ${roles.length || f.roles ? `<dt>Rôles</dt><dd>${esc(f.roles || roles[0])}</dd>` : ""}
    </dl>
    ${ppl.length ? `<div><div class="eyebrow" style="margin-bottom:8px">Équipe citée (${ppl.length})</div><div class="people">${ppl.map((p) => `<span class="person"><span class="av">${esc(initials(p.name))}</span>${esc(p.name)}</span>`).join("")}</div></div>` : ""}
    ${f.caveats ? `<div class="warnbox"><b>Réserves</b>${esc(f.caveats)}</div>` : ""}
    <p class="mono muted">Fiche consultée le ${esc(f.consulted || "")} · montants affichés par le gestionnaire</p>
  </div>`;
}
function entDetail(key) {
  let e = ENT.get(key);
  if (!e) { const deals = DBC.get(key) || []; if (!deals.length) return null; const nm = deals[0].investors.find((i) => core(i) === key) || key; e = { key, name: nm, ins: null, veh: [], deals, n12: deals.filter((d) => d.date >= SINCE12).length, nb: deals.length }; }
  const ins = e.ins || {};
  const deals = e.deals.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const tot = deals.reduce((s, d) => s + (d.amount_eur_m || 0), 0);
  const bySec = Object.entries(deals.reduce((a, d) => ((a[d.sector_raw || "NC"] = (a[d.sector_raw || "NC"] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const bySt = STAGE_ORDER.map((s) => [s, deals.filter((d) => d.stage_raw === s).length]).filter((x) => x[1]);
  const co = new Map(); deals.forEach((d) => d.investors.forEach((i) => { if (core(i) !== e.key && !isGeneric(i)) co.set(i, (co.get(i) || 0) + 1); }));
  const coTop = [...co.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const buyer = BUY.get(norm(e.name));
  return `<div><div class="d-title">${logo(e.name)}<div><h2>${esc(e.name)}</h2><div class="d-tags"><span class="pill">${esc(entType(e))}</span>${e.intl ? `<span class="deploy-tag" style="background:color-mix(in srgb,var(--signal) 16%,transparent);color:var(--signal)">INTERNATIONAL · ${esc(e.intl.country.toUpperCase())}</span>` : ""}${e.veh.length ? `<span class="deploy-tag">${e.veh.length} FONDS EN DÉPLOIEMENT</span>` : ""}${e.foreign.length ? '<span class="pill">Fonds étranger hors France</span>' : ""}${buyer ? '<span class="pill">Acquéreur</span>' : ""}</div></div></div></div>
    ${facts4([[e.nb, "deals suivis"], [e.n12, "sur 12 mois"], [fmtAmt(tot || null), "tours co-financés"], [fmtTicket(ins.ticket_eur_m) ? fmtTicket(ins.ticket_eur_m) : e.veh[0] && e.veh[0].ticket ? esc(e.veh[0].ticket) : "—", "ticket"]])}
    ${ins.focus || ins.stages ? sec("Profil Insights", `<dl class="kv">${ins.stages ? `<dt>Stades</dt><dd>${esc(ins.stages.replace(/→/g, " → "))}</dd>` : ""}${ins.focus ? `<dt>Focus</dt><dd>${esc(ins.focus)}</dd>` : ""}${ins.sectors && ins.sectors.length ? `<dt>Secteurs</dt><dd>${ins.sectors.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</dd>` : ""}</dl>`) : ""}
    ${e.intl ? intlBlock(e.intl) : ""}
    ${e.foreign.length ? sec(`Fonds étranger en déploiement · sans levée en France sur 24 mois`, `<div style="display:flex;flex-direction:column;gap:12px">${e.foreign.map((f) => vehicleBlock(f, true)).join("")}</div>`) : ""}
    ${e.veh.length ? sec(`Fonds en cours de déploiement (${e.veh.length})`, `<div style="display:flex;flex-direction:column;gap:12px">${e.veh.map((f) => vehicleBlock(f)).join("")}</div>`) : e.foreign.length || !e.ins ? "" : sec("Fonds en cours de déploiement", `<p class="muted" style="font-size:.88rem">Aucun véhicule en cours de déploiement n'est référencé pour ce gestionnaire.</p>`)}
    ${!e.ins && !e.intl && !e.veh.length && !e.foreign.length ? `<p class="muted" style="font-size:.86rem">Fiche construite à partir des levées suivies par Insights${entType(e) === "Business angel" ? " (investisseur individuel)" : ""}.</p>` : ""}
    ${deals.length ? sec("Rythme d'investissement · deals par trimestre", qChart(deals)) : ""}
    ${bySec.length ? `<div class="grid" style="gap:16px">${`<div class="c6">${sec("Secteurs", hbars(bySec))}</div><div class="c6">${sec("Stades", hbars(bySt))}</div>`}</div>` : ""}
    ${deals.length ? sec(`Derniers deals (${deals.length})`, deals.slice(0, 10).map(lrowDeal).join("")) : ""}
    ${coTop.length ? sec("Co-investisseurs fréquents", `<div class="chips">${coTop.map(([n, k]) => { const ce = entFor(n); return ce ? `<button class="chip chip-logo" type="button" data-ent="${esc(ce.key)}">${logo(n, "av xs")}${esc(n)} · ${k}</button>` : `<span class="chip" style="cursor:default">${esc(n)} · ${k}</span>`; }).join("")}</div>`) : ""}
    ${buyer ? sec(`Comme acquéreur (${buyer.ops.length})`, buyer.ops.map(lrowOp).join("")) : ""}
    <p class="mono muted">Source : Insights French Tech (deals France depuis 2024). Véhicules rattachés par nom de gestionnaire.</p>`;
}
function startupDetail(name) {
  const n = norm(name);
  const s = STI.get(n);
  const deals = D.filter((d) => norm(d.company) === n).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const ops = OPS.filter((o) => norm(o.target) === n);
  const pe = PE.filter((p) => norm(p.target) === n);
  if (!s && !deals.length && !ops.length && !pe.length) return null;
  const tot = deals.reduce((a, d) => a + (d.amount_eur_m || 0), 0) || (s && s.total) || null;
  const last = deals[deals.length - 1] || {};
  const pitch = (deals.find((d) => d.pitch) || {}).pitch || (s && s.pitch) || (ops[0] && ops[0].description) || "";
  const invs = [...new Set(deals.flatMap((d) => d.investors))];
  const tl = [...deals.map((d) => ({ date: d.date, h: `${esc(d.stage_raw || "Tour")}`, v: fmtAmt(d.amount_eur_m), p: invLinks(d.investors) || "Investisseurs non communiqués", exit: false })), ...ops.map((o) => ({ date: o.date, h: `${esc(o.type)} par ${esc(o.acquirer)}`, v: fmtAmt(o.amount_eur_m), p: esc(o.context || o.description || ""), exit: true }))].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return `<div><div class="d-title"><span class="av">${esc(initials(name))}</span><div><h2>${esc((s && s.name) || name)}</h2><div class="d-tags">${last.sector_raw || (s && s.sector_raw) ? `<span class="pill">${esc(last.sector_raw || s.sector_raw)}</span>` : ""}${stagePill(last.stage_raw || (s && s.stage_raw))}${ops.length ? '<span class="deploy-tag">EXIT</span>' : ""}</div></div></div></div>
    ${pitch ? `<p style="font-size:1.05rem;color:var(--muted);max-width:60ch">${esc(pitch)}</p>` : ""}
    ${facts4([[fmtAmt(tot), "levés (suivis)"], [deals.length, "tours suivis"], [fmtMonth(last.date), "dernier tour"], [invs.filter((i) => !isGeneric(i)).length, "investisseurs"]])}
    ${tl.length ? sec("Historique", `<div class="timeline">${tl.map((t) => `<div class="tl${t.exit ? " exit" : ""}"><div class="h">${fmtMonth(t.date)} · ${t.h}<span>${t.v}</span></div><p>${t.p}</p></div>`).join("")}</div>`) : ""}
    ${pe.length ? sec("PE Watch", pe.map((p) => `<p>${esc(p.type)} par ${esc(p.funds.join(", "))}, entrée ${fmtMonth(p.entry)}, ${esc(p.status)}. ${esc(p.description || "")}</p>`).join("")) : ""}
    ${last.amount_eur_m ? `<div class="chips"><button class="btn" type="button" data-comps="${esc(JSON.stringify({ sec: last.sector_raw, st: last.stage_raw, amt: last.amount_eur_m }))}">Comparer ce tour (${fmtAmt(last.amount_eur_m)}, ${esc(last.stage_raw || "")}) aux deals similaires →</button></div>` : ""}
    <p class="mono muted">Source : Insights French Tech.</p>`;
}
function opDetail(id) {
  const o = OPS.find((x) => x.id === id); if (!o) return null;
  const hasSt = STI.has(norm(o.target)) || D.some((d) => norm(d.company) === norm(o.target));
  const facts = [["SIREN", o.siren], ["Création", o.founded], ["Effectif", o.employees], ["Catégorie", o.category], ["Chiffre d'affaires / ARR", o.revenue || o.arr], ["Dernière levée", o.last_raise], ["Rentable", o.profitable == null ? null : o.profitable ? "Oui" : "Non"]].filter((x) => x[1]);
  return `<div><span class="pill">${esc(o.type)}</span><h2 style="font-size:clamp(1.6rem,4vw,2.3rem);letter-spacing:-.04em;margin-top:10px">${esc(o.target)} <span class="muted">→</span> ${esc(o.acquirer || "?")}</h2></div>
    ${facts4([[fmtAmt(o.amount_eur_m), "montant"], [fmtMonth(o.date), "date"], [esc(o.sector_raw || "—"), "secteur"], [BUY.get(norm(o.acquirer)) ? BUY.get(norm(o.acquirer)).ops.length : 1, "ops de l'acquéreur"]])}
    ${o.description ? sec("Activité", `<p>${esc(o.description)}</p>`) : ""}
    ${o.context ? sec("Contexte", `<p style="white-space:pre-line">${esc(o.context)}</p>`) : ""}
    ${facts.length ? sec("Société", `<dl class="kv">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`) : ""}
    <div class="chips">${hasSt ? `<button class="btn" type="button" data-startup="${esc(o.target)}">Historique de ${esc(o.target)} →</button>` : ""}<button class="btn" type="button" data-buyer="${esc(norm(o.acquirer))}">Toutes les opérations de ${esc(o.acquirer)} →</button></div>
    <p class="mono muted">Source : Insights French Tech${o.source ? " · " + esc(o.source) : ""}.</p>`;
}
function buyerDetail(k) {
  const b = BUY.get(k); if (!b) return null;
  const ops = b.ops.slice().sort((x, y) => (y.date || "").localeCompare(x.date || ""));
  const e = entFor(b.name);
  const bySec = Object.entries(ops.reduce((a, o) => ((a[o.sector_raw || "NC"] = (a[o.sector_raw || "NC"] || 0) + 1), a), {})).sort((x, y) => y[1] - x[1]).slice(0, 6);
  return `<div><div class="d-title">${logo(b.name)}<div><h2>${esc(b.name)}</h2><div class="d-tags"><span class="pill">Acquéreur</span>${e ? `<button class="chip" type="button" data-ent="${esc(e.key)}">Voir la fiche investisseur</button>` : ""}</div></div></div></div>
    ${facts4([[ops.length, "opérations"], [fmtAmt(ops.reduce((s, o) => s + (o.amount_eur_m || 0), 0) || null), "montants publiés"], [fmtMonth(ops[0] && ops[0].date), "dernière"], [new Set(ops.map((o) => o.type)).size, "types d'opération"]])}
    ${sec("Secteurs ciblés", hbars(bySec))}
    ${sec("Opérations", ops.map(lrowOp).join(""))}`;
}
function peDetail(i) {
  const p = PE[i]; if (!p) return null;
  return `<div><span class="pill">${esc(p.type)}</span><h2 style="font-size:clamp(1.6rem,4vw,2.3rem);letter-spacing:-.04em;margin-top:10px">${esc(p.target)}</h2><p class="muted" style="margin-top:6px">${esc(p.funds.join(", "))}</p></div>
    ${facts4([[fmtAmt(p.ev_eur_m), "valeur d'entreprise"], [fmtMonth(p.entry), "entrée"], [esc(p.status), "statut"], [p.holding_years != null ? String(p.holding_years).replace(".", ",") + " ans" : p.exit_year ? p.exit_year : "—", p.holding_years != null ? "détention" : "sortie"]])}
    ${p.exit_window ? sec("Fenêtre de sortie attendue", `<p>${p.exit_window[0]}–${p.exit_window[1]}${peLate(p) ? ' · <b style="color:var(--warn)">en retard</b>' : ""}</p>`) : ""}
    ${p.description ? sec("Contexte", `<p>${esc(p.description)}</p>`) : ""}
    ${sec("Fonds", `<div class="chips">${p.funds.map((f) => { const e = entFor(f); return e ? `<button class="chip" type="button" data-ent="${esc(e.key)}">${esc(f)}</button>` : `<span class="chip" style="cursor:default">${esc(f)}</span>`; }).join("")}</div>`)}`;
}

/* ================= MCP ================= */
const MCP_URL = "https://www.insights-french-tech.com/mcp";
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), 1800); }
async function copyText(text, node) {
  try { await navigator.clipboard.writeText(text); toast("Copié"); }
  catch (e) { if (node) { const r = document.createRange(); r.selectNodeContents(node); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } toast("Sélectionné : copiez avec Ctrl+C"); }
}
const MCP_TOOLS = [
  ["find_investors", "Classe /100 les investisseurs pertinents pour votre levée : secteur, stade, rythme récent, ticket, fonds en déploiement.", "Je lève 3 M€ en seed pour une IA industrielle, qui contacter ?"],
  ["search_deals", "Levées filtrées par secteur, stade, investisseur, période ou montant.", "Les levées Série A en santé depuis juillet."],
  ["get_investor", "Fiche complète d'un fonds : thèse, ticket, LPs, équipe, deals, co-investisseurs.", "Que fait Serena en ce moment ?"],
  ["deploying_funds", "Véhicules en cours d'investissement, avec leurs deals français récents.", "Quels fonds en déploiement investissent en deeptech ?"],
  ["comparables", "Médiane, quartiles et percentile de votre montant face aux deals comparables.", "3 M€ en seed IA, c'est haut ou bas ?"],
  ["match_european_funds", "Classe /100 les fonds VC européens en déploiement pour votre levée, avec bonus s'ils investissent en France.", "Quels fonds allemands ou suisses pour ma seed deeptech ?"],
  ["search_european_funds", "Annuaire des ~200 fonds européens en déploiement : taille, thèse, ticket, LPs, activité en France.", "Les fonds climat européens de plus de 100 M€."],
  ["get_european_fund", "Fiche d'un fonds européen : équipe, LPs, signaux, deals français, fonds comparables.", "Que sait-on de Cherry Ventures ?"],
  ["international_funds", "Grands fonds internationaux (Insight Partners, ICONIQ, Sequoia, a16z…) et leurs deals en France.", "Quels fonds américains ont investi en France cette année ?"],
  ["get_startup", "Historique des tours d'une startup, investisseurs, exit éventuel.", "Résume les levées de Mistral AI."],
  ["top_investors", "Investisseurs les plus actifs sur une période, un secteur, un stade.", "Top 10 des investisseurs seed sur 12 mois."],
  ["market_overview", "Volumes par mois, secteur ou stade.", "Combien a levé la French Tech au T3 ?"],
  ["exits_and_ma", "Acquisitions, IPO, OPA et LBO avec contexte et données société.", "Les rachats de startups IA cette année."],
  ["get_acquirer", "Toutes les opérations d'un acquéreur.", "Qu'a racheté Mistral AI ?"],
  ["pe_watch", "Participations LBO et fenêtres de sortie, avec retards.", "Quelles participations PE sont en retard de sortie ?"],
  ["list_investors", "Annuaire filtrable des investisseurs actifs en France.", "Les CVC actifs en fintech."],
  ["search · fetch", "Recherche globale, compatible avec la recherche approfondie de ChatGPT.", ""],
  ["data_status", "Fraîcheur de la base et dernière mise à jour.", "De quand datent les données ?"],
];
BUILDERS.mcp = () => {
  $("#mcpUrl").textContent = MCP_URL;
  $("#cfgDesktop").textContent = JSON.stringify({ mcpServers: { "insights-french-tech": { command: "npx", args: ["-y", "mcp-remote", MCP_URL] } } }, null, 2);
  $("#cfgCode").textContent = `claude mcp add --transport http insights-french-tech ${MCP_URL}`;
  $$("#cfgTabs button").forEach((b) => b.addEventListener("click", () => { $$("#cfgTabs button").forEach((x) => x.setAttribute("aria-pressed", x === b)); $$("#v-mcp [data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.c)); }));
  $$("#v-mcp .copy").forEach((b) => b.addEventListener("click", () => { const n = document.getElementById(b.dataset.copy); copyText(n.textContent, n); }));
  $("#toolGrid").innerHTML = MCP_TOOLS.map(([n, d, ex]) => `<div class="toolc"><code>${n}</code><p>${d}</p>${ex ? `<p class="ex">« ${esc(ex)} »</p>` : ""}</div>`).join("");
  $("#qchips").innerHTML = MCP_TOOLS.filter((x) => x[2]).map((x) => `<button class="qchip" type="button">${esc(x[2])}</button>`).join("");
  $$("#qchips .qchip").forEach((b) => b.addEventListener("click", () => copyText(b.textContent, b)));
  $("#mcpFresh").textContent = `La base est mise à jour chaque semaine. Données actuelles : jusqu'au ${fmtDay(LATEST_DAY)}, ${nf.format(D.length)} levées, ${OPS.length} exits, ${ENTS.length} investisseurs.`;
  buildChat(true);
  $("#replay").addEventListener("click", () => buildChat(true));
};
// Conversation d'exemple calculée sur les vraies données : investisseurs seed IA / climat / énergie sur 24 mois.
function buildChat(animate) {
  const since = ymAdd(LATEST, -23);
  const secs = new Set(["IA", "GreenTech", "Energy"]);
  const pool = D.filter((d) => d.date >= since && d.stage_raw === "Seed" && secs.has(d.sector_raw));
  const c = new Map();
  pool.forEach((d) => new Set(d.investors).forEach((i) => { if (!isGeneric(i)) c.set(i, (c.get(i) || 0) + 1); }));
  const top = [...c.entries()].sort((a, b) => { const da = (entFor(a[0]) || {}).veh?.length ? 1 : 0, db = (entFor(b[0]) || {}).veh?.length ? 1 : 0; return b[1] + db * 2 - (a[1] + da * 2); }).slice(0, 3);
  const amts = pool.map((d) => d.amount_eur_m).filter((v) => v != null);
  const args = { description: "IA de décarbonation pour sites industriels", stage: "Seed", amount_eur_m: 3, limit: 5 };
  $("#chat").innerHTML = [
    `<div class="msg user">Je lève 3 M€ en seed pour une IA qui décarbone les sites industriels. Quels fonds contacter en priorité ?</div>`,
    `<div class="toolcall">⚙ insights-french-tech · find_investors<pre class="code" style="margin:0">${esc(JSON.stringify(args, null, 2))}</pre></div>`,
    `<div class="msg bot">Sur 24 mois, ${pool.length} tours seed IA / climat / énergie ont été suivis (médiane ${fmtAmt(median(amts))}). Les plus actifs :<ol>${top.map(([n, k]) => { const e = entFor(n); const v = e && e.veh[0]; return `<li><b>${esc(n)}</b> : ${k} deal${k > 1 ? "s" : ""} comparables${v ? `, fonds en déploiement ${esc(v.name)} (${esc(v.size_label)})` : ""}.</li>`; }).join("")}</ol><p class="muted" style="margin-top:8px;font-size:.84rem">Votre montant se situe dans la fourchette haute du segment. Je peux ouvrir la fiche de chacun.</p></div>`,
  ].join("");
  if (animate && hasGsap) gsap.fromTo("#chat > *", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out", stagger: 0.7, clearProps: "transform,opacity" });
}

/* ================= FONDS EUROPÉENS ================= */
const FC = window.FundsCore;
const EU_ORDER = ["France", "Allemagne", "Pays-Bas", "Belgique", "Suisse", "Autriche", "Luxembourg", "Irlande", "Monaco"];
const EU_STAGES = FC.STAGES;
const euStageColor = (s) => `var(--s${Math.max(0, EU_STAGES.indexOf(s))})`;
// Activité française d'un fonds = celle de son gestionnaire dans Insights.
const fundEnt = (f) => ENT.get(core(f.name)) || null;
const frActivity = (f) => { const e = fundEnt(f); if (!e || !e.deals.length) return null; const last = e.deals.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0]; return { n12: e.n12, n24: e.n24, last: `${last.company}, ${fmtMonth(last.date)}`, e }; };
const investsFR = (f) => f.country === "France" || ((frActivity(f) || {}).n24 || 0) > 0;
const EU = { shown: 24, rows: AF };
const euMap = { nodes: [], hubs: [], hot: null, hover: null, w: 0, h: 0, t0: 0, running: false };

BUILDERS.europe = () => {
  const cap = AF.reduce((s, f) => s + (f.size_eur_m || 0), 0);
  const nFr = AF.filter(investsFR).length;
  $("#euLede").innerHTML = `${AF.length} fonds actifs dans ${new Set(AF.map((f) => f.country)).size} pays, avec leur taille, leur thèse, leur ticket, leurs LPs et leur équipe. Chaque fiche est enrichie par Insights : ${nFr} d'entre eux investissent en France, avec leurs deals récents.`;
  $("#euStrip").innerHTML = [[AF.length, "fonds en déploiement"], [fmtAmt(cap), "capital affiché cumulé"], [`<span style="color:var(--accent)">${nFr}</span>`, "investissent en France"], [AF.filter((f) => f.ticket).length, "publient leur ticket"]].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");
  // pays
  const byC = EU_ORDER.map((c) => { const fs = AF.filter((f) => f.country === c); const sz = fs.map((f) => f.size_eur_m).filter(Boolean); return { c, n: fs.length, cap: sz.reduce((a, b) => a + b, 0), med: median(sz) }; }).filter((x) => x.n);
  const mx = Math.max(...byC.map((x) => x.n));
  $("#euCountries").innerHTML = byC.map((x) => `<div class="crow" data-c="${esc(x.c)}"><span class="cc">${FC.COUNTRY_CODE[x.c] || ""}</span><span>${esc(x.c)}</span><div class="bar"><i style="width:${(x.n / mx) * 100}%"></i></div><span class="r">${x.n}</span><span class="r">${fmtAmt(x.cap)}</span><span class="r dim">${fmtAmt(x.med)}</span></div>`).join("");
  $$("#euCountries .crow").forEach((r) => r.addEventListener("click", () => { $("#euCountry").value = r.dataset.c; EU.shown = 24; renderEurope(); $("#euGrid").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); }));
  const byS = EU_STAGES.map((s) => ({ s, n: AF.filter((f) => f.stage === s).length })).filter((x) => x.n);
  $("#euStageNote").textContent = `${AF.length} fonds`;
  $("#euStages").innerHTML = `<div class="stagebar">${byS.map((x) => `<div data-s="${esc(x.s)}" style="flex-grow:${x.n};background:${euStageColor(x.s)}" title="${esc(x.s)} · ${x.n}">${x.n / AF.length > 0.1 ? Math.round((x.n / AF.length) * 100) + "%" : ""}</div>`).join("")}</div><div style="margin-top:12px">${byS.map((x) => `<div class="srow" data-s="${esc(x.s)}"><i style="background:${euStageColor(x.s)}"></i><span>${esc(x.s)}</span><span class="r">${x.n}</span><span class="r">${fmtAmt(median(AF.filter((f) => f.stage === x.s).map((f) => f.size_eur_m).filter(Boolean)))} méd.</span></div>`).join("")}</div>`;
  $$("#euStages [data-s]").forEach((r) => r.addEventListener("click", () => { $("#euStage").value = r.dataset.s; EU.shown = 24; renderEurope(); }));
  $("#euLegend").innerHTML = EU_STAGES.slice(0, 6).map((s) => `<span><i style="background:${euStageColor(s)};height:8px;width:8px;border-radius:50%"></i>${s}</span>`).join("") + `<span><i style="background:var(--accent);height:8px;width:8px;border-radius:50%"></i>Sélection</span>`;
  // filtres annuaire
  const secs = FC.stats(AF, "sector").filter((s) => s.key !== "Non renseigné" && s.funds > 1).map((s) => s.key);
  $("#euCountry").innerHTML = opt(EU_ORDER.filter((c) => AF.some((f) => f.country === c)), "Tous");
  $("#euStage").innerHTML = opt(EU_STAGES.filter((s) => AF.some((f) => f.stage === s)), "Tous");
  $("#euSec").innerHTML = opt(secs, "Tous");
  ["#euQ", "#euCountry", "#euStage", "#euSec", "#euSize", "#euSort", "#euFr", "#euTicket"].forEach((s) => $(s).addEventListener(s === "#euQ" ? "input" : "change", () => { EU.shown = 24; renderEurope(); }));
  $("#euMore").addEventListener("click", () => { EU.shown += 36; renderEurope(); });
  $("#euReset").addEventListener("click", () => { ["#euQ", "#euCountry", "#euStage", "#euSec", "#euSize"].forEach((s) => ($(s).value = "")); $("#euSort").value = "size_desc"; $("#euFr").checked = $("#euTicket").checked = false; EU.shown = 24; renderEurope(); });
  $("#euCsv").addEventListener("click", () => downloadCSV("fonds-europeens", ["Fonds", "Pays", "Stade", "Taille affichée", "Taille (M€)", "Ticket", "Secteurs", "Thèse", "Géographie", "LPs", "Deals France 12 mois", "Dernier deal France"], EU.rows.map((f) => { const a = frActivity(f); return [f.name, f.country, f.stage, f.size_label, f.size_eur_m, f.ticket, (f.sectors || []).join(", "), f.thesis, f.geo_scope, f.lps, a ? a.n12 : 0, a ? a.last : ""]; })));
  // matching
  $("#emStage").innerHTML = EU_STAGES.map((s) => `<option ${s === "Seed" ? "selected" : ""}>${s}</option>`).join("");
  $("#emCountry").innerHTML = EU_ORDER.map((c) => `<option ${c === "France" ? "selected" : ""}>${c}</option>`).join("");
  $("#euMatchForm").addEventListener("submit", (ev) => { ev.preventDefault(); runEuMatch(true); });
  runEuMatch(false);
  renderEurope();
  initEuMap();
  if (hasGsap) gsap.fromTo("#euCountries .bar i", { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "power3.out", stagger: 0.05, delay: 0.3 });
};

function euFiltered() {
  const sz = $("#euSize").value, [lo, hi] = sz ? sz.split("-").map(Number) : [null, null];
  const opts = { text: $("#euQ").value, countries: $("#euCountry").value ? [$("#euCountry").value] : [], stages: $("#euStage").value ? [$("#euStage").value] : [], sectors: $("#euSec").value ? [$("#euSec").value] : [], has_ticket: $("#euTicket").checked, sort: $("#euSort").value === "fr" ? "relevance" : $("#euSort").value };
  let r = FC.search(AF, opts).map((x) => x.fund);
  if (sz) r = r.filter((f) => f.size_eur_m != null && f.size_eur_m >= lo && f.size_eur_m < hi);
  if ($("#euFr").checked) r = r.filter(investsFR);
  if ($("#euSort").value === "fr") r.sort((a, b) => ((frActivity(b) || {}).n12 || 0) - ((frActivity(a) || {}).n12 || 0) || (b.size_eur_m || 0) - (a.size_eur_m || 0));
  return r;
}
function euCard(f) {
  const a = frActivity(f);
  return `<button class="icard ecard${investsFR(f) ? " dep" : ""}" type="button" data-fund="${f.id}">
    <div class="ih">${logo(f.name)}<div style="min-width:0"><div class="nm">${esc(f.name)}</div><div class="ty"><span class="cn">${FC.COUNTRY_CODE[f.country] || ""}</span> ${esc(f.country)} · ${esc(f.stage || "")}</div></div></div>
    <div class="facts"><div><b>${esc(f.size_label || "—")}</b><span>taille affichée</span></div><div><b>${esc(f.ticket ? f.ticket.slice(0, 18) : "—")}</b><span>ticket</span></div><div><b>${a ? a.n12 : 0}</b><span>deals FR 12 mois</span></div></div>
    <p class="th">${esc(f.thesis || "Thèse non publiée")}</p>
    <div>${(f.sectors || []).slice(0, 4).map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div>
    <span class="fr-badge${a ? "" : " zero"}">${a ? `● Dernier deal en France : ${esc(a.last)}` : f.country === "France" ? "Fonds français · aucun deal suivi" : "Aucun deal en France suivi"}</span>
  </button>`;
}
function renderEurope() {
  const r = euFiltered();
  EU.rows = r;
  $("#euCount").textContent = `${r.length} fonds`;
  $("#euGrid").innerHTML = r.slice(0, EU.shown).map(euCard).join("") || `<div class="empty">Aucun fonds pour ces filtres.</div>`;
  $("#euMore").hidden = r.length <= EU.shown;
  const all = r.length === AF.length;
  euMap.hot = all ? null : new Set(r.map((f) => f.id));
  $("#euHud").innerHTML = all ? `${AF.length} fonds · utilisez les filtres pour les mettre en avant` : `<b>${r.length}</b> fonds sélectionnés sur ${AF.length}`;
  if (hasGsap) gsap.fromTo("#euGrid .icard", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.015, ease: "power2.out", clearProps: "transform,opacity" });
}
function runEuMatch(animate) {
  const s = { description: $("#emPitch").value, stage: $("#emStage").value, country: $("#emCountry").value, raise_eur_m: parseFloat($("#emAmt").value) || undefined };
  const res = FC.matchStartup(AF, s, (f) => { const a = frActivity(f); return a ? { n12: a.n12, last: a.last } : null; }).slice(0, 9);
  $("#euMatch").innerHTML = res.map((m) => `<button class="mcard" type="button" data-fund="${m.fund.id}">${logo(m.fund.name, "av sm")}<div style="min-width:0"><div class="nm">${esc(m.fund.name)}</div><div class="meta">${esc(m.fund.country)} · ${esc(m.fund.stage || "")} · ${esc(m.fund.size_label || "")}${m.fund.ticket ? " · ticket " + esc(m.fund.ticket) : ""}</div></div><div class="score" style="--v:${m.score}"><span>${m.score}</span></div><div class="why">↳ ${esc(m.why.slice(0, 4).join(" · "))}</div></button>`).join("") || `<div class="empty">Aucun fonds compatible.</div>`;
  if (animate && hasGsap) gsap.fromTo("#euMatch .mcard", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.05, ease: "power3.out", clearProps: "transform,opacity" });
}

// Carte schématique : un amas de points par pays (taille = taille du fonds, couleur = stade).
const EU_HUBS = { France: [46.6, 1.6], Allemagne: [51.4, 11.6], "Pays-Bas": [53.6, 5.6], Belgique: [50.9, 2.9], Suisse: [46.5, 8.6], Autriche: [47.4, 15.0], Luxembourg: [49.3, 6.6], Irlande: [53.4, -7.4], Monaco: [43.3, 6.9] };
function euProject(lat, lon) {
  const lon0 = -10.5, lon1 = 18.5, lat0 = 42.2, lat1 = 55.6, k = Math.cos((49 * Math.PI) / 180);
  const spanX = (lon1 - lon0) * k, spanY = lat1 - lat0;
  const s = Math.min((euMap.w - 50) / spanX, (euMap.h - 70) / spanY);
  return [(euMap.w - spanX * s) / 2 + (lon - lon0) * k * s, 30 + (euMap.h - 70 - spanY * s) / 2 + (lat1 - lat) * s];
}
function layoutEuMap() {
  const cv = $("#euMap"), r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  if (!r.width) return;
  euMap.w = r.width; euMap.h = r.height;
  cv.width = r.width * dpr; cv.height = r.height * dpr;
  cv.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
  euMap.nodes = []; euMap.hubs = [];
  const spread = Math.max(4.2, Math.min(euMap.w, euMap.h) * 0.0125);
  for (const c of EU_ORDER) {
    const list = AF.filter((f) => f.country === c).sort((a, b) => (b.size_eur_m || 0) - (a.size_eur_m || 0));
    if (!list.length || !EU_HUBS[c]) continue;
    const [hx, hy] = euProject(...EU_HUBS[c]);
    euMap.hubs.push({ c, x: hx, y: hy, n: list.length, R: spread * Math.sqrt(list.length) + 4 });
    list.forEach((f, i) => { const ang = i * 2.39996323, rr = spread * Math.sqrt(i + 0.6); euMap.nodes.push({ f, bx: hx + Math.cos(ang) * rr, by: hy + Math.sin(ang) * rr, x: 0, y: 0, ph: (f.id * 1.7) % 6.28, rad: 1.6 + Math.log10((f.size_eur_m || 10) + 1) * 0.9, glow: 0 }); });
  }
}
function drawEuMap(now) {
  if (current !== "europe") { euMap.running = false; return; }
  const cv = $("#euMap"), ctx = cv.getContext("2d"), t = (now - euMap.t0) / 1000;
  // Palette lue une fois par image (getComputedStyle par point ralentissait toute la page).
  const cs = getComputedStyle(document.documentElement), pv = (v) => cs.getPropertyValue(v).trim();
  const fg = pv("--fg"), muted = pv("--muted"), line = pv("--line"), acc = pv("--accent"), fmono = pv("--f-mono");
  const stageCol = EU_STAGES.map((_, i) => pv("--s" + Math.min(6, i)));
  ctx.clearRect(0, 0, euMap.w, euMap.h);
  ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath();
  for (let lon = -10; lon <= 18; lon += 2) { const [x1, y1] = euProject(55.6, lon), [x2, y2] = euProject(42.2, lon); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
  for (let lat = 43; lat <= 55; lat += 2) { const [x1, y1] = euProject(lat, -10.5), [x2, y2] = euProject(lat, 18.5); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
  ctx.stroke();
  const any = !!euMap.hot;
  for (const n of euMap.nodes) {
    const w = reduce ? 0 : 1;
    n.x = n.bx + Math.cos(t * 0.6 + n.ph) * 1.3 * w; n.y = n.by + Math.sin(t * 0.8 + n.ph) * 1.3 * w;
    const hot = any && euMap.hot.has(n.f.id);
    n.glow += ((hot ? 1 : 0) - n.glow) * 0.1;
    const r = n.rad + n.glow * 1.5;
    if (n.glow > 0.05) { ctx.globalAlpha = 0.2 * n.glow; ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(n.x, n.y, r + 6, 0, 6.283); ctx.fill(); }
    ctx.globalAlpha = any ? 0.22 + n.glow * 0.78 : 0.88;
    ctx.fillStyle = n.glow > 0.3 ? acc : stageCol[Math.max(0, EU_STAGES.indexOf(n.f.stage))];
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.283); ctx.fill();
    if (euMap.hover === n) { ctx.globalAlpha = 1; ctx.strokeStyle = fg; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(n.x, n.y, r + 4, 0, 6.283); ctx.stroke(); }
  }
  ctx.globalAlpha = 1; ctx.font = "500 11px " + fmono;
  for (const h of euMap.hubs) {
    const cc = FC.COUNTRY_CODE[h.c], side = { BE: "l", LU: "r", CH: "r", AT: "r", MC: "r", IE: "b" }[cc];
    const x = side === "l" ? h.x - h.R - 8 : side === "r" ? h.x + h.R + 8 : h.x, y = side === "l" || side === "r" ? h.y - 2 : side === "b" ? h.y + h.R + 10 : h.y - h.R - 16;
    ctx.textAlign = side === "l" ? "right" : side === "r" ? "left" : "center";
    ctx.fillStyle = fg; ctx.fillText(cc, x, y); ctx.fillStyle = muted; ctx.fillText(String(h.n), x, y + 13);
  }
  ctx.textAlign = "left";
  if (reduce) { euMap.running = false; return; }
  requestAnimationFrame(drawEuMap);
}
function startEuMap() { if (euMap.running) return; euMap.running = true; euMap.t0 = euMap.t0 || performance.now(); requestAnimationFrame(drawEuMap); }
function initEuMap() {
  layoutEuMap();
  const cv = $("#euMap");
  const pick = (ev) => { const r = cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top; let best = null, bd = 144; for (const n of euMap.nodes) { const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = n; } } return best; };
  cv.addEventListener("mousemove", (ev) => { const n = pick(ev); euMap.hover = n; cv.style.cursor = n ? "pointer" : "crosshair"; if (n) { const a = frActivity(n.f); showTip(`<b>${esc(n.f.name)}</b><small>${esc(n.f.country)} · ${esc(n.f.stage || "")} · ${esc(n.f.size_label || "")}${a ? " · " + a.n12 + " deals FR / 12 mois" : ""}</small>`, ev.clientX, ev.clientY); } else hideTip(); });
  cv.addEventListener("mouseleave", () => { euMap.hover = null; hideTip(); });
  cv.addEventListener("click", (ev) => { const n = pick(ev); if (n) openDetail({ t: "fund", id: n.f.id, label: n.f.name }); });
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (current === "europe") layoutEuMap(); }, 150); });
  startEuMap();
}

function fundDetail(id) {
  const f = AF.find((x) => String(x.id) === String(id));
  if (!f) return null;
  const a = frActivity(f), e = a ? a.e : fundEnt(f);
  const fr = investsFR(f);
  const sims = FC.matchStartup(AF.filter((x) => x.id !== f.id), { stage: f.stage, sectors: f.sectors, country: f.country, min_score: 0 }).slice(0, 4);
  const deals = e ? e.deals.slice().sort((x, y) => (y.date || "").localeCompare(x.date || "")) : [];
  return `<div><div class="d-title">${logo(f.name)}<div><h2>${esc(f.name)}</h2><div class="d-tags"><span class="pill">${esc(f.country)}</span>${f.stage ? stagePill(f.stage) : ""}${fr ? '<span class="deploy-tag">INVESTIT EN FRANCE</span>' : '<span class="pill">Hors France</span>'}</div></div></div></div>
    ${facts4([[esc(f.size_label || "—"), "taille affichée"], [esc(f.ticket || "—"), "ticket initial"], [a ? a.n12 : 0, "deals FR · 12 mois"], [a ? a.n24 : 0, "deals FR · 24 mois"]])}
    ${vehicleBlock(f, !fr)}
    ${deals.length ? sec(`Activité en France du gestionnaire (${deals.length} deals suivis)`, deals.slice(0, 6).map(lrowDeal).join("") + `<p style="margin-top:10px"><button class="btn" type="button" data-ent="${esc(e.key)}">Fiche investisseur complète : rythme, secteurs, co-investisseurs →</button></p>`) : sec("Activité en France", `<p class="muted" style="font-size:.88rem">Aucune levée française de ce gestionnaire dans Insights depuis 2024.</p>`)}
    ${sims.length ? sec("Fonds comparables", `<div class="matchgrid">${sims.map((m) => `<button class="mcard" type="button" data-fund="${m.fund.id}">${logo(m.fund.name, "av sm")}<div style="min-width:0"><div class="nm">${esc(m.fund.name)}</div><div class="meta">${esc(m.fund.country)} · ${esc(m.fund.stage || "")} · ${esc(m.fund.size_label || "")}</div></div><div class="score" style="--v:${m.score}"><span>${m.score}</span></div></button>`).join("")}</div>`) : ""}`;
}

/* ================= CETTE SEMAINE ================= */
function buildWeek() {
  const wk = D.filter(isNew).sort((a, b) => (b.amount_eur_m || 0) - (a.amount_eur_m || 0));
  const amt = wk.reduce((s, d) => s + (d.amount_eur_m || 0), 0);
  $("#weekRange").textContent = `du ${fmtDay(WEEK_START)} au ${fmtDay(LATEST_DAY)}`;
  if (!wk.length) { $("#weekPanel").hidden = true; return; }
  $("#weekDeals").innerHTML = wk.slice(0, 8).map(lrowDeal).join("") + (wk.length > 8 ? `<p style="margin-top:10px"><button class="linkbtn" type="button" id="weekAll">Voir les ${wk.length} levées de la semaine →</button></p>` : "");
  $("#weekAmt").textContent = fmtAmt(amt);
  $("#weekSub").textContent = `annoncés sur ${wk.length} levée${wk.length > 1 ? "s" : ""}`;
  const secs = Object.entries(wk.reduce((a, d) => ((a[d.sector_raw] = (a[d.sector_raw] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
  const biggest = wk[0];
  $("#weekStats").innerHTML = [[biggest ? esc(biggest.company) : "—", `plus gros tour · ${fmtAmt(biggest && biggest.amount_eur_m)}`], [esc(secs[0] ? secs[0][0] : "—"), "secteur le plus actif"], [fmtAmt(median(wk.map((d) => d.amount_eur_m).filter((v) => v != null))), "ticket médian"]].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");
  const inv = new Map();
  wk.forEach((d) => new Set(d.investors).forEach((i) => { if (!isGeneric(i)) inv.set(i, (inv.get(i) || 0) + 1); }));
  $("#weekInv").innerHTML = [...inv.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([n, k]) => { const e = entFor(n); return e ? `<button class="chip chip-logo" type="button" data-ent="${esc(e.key)}">${logo(n, "av xs")}${esc(n)}${k > 1 ? " · " + k : ""}</button>` : `<span class="chip" style="cursor:default">${esc(n)}</span>`; }).join("") || '<span class="muted">Investisseurs non communiqués</span>';
  const all = $("#weekAll");
  if (all) all.addEventListener("click", () => go("levees", { after: () => { $("#lQ").value = ""; L.week = true; L.page = 1; renderLevees(); } }));
}

/* ================= EXPORT CSV ================= */
function downloadCSV(name, header, rows) {
  const cell = (v) => { const s = v == null ? "" : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${name}-${LATEST_DAY}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(`${rows.length} lignes exportées`);
}
function wireExports() {
  const on = (id, fn) => { const b = $(id); if (b && !b._wired) { b._wired = true; b.addEventListener("click", fn); } };
  on("#lCsv", () => downloadCSV("levees", ["Date", "Startup", "Stade", "Montant (M€)", "Secteur", "Investisseurs", "Pitch"], (L.rows || []).map((d) => [dayKey(d) || d.date, d.company, d.stage_raw, d.amount_eur_m, d.sector_raw, d.investors.join(", "), d.pitch])));
  on("#eCsv", () => downloadCSV("exits", ["Date", "Cible", "Acquéreur", "Type", "Secteur", "Montant (M€)", "Description", "Contexte"], (E.rows || []).map((o) => [o.date, o.target, o.acquirer, o.type, o.sector_raw, o.amount_eur_m, o.description, o.context])));
  on("#fCsv", () => downloadCSV("investisseurs", ["Nom", "Type", "Stades", "Ticket (M€)", "Deals suivis", "Deals 12 mois", "Fonds en déploiement", "Taille", "Focus"], (FS.rows || []).map((e) => [e.name, entType(e), e.ins ? e.ins.stages : "", e.ins ? e.ins.ticket_eur_m : "", e.nb, e.n12, e.veh.map((f) => f.name).join(" | "), e.veh.map((f) => f.size_label).join(" | "), e.ins ? e.ins.focus : ""])));
}

/* ================= THÈME ================= */
(function theme() {
  let saved = null;
  try { saved = localStorage.getItem("ift-theme"); } catch (e) { /* stockage indisponible */ }
  if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
  $("#themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("ift-theme", next); } catch (e) { /* stockage indisponible */ }
  });
})();

/* ================= DÉLÉGATION DES CLICS ================= */
document.addEventListener("click", (ev) => {
  const cp = ev.target.closest("[data-comps]");
  if (cp) { const c = JSON.parse(cp.dataset.comps); closeDetail(); go("comps", { after: () => { $("#cSec").value = c.sec || ""; $("#cStage").value = c.st || ""; $("#cYear").value = ""; $("#cMine").value = c.amt; renderComps(); } }); return; }
  const fd = ev.target.closest("[data-fund]");
  if (fd && !fd.closest(".pal")) { ev.stopPropagation(); const f = AF.find((x) => String(x.id) === fd.dataset.fund); openDetail({ t: "fund", id: fd.dataset.fund, label: f ? f.name : "" }); return; }
  const t = ev.target.closest("[data-ent],[data-startup],[data-op],[data-buyer],[data-go]");
  if (!t) return;
  if (t.closest(".pal")) return;
  if (t.dataset.go) { go(t.dataset.go); return; }
  ev.stopPropagation();
  if (t.dataset.ent) openDetail({ t: "ent", id: t.dataset.ent, label: (ENT.get(t.dataset.ent) || {}).name || t.textContent.trim() });
  else if (t.dataset.startup) openDetail({ t: "startup", id: t.dataset.startup });
  else if (t.dataset.op) { const o = OPS.find((x) => x.id === t.dataset.op); openDetail({ t: "op", id: t.dataset.op, label: o ? o.target : "" }); }
  else if (t.dataset.buyer) openDetail({ t: "buyer", id: t.dataset.buyer, label: (BUY.get(t.dataset.buyer) || {}).name });
}, true);

/* ================= RECHERCHE ⌘K ================= */
const IDX = [];
ENTS.forEach((e) => IDX.push({ g: "Fonds et investisseurs", lg: true, n: e.name, s: `${entType(e)} · ${e.nb} deals${e.veh.length ? " · en déploiement" : ""}`, r: e.n12 ? e.n12 + " / 12 mois" : "", ref: { t: "ent", id: e.key, label: e.name }, k: norm(e.name + " " + e.veh.map((f) => f.name).join(" ")), w: e.nb + (e.veh.length ? 20 : 0) }));
const seenSt = new Set();
D.forEach((d) => { const k = norm(d.company); if (seenSt.has(k)) return; seenSt.add(k); IDX.push({ g: "Startups", n: d.company, s: `${d.sector_raw || ""} · ${d.stage_raw || ""}`, r: fmtAmt(d.amount_eur_m), ref: { t: "startup", id: d.company }, k, w: (d.amount_eur_m || 0) / 10 }); });
ST.forEach((s) => { const k = norm(s.name); if (seenSt.has(k)) return; seenSt.add(k); IDX.push({ g: "Startups", n: s.name, s: s.sector_raw || "", r: fmtAmt(s.total), ref: { t: "startup", id: s.name }, k, w: 0 }); });
BUYERS.forEach((b) => IDX.push({ g: "Acquéreurs", n: b.name, s: `${b.ops.length} opération${b.ops.length > 1 ? "s" : ""}`, r: "", ref: { t: "buyer", id: norm(b.name), label: b.name }, k: norm(b.name), w: b.ops.length }));
AF.forEach((f) => IDX.push({ g: "Fonds européens", lg: true, n: f.name, s: `${f.country} · ${f.stage || ""} · ${f.size_label || ""}`, r: investsFR(f) ? "investit en France" : "", ref: { t: "fund", id: f.id, label: f.name }, k: norm(f.name + " " + (f.thesis || "") + " " + f.country), w: 2 }));
PE.forEach((p, i) => IDX.push({ g: "PE Watch", n: p.target, s: p.funds.join(", "), r: fmtAmt(p.ev_eur_m), ref: { t: "pe", id: i, label: p.target }, k: norm(p.target + " " + p.funds.join(" ")), w: 1 }));
let palSel = 0, palRes = [];
function openPal() { $("#pal").hidden = false; $("#palQ").value = ""; renderPal(); setTimeout(() => $("#palQ").focus(), 0); if (hasGsap) gsap.fromTo(".pal-box", { y: -14, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: "expo.out" }); }
function closePal() { $("#pal").hidden = true; }
function renderPal() {
  const q = norm($("#palQ").value);
  palRes = q ? IDX.filter((x) => x.k.includes(q)).sort((a, b) => (a.k.startsWith(q) ? -1 : 0) - (b.k.startsWith(q) ? -1 : 0) || b.w - a.w).slice(0, 24) : IDX.filter((x) => x.g === "Fonds et investisseurs").sort((a, b) => b.w - a.w).slice(0, 8);
  palSel = 0;
  let g = "";
  $("#palList").innerHTML = palRes.map((x, i) => { const head = x.g !== g ? `<li class="grp">${(g = x.g)}</li>` : ""; return head + `<li class="it" role="option" data-i="${i}" aria-selected="${i === 0}">${x.lg ? logo(x.n) : `<span class="av">${esc(initials(x.n))}</span>`}<div style="min-width:0"><div>${esc(x.n)}</div><div class="sub">${esc(x.s)}</div></div><span class="r">${esc(x.r)}</span></li>`; }).join("") || `<li class="grp">Aucun résultat</li>`;
  $$("#palList .it").forEach((li) => { li.addEventListener("mousemove", () => selPal(+li.dataset.i)); li.addEventListener("click", () => pickPal(+li.dataset.i)); });
}
function selPal(i) { palSel = i; $$("#palList .it").forEach((li) => li.setAttribute("aria-selected", +li.dataset.i === i)); const el = $(`#palList .it[data-i="${i}"]`); el && el.scrollIntoView({ block: "nearest" }); }
function pickPal(i) { const x = palRes[i]; if (!x) return; closePal(); openDetail(x.ref); }
$("#openPal").addEventListener("click", openPal);
$("#palQ").addEventListener("input", renderPal);
$("#pal").addEventListener("click", (e) => { if (e.target.id === "pal") closePal(); });
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#pal").hidden ? openPal() : closePal(); return; }
  if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName) && $("#pal").hidden) { e.preventDefault(); openPal(); return; }
  if (!$("#pal").hidden) {
    if (e.key === "Escape") closePal();
    else if (e.key === "ArrowDown") { e.preventDefault(); selPal(Math.min(palRes.length - 1, palSel + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); selPal(Math.max(0, palSel - 1)); }
    else if (e.key === "Enter") pickPal(palSel);
    return;
  }
  if (e.key === "Escape") closeDetail();
});

/* ================= DÉMARRAGE ================= */
$("#liveInfo").textContent = `Mise à jour hebdo · ${fmtDay(LATEST_DAY)}`;
$("#ct-levees").textContent = nf.format(D.length);
$("#ct-exits").textContent = OPS.length;
$("#ct-fonds").textContent = ENTS.length;
$("#ct-pe").textContent = PE.length;
$("#ct-acq").textContent = BUYERS.length;
$("#ct-europe").textContent = AF.length;
$("#footSrc").innerHTML = `Sources : <a href="${esc(RAW.meta.url)}" target="_blank" rel="noopener">Insights French Tech</a> · données jusqu'au ${fmtDay(LATEST_DAY)}, mises à jour chaque semaine. Montants annoncés, non vérifiés.${(RAW.meta.duplicates_merged || {}).operations || (RAW.meta.duplicates_merged || {}).deals ? ` ${RAW.meta.duplicates_merged.deals + RAW.meta.duplicates_merged.operations} doublons fusionnés automatiquement.` : ""}`;
const start = decodeURIComponent(location.hash.replace("#", ""));
const deep = start.match(/^(fund|ent|startup|op|buyer|pe):(.+)$/);
go(VIEWS.includes(start) ? start : "ov", { silent: true });
if (deep) setTimeout(() => openDetail({ t: deep[1], id: deep[1] === "pe" ? +deep[2] : deep[2] }), 400);
requestAnimationFrame(moveInk);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveInk);
if (hasGsap) {
  gsap.timeline({ defaults: { ease: "expo.out" } })
    .from(".top", { y: -20, opacity: 0, duration: 0.7 })
    .fromTo("#v-" + current + " .reveal", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.06, clearProps: "transform,opacity" }, 0.1);
  setTimeout(() => gsap.globalTimeline.getChildren(true, true, false).forEach((t) => t.progress(1)), 3200);
}
})();
