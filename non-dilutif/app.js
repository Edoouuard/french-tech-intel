/* Dilution Zéro — application (vanilla JS, routage par hash) */
(function () {
  "use strict";
  const D = window.DZ;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const app = $("#app");
  const tip = $("#tip");

  /* ---------------- index & helpers ---------------- */
  const byId = Object.fromEntries(D.dispositifs.map((d) => [d.id, d]));
  const opById = Object.fromEntries(D.fournisseurs.map((o) => [o.id, o]));
  const STADES = Object.keys(D.stades);
  const CATS = Object.keys(D.categories);

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const catColor = (c) => `var(${D.categories[c].color})`;
  const fmtEur = (n) => {
    if (n == null) return "—";
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(".", ",").replace(",0", "") + " Md€";
    if (n >= 1e6) { const v = n / 1e6; return (Number.isInteger(v) ? v : v.toFixed(1).replace(".", ",")) + " M€"; }
    if (n >= 1e3) { const v = n / 1e3; return (Number.isInteger(v) ? v : v.toFixed(0)) + " k€"; }
    return Math.round(n) + " €";
  };
  const fmtFull = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
  const ticket = (d) => {
    if (d.min != null && d.max != null) {
      const a = fmtEur(d.min), b = fmtEur(d.max);
      return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`;
    }
    if (d.max != null) return `≤ ${fmtEur(d.max)}`;
    if (d.min != null) return `≥ ${fmtEur(d.min)}`;
    return "Variable";
  };
  const delaiTxt = (d) => (d.delai[1] === 0 ? "Automatique" : d.delai[0] === d.delai[1] ? `${d.delai[0]} sem.` : `${d.delai[0]}–${d.delai[1]} sem.`);
  const delaiMoy = (d) => (d.delai[0] + d.delai[1]) / 2;
  const effortTxt = (e) => ["", "Léger", "Dossier structuré", "Dossier lourd"][e];
  const catBadge = (c) => `<span class="badge cat" style="background:${catColor(c)}">${esc(D.categories[c].label)}</span>`;
  const stBadge = (s) => `<span class="badge st-${s}" title="${esc(D.statuts[s].desc)}">${esc(D.statuts[s].label)}</span>`;
  const stageDots = (d) => `<span class="stage-dots" title="${d.stades.map((s) => D.stades[s].label).join(", ")}">${STADES.map((s) => `<i class="${d.stades.includes(s) ? "on" : ""}"></i>`).join("")}</span>`;
  const opName = (d) => (opById[d.op] ? opById[d.op].nom : d.op);
  const LOGOS = new Set(D.logos || []);
  const MONOS = { "region-idf": "IDF", "hsbc-ib": "HSBC", bpce: "BP", kreos: "K", atempo: "A", ademe: "AD", isai: "ISAI" };
  const initials = (nom) => nom.replace(/\(.*?\)/g, "").split(/[\s—,'-]+/).filter((w) => w && !/^(de|du|des|la|le|et|pour|d|l|en)$/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const logo = (opId, size = 28) => {
    const o = opById[opId];
    if (!o) return "";
    return LOGOS.has(opId)
      ? `<span class="logo" style="--s:${size}px"><img src="/non-dilutif/img/logos/${opId}.png" alt="" loading="lazy" width="${size}" height="${size}"></span>`
      : `<span class="logo mono" style="--s:${size}px" aria-hidden="true">${esc(MONOS[opId] || initials(o.nom))}</span>`;
  };
  const secteurTxt = (d) => d.secteurs.map((s) => D.secteurs[s]).join(" · ");

  const cumulsOf = (id) =>
    D.cumuls.filter((c) => c[0] === id || c[1] === id).map((c) => ({ other: c[0] === id ? c[1] : c[0], type: c[2], txt: c[3] })).filter((c) => byId[c.other]);
  const CUM_LABEL = { levier: "Effet levier", cumul: "Cumulable", condition: "Sous conditions", exclusif: "Exclusif" };
  const CUM_ICON = { levier: "↗", cumul: "+", condition: "!", exclusif: "×" };

  function showTip(e, html) {
    tip.innerHTML = html;
    tip.style.opacity = 1;
    const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 10);
    const y = e.clientY + 16 + tip.offsetHeight > window.innerHeight ? e.clientY - tip.offsetHeight - 10 : e.clientY + 16;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }
  const hideTip = () => (tip.style.opacity = 0);
  function bindTips(root) {
    if (typeof fixLinks === "function") fixLinks(root);
    $$("[data-tip]", root).forEach((el) => {
      el.addEventListener("mousemove", (e) => showTip(e, el.getAttribute("data-tip")));
      el.addEventListener("mouseleave", hideTip);
    });
  }

  /* ---------------- theme ---------------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };
  const savedTheme = store.get("dz-theme");
  if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
  $("#theme").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    store.set("dz-theme", next);
  });
  $("#releve").textContent = D.meta.releve;

  /* ---------------- router ---------------- */
  // Adresses réelles sous /non-dilutif (section d'Insights French Tech). Les anciens liens « #/… »
  // sont convertis : #/d/<id> → /non-dilutif/aides/<id>, #/op/<id> → /non-dilutif/operateurs/<id>.
  const BASE = "/non-dilutif";
  function toPath(h) {
    if (!h || h[0] !== "#") return h;
    const r = h.replace(/^#\/?/, "");
    const [path, qs] = r.split("?");
    const parts = path.split("/").filter(Boolean);
    if (parts[0] === "d") parts[0] = "aides";
    else if (parts[0] === "op") parts[0] = "operateurs";
    return BASE + (parts.length ? "/" + parts.join("/") : "") + (qs ? "?" + qs : "");
  }
  function rs(h) { try { history.replaceState(null, "", toPath(h)); } catch (e) { /* hôte sans historique */ } }
  function go(h) { const u = toPath(h); try { history.pushState(null, "", u); } catch (e) { location.href = u; return; } onNav(); }
  function parseHash() {
    const path = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : "";
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    if (parts[0] === "aides" && parts[1]) parts[0] = "d";
    else if (parts[0] === "operateurs" && parts[1]) parts[0] = "op";
    const q = Object.fromEntries(new URLSearchParams(location.search));
    return { parts, q };
  }
  // Liens internes : réécrits en vraies adresses (indexables, clic droit possible) et suivis sans rechargement.
  function fixLinks(root) { $$('a[href^="#/"]', root || document).forEach((a) => a.setAttribute("href", toPath(a.getAttribute("href")))); }
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (a.target && a.target !== "_self")) return;
    const href = a.getAttribute("href");
    if (href.startsWith("#/")) { e.preventDefault(); go(href); return; }
    const u = new URL(a.href, location.href);
    if (u.origin === location.origin && (u.pathname === BASE || u.pathname.startsWith(BASE + "/")) && !/\.[a-z0-9]+$/i.test(u.pathname)) { e.preventDefault(); history.pushState(null, "", u.pathname + u.search); onNav(); }
  });
  const routes = { "": pageHome, trouver: pageFinder, explorer: pageExplorer, d: pageDetail, simulateur: pageSim, parcours: pageParcours, cumuls: pageCumuls, operateurs: pageOps, op: pageOp, comparer: pageCompare, methodologie: pageMethod, "venture-debt": pageVD };
  let rendered = false;
  function render() {
    const { parts, q } = parseHash();
    const key = parts[0] || "";
    const fn = routes[key] || pageNotFound;
    hideTip();
    if (unmountWalk) { unmountWalk(); unmountWalk = null; }
    app.className = key === "" ? "home" : "";
    $$("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.r === (key === "d" ? "explorer" : key === "op" ? "operateurs" : key === "comparer" ? "explorer" : key)));
    fn(parts.slice(1), q);
    fixLinks(app);
    // Titre de l'onglet à jour lors de la navigation interne (le serveur le fixe au premier chargement)
    if (rendered) { const h = app.querySelector("h1"); document.title = key && h ? h.textContent.replace(/\s+/g, " ").trim() + " | Dilution Zéro" : "Dilution Zéro : les financements non dilutifs des startups françaises | Insights French Tech"; }
    rendered = true;
    bindTips(app);
    renderCmpBar();
    updateTop();
  }
  function updateTop() {
    const wk = $("#wk");
    const over = !!wk && scrollY < wk.offsetTop + wk.offsetHeight - 90;
    $(".top").classList.toggle("over", over);
  }
  addEventListener("scroll", updateTop, { passive: true });
  let lastRoute = "";
  function onNav() {
    const k = location.pathname;
    render();
    if (k !== lastRoute) window.scrollTo(0, 0);
    lastRoute = k;
  }
  window.addEventListener("popstate", onNav);

  /* ---------------- compare selection ---------------- */
  let cmp = [];
  try { cmp = JSON.parse(store.get("dz-cmp") || "[]").filter((id) => byId[id]); } catch (e) { cmp = []; }
  function toggleCmp(id, on) {
    cmp = cmp.filter((x) => x !== id);
    if (on) cmp.push(id);
    if (cmp.length > 3) cmp = cmp.slice(-3);
    store.set("dz-cmp", JSON.stringify(cmp));
    $$("[data-cmp]").forEach((i) => (i.checked = cmp.includes(i.dataset.cmp)));
    renderCmpBar();
  }
  function renderCmpBar() {
    let bar = $("#cmpbar");
    const { parts } = parseHash();
    if (!cmp.length || parts[0] === "comparer") { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement("div"); bar.id = "cmpbar"; bar.className = "cmpbar"; document.body.appendChild(bar); }
    bar.innerHTML = `<span style="font-size:14px"><b class="num">${cmp.length}</b>/3 à comparer</span>
      <a class="btn" href="#/comparer?ids=${cmp.join(",")}">Comparer</a>
      <button class="btn link" id="cmpclear">Vider</button>`;
    $("#cmpclear").onclick = () => { cmp = []; store.set("dz-cmp", "[]"); $$("[data-cmp]").forEach((i) => (i.checked = false)); renderCmpBar(); };
  }

  /* ================================================================ */
  /* CHARTS (SVG maison)                                              */
  /* ================================================================ */

  // Heatmap stade × catégorie
  function heatmap() {
    const cw = 120, ch = 46, lw = 140, top = 28;
    const counts = CATS.map((c) => STADES.map((s) => D.dispositifs.filter((d) => d.cat === c && d.stades.includes(s)).length));
    const max = Math.max(...counts.flat());
    const W = lw + cw * STADES.length, H = top + ch * CATS.length;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Nombre de dispositifs par stade et par catégorie">`;
    STADES.forEach((st, j) => (s += `<text x="${lw + j * cw + cw / 2}" y="16" text-anchor="middle" class="lbl">${D.stades[st].label}</text>`));
    CATS.forEach((c, i) => {
      s += `<text x="0" y="${top + i * ch + ch / 2 + 4}" class="lbl">${D.categories[c].label}</text>`;
      STADES.forEach((st, j) => {
        const v = counts[i][j];
        const op = v === 0 ? 0.06 : 0.18 + 0.82 * (v / max);
        s += `<a href="#/explorer?cat=${c}&stade=${st}" class="hm-cell" data-tip="<b>${v} dispositif${v > 1 ? "s" : ""}</b>${D.categories[c].label} · ${D.stades[st].label}<br>Cliquer pour explorer">
          <rect x="${lw + j * cw + 3}" y="${top + i * ch + 3}" width="${cw - 6}" height="${ch - 6}" rx="8" fill="${catColor(c)}" fill-opacity="${op}"/>
          <text x="${lw + j * cw + cw / 2}" y="${top + i * ch + ch / 2 + 5}" text-anchor="middle" style="font-family:var(--mono);font-size:14px;font-weight:600;fill:${op > 0.55 ? "var(--paper)" : "var(--ink)"}">${v}</text></a>`;
      });
    });
    return s + "</svg>";
  }

  // Tickets : échelle log
  function ticketChart(list) {
    const rows = list.filter((d) => d.max != null).sort((a, b) => b.max - a.max);
    const lw = 230, rw = 70, rh = 24, top = 24, W = 900;
    const lo = Math.log10(10000), hi = Math.log10(10000000);
    const x = (v) => lw + ((Math.log10(Math.max(v, 10000)) - lo) / (hi - lo)) * (W - lw - rw);
    const H = top + rows.length * rh + 6;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Plafond des dispositifs, échelle logarithmique">`;
    [1e4, 3e4, 1e5, 3e5, 1e6, 3e6, 1e7].forEach((t) => {
      s += `<line x1="${x(t)}" x2="${x(t)}" y1="${top - 6}" y2="${H}" class="grid-l"/><text x="${x(t)}" y="12" text-anchor="middle">${fmtEur(t)}</text>`;
    });
    rows.forEach((d, i) => {
      const y = top + i * rh + rh / 2;
      const c = catColor(d.cat);
      const x0 = d.min != null ? x(d.min) : x(10000);
      const tipTxt = `<b>${esc(d.nom)}</b>${esc(opName(d))}<br>${ticket(d)} · ${esc(D.categories[d.cat].label)}`;
      s += `<a href="#/d/${d.id}" data-tip="${esc(tipTxt)}">
        <rect x="0" y="${y - rh / 2}" width="${W}" height="${rh}" fill="transparent"/>
        <text x="${lw - 12}" y="${y + 4}" text-anchor="end" class="lbl">${esc(d.nom.length > 34 ? d.nom.slice(0, 33) + "…" : d.nom)}</text>
        <line x1="${x0}" x2="${x(d.max)}" y1="${y}" y2="${y}" stroke="${c}" stroke-width="${d.min != null ? 6 : 2}" stroke-linecap="round" ${d.min != null ? "" : 'stroke-dasharray="2 4" stroke-opacity=".6"'}/>
        <circle cx="${x(d.max)}" cy="${y}" r="5.5" fill="${c}"/>
        <text x="${x(d.max) + 10}" y="${y + 4}" style="font-family:var(--mono);fill:var(--ink-2)">${fmtEur(d.max)}</text></a>`;
    });
    return s + "</svg>";
  }

  // Délai × plafond (scatter)
  function scatter() {
    const pts = D.dispositifs.filter((d) => d.max != null && d.delai[1] > 0);
    const W = 560, H = 340, l = 54, r = 16, t = 14, b = 40;
    const lo = Math.log10(20000), hi = Math.log10(6000000);
    const X = (v) => l + (v / 52) * (W - l - r);
    const Y = (v) => t + (1 - (Math.log10(v) - lo) / (hi - lo)) * (H - t - b);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Délai d'obtention et plafond">`;
    [3e4, 1e5, 3e5, 1e6, 3e6].forEach((v) => (s += `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" class="grid-l"/><text x="${l - 8}" y="${Y(v) + 4}" text-anchor="end">${fmtEur(v)}</text>`));
    [0, 13, 26, 39, 52].forEach((v) => (s += `<text x="${X(v)}" y="${H - b + 18}" text-anchor="middle">${v === 0 ? "0" : v + " sem."}</text>`));
    s += `<text x="${(l + W - r) / 2}" y="${H - 4}" text-anchor="middle">Délai moyen entre dépôt et décision →</text>`;
    s += `<rect x="${X(0)}" y="${Y(6000000)}" width="${X(13) - X(0)}" height="${Y(20000) - Y(6000000)}" fill="var(--ok)" fill-opacity=".06"/>`;
    s += `<text x="${X(0) + 6}" y="${Y(6000000) + 14}" style="fill:var(--ok);font-weight:600">Rapide</text>`;
    pts.forEach((d) => {
      const jitter = ((d.id.charCodeAt(0) + d.id.length * 7) % 9) - 4;
      const cx = X(delaiMoy(d)) + jitter * 0.6, cy = Y(d.max) + jitter * 0.4;
      s += `<a href="#/d/${d.id}" data-tip="${esc(`<b>${esc(d.nom)}</b>Jusqu'à ${fmtEur(d.max)} · ${delaiTxt(d)}<br>${effortTxt(d.effort)}${d.selectif ? " · sélectif" : ""}`)}">
        <circle cx="${cx}" cy="${cy}" r="${4 + d.effort * 2}" fill="${catColor(d.cat)}" fill-opacity=".78" stroke="var(--surface)" stroke-width="1.5"/></a>`;
    });
    return s + "</svg>";
  }

  function hbars(items, max, color) {
    return items.map((it) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 2fr 34px;gap:10px;align-items:center;padding:4px 0;font-size:13px">
      <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.href ? `<a href="${it.href}" style="text-decoration:none">${esc(it.label)}</a>` : esc(it.label)}</span>
      <span style="height:10px;background:var(--surface-2);border-radius:5px;overflow:hidden"><span style="display:block;height:100%;width:${(it.v / max) * 100}%;background:${it.color || color};border-radius:5px"></span></span>
      <span class="num" style="text-align:right">${it.v}</span></div>`).join("");
  }


  /* ---------------- Trouver mes aides ---------------- */
  const AGES = [["0", "Moins d'un an", "En création ou tout juste immatriculée"], ["1", "1 à 3 ans", ""], ["2", "3 à 8 ans", ""], ["3", "Plus de 8 ans", ""]];
  const ZONES = [["autre", "Hors Île-de-France", ""], ["idf", "Île-de-France", "Hors Paris"], ["paris", "Paris", ""]];
  const SECT = [["deeptech", "Deeptech ou issue d'un labo", "Verrou technologique, recherche publique"], ["environnement", "Climat et environnement", ""], ["sante", "Santé", ""], ["industrie", "Industrie", "Production physique"], ["numerique", "Numérique", "Logiciel, plateforme, e-commerce"], ["impact", "ESS ou impact", "Agrément ESUS, utilité sociale"]];
  const FIND_DEFAULT = { age: "", stade: "", secteurs: [], besoins: [], zone: "", step: 0 };
  let F;
  try { F = { ...FIND_DEFAULT, ...JSON.parse(store.get("dz-find") || "{}") }; } catch (e) { F = { ...FIND_DEFAULT }; }
  const saveF = () => store.set("dz-find", JSON.stringify(F));

  function findMatch(f) {
    const P = D.profil;
    const age = f.age === "" ? null : Number(f.age);
    const res = { ok: [], later: [], excluded: 0 };
    D.dispositifs.forEach((d) => {
      const why = [], warn = [];
      let fit = true, later = false;
      // stade
      if (f.stade) {
        if (d.stades.includes(f.stade)) why.push(D.stades[f.stade].label);
        else if (STADES.indexOf(d.stades[0]) > STADES.indexOf(f.stade)) { fit = false; later = true; }
        else fit = false;
      }
      // âge
      if (age != null && P.ageMax[d.id] != null) {
        if (age > P.ageMax[d.id]) { fit = false; later = false; }
        else if (P.ageNote[d.id] && age === P.ageMax[d.id]) warn.push(P.ageNote[d.id]);
      }
      // secteur
      if (!d.secteurs.includes("tous")) {
        const hit = d.secteurs.filter((s) => f.secteurs.includes(s));
        if (!hit.length) { fit = false; later = false; }
        else why.push(hit.map((s) => D.secteurs[s]).join(", "));
      }
      // zone
      if (d.geo === "paris" && f.zone && f.zone !== "paris") { fit = false; later = false; }
      if (d.geo === "idf" && f.zone === "autre") { fit = false; later = false; }
      if (d.id === "bft" && f.zone === "paris") { fit = false; later = false; }
      if (d.geo === "regions") warn.push("Selon votre territoire");
      // besoins
      const nb = (P.besoins[d.id] || []).filter((b) => f.besoins.includes(b));
      nb.forEach((b) => why.push(D.besoins[b].label));
      if (P.prerequis[d.id]) warn.push(P.prerequis[d.id]);
      if (d.selectif) warn.push("Sélection sur dossier ou concours");
      const item = { d, why, warn, need: nb.length };
      if (fit) res.ok.push(item);
      else if (later) res.later.push(item);
      else res.excluded++;
    });
    const access = (d) => (d.auto ? 0 : d.selectif ? 2 : 1);
    res.ok.sort((a, b) => b.need - a.need || access(a.d) - access(b.d) || (b.d.max || 0) - (a.d.max || 0));
    res.later.sort((a, b) => STADES.indexOf(a.d.stades[0]) - STADES.indexOf(b.d.stades[0]));
    return res;
  }


  /* ---------------- Explorer ---------------- */
  const SORTS = {
    pertinence: { label: "Pertinence", fn: (a, b) => CATS.indexOf(a.cat) - CATS.indexOf(b.cat) },
    montant: { label: "Plafond ↓", fn: (a, b) => (b.max ?? -1) - (a.max ?? -1) },
    delai: { label: "Délai ↑", fn: (a, b) => delaiMoy(a) - delaiMoy(b) },
    nom: { label: "Nom A→Z", fn: (a, b) => a.nom.localeCompare(b.nom, "fr") },
  };
  function filterList(q) {
    const s = (q.q || "").trim().toLowerCase();
    return D.dispositifs.filter((d) =>
      (!q.cat || d.cat === q.cat) &&
      (!q.stade || d.stades.includes(q.stade)) &&
      (!q.type || d.type === q.type) &&
      (!q.secteur || d.secteurs.includes(q.secteur)) &&
      (!q.geo || d.geo === q.geo) &&
      (!q.statut || d.statut === q.statut) &&
      (!q.acces || (q.acces === "auto" ? d.auto : q.acces === "selectif" ? d.selectif : !d.selectif)) &&
      (!s || `${d.nom} ${opName(d)} ${d.desc} ${d.elig} ${d.forme}`.toLowerCase().includes(s))
    );
  }

  function exportCSV(list) {
    const cols = [["nom", "Dispositif"], ["op", "Opérateur"], ["cat", "Catégorie"], ["forme", "Forme"], ["min", "Montant min (€)"], ["max", "Montant max (€)"], ["couverture", "Couverture"], ["duree", "Durée"], ["stades", "Stades"], ["secteurs", "Secteurs"], ["geo", "Zone"], ["delai", "Délai (sem.)"], ["elig", "Éligibilité"], ["statut", "Statut"], ["url", "Source"]];
    const val = (d, k) => {
      if (k === "op") return opName(d);
      if (k === "cat") return D.categories[d.cat].label;
      if (k === "stades") return d.stades.map((s) => D.stades[s].label).join(" / ");
      if (k === "secteurs") return d.secteurs.map((s) => D.secteurs[s]).join(" / ");
      if (k === "geo") return D.geos[d.geo];
      if (k === "delai") return d.delai.join("-");
      if (k === "statut") return D.statuts[d.statut].label;
      return d[k] ?? "";
    };
    const csv = "﻿" + [cols.map((c) => c[1]).join(";")].concat(list.map((d) => cols.map(([k]) => `"${String(val(d, k)).replace(/"/g, '""')}"`).join(";"))).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "dilution-zero-dispositifs.csv";
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------------- Simulateur ---------------- */
  const SIM_DEFAULT = { age: 0.5,stade: "amorcage", fp: 80000, levee: 0, rd: 250000, msrd: 180000, inno: 60000, arr: 0, deeptech: false, labo: false, green: false, ess: false, zone: "autre", doct: false, aide: false, rdshare: true, exportp: false };
  function simCompute(p) {
    const out = { droits: [], acces: [], concours: [] };
    const push = (b, id, amt, why, lbl) => out[b].push({ id, amt, why, lbl });
    const st = STADES.indexOf(p.stade);
    const young = p.age < 1;

    // --- subventions d'amorçage
    let aideInnovation = p.aide;
    if (young) {
      if (p.deeptech || p.labo) { push("acces", "bfte", 90000, "Entreprise de moins d'un an, projet deeptech : version Emergence de la BFT, jusqu'à 70 % des dépenses."); aideInnovation = true; }
      else if (p.zone === "paris") { push("acces", "pia-paris", null, "À Paris, Paris Innovation Amorçage remplace la Bourse French Tech (montant selon dossier).", "Selon dossier"); aideInnovation = true; }
      else { push("acces", "bft", 30000, "Entreprise de moins d'un an : plafond du catalogue Bpifrance (certains relais citent 50 k€)."); aideInnovation = true; }
    }
    if (p.zone !== "autre" && st <= 1) push("acces", "innovup", null, "Entreprise francilienne avec un projet d'innovation.", "Selon dossier");
    if (p.age < 2 && st === 0) push("acces", "ph-re", 30000, "Fondateur(s) en phase de création : prêt d'honneur médian retenu (fourchette 15–50 k€), apporté en fonds propres.");

    // --- prêts Bpifrance
    const fpTotal = p.fp + (p.age < 2 && st === 0 ? 30000 : 0);
    if (p.age < 5 && st <= 1) {
      if (aideInnovation) {
        const amt = Math.min(Math.max(fpTotal, 0), 100000);
        if (amt >= 50000) push("acces", "pret-amorcage", amt, `Plafonné par vos fonds et quasi-fonds propres (${fmtEur(fpTotal)}, prêt d'honneur inclus) et à 100 k€ (300 k€ avec garantie régionale).`);
        else push("acces", "pret-amorcage", null, `Fonds propres insuffisants (${fmtEur(fpTotal)}) : le minimum est de 50 k€ dans la limite des fonds propres.`, "À débloquer");
      } else push("acces", "pret-amorcage", null, "Prérequis : avoir obtenu une aide à l'innovation (BFT, i-Lab, Région…).", "Prérequis manquant");
    }
    if (p.levee >= 200000 && st >= 1 && st <= 2) push("acces", "pai", Math.min(Math.max(p.levee * 0.5, 100000), 1000000), "Levée ≥ 200 k€ : hypothèse de 50 % du montant levé, entre 100 k€ et 1 M€.");
    if (st >= 1) push("acces", "pret-innovation", Math.min(p.fp * 0.5, 5000000) || null, "Plafonné par les fonds propres ; hypothèse prudente de 50 % des fonds propres, plafond 5 M€.", p.fp ? null : "Selon fonds propres");
    if (p.levee > 0 && st >= 1) push("acces", "pret-bancaire-startup", p.levee * 0.2, "Pratique de marché : ~20 % du dernier tour, avec garantie Bpifrance.");
    if (p.green && st >= 1) push("acces", "pret-vert", null, "Projet de transition écologique : jusqu'à 5 M€ selon le programme.", "≤ 5 M€");
    if (p.exportp && st >= 2) push("acces", "assurance-prospection", null, "Plan de prospection export : avance d'une partie des dépenses.", "Selon budget");

    // --- venture debt / RBF
    if (st >= 2 && p.levee >= 3000000) push("acces", "vd-kreos", p.levee * 0.25, "Levée VC ≥ 3 M€ : ticket de marché de 20 à 35 % du tour (25 % retenu). BSA possibles.");
    if (p.arr >= 100000) push("acces", "rbf-karmen", p.arr * 0.25, "Revenus récurrents : environ 3 mois de revenus (25 % de l'ARR).");

    // --- fiscal
    let exoJei = 0;
    const jeiOk = p.age < 8 && p.rdshare && st <= 2;
    if (jeiOk) {
      exoJei = Math.min(p.msrd * 0.25, 5 * D.meta.pass2026);
      const id = p.labo ? "jeu" : "jei";
      push("droits", id, exoJei, `≈ 25 % de la masse salariale R&D (${fmtEur(p.msrd)}), plafond 5 PASS = ${fmtEur(5 * D.meta.pass2026)} par an.`, null);
    } else if (p.ess && p.age < 8) {
      exoJei = Math.min(p.msrd * 0.25, 5 * D.meta.pass2026);
      push("droits", "jeii", exoJei, "ESS avec 5 à 20 % de R&D : statut JEI à impact.", null);
    }
    const subvRd = out.acces.filter((x) => ["bft", "bfte"].includes(x.id)).reduce((s, x) => s + (x.amt || 0), 0);
    const baseCir = Math.max(p.rd - exoJei - subvRd, 0);
    if (p.rd > 0) push("droits", "cir", baseCir * 0.3, `30 % de ${fmtEur(baseCir)} : vos dépenses R&D, moins l'exonération JEI et les subventions reçues pour ces travaux.`);
    if (p.inno > 0) push("droits", "cii", Math.min(p.inno, 400000) * 0.2, "20 % des dépenses de prototypes, plafonnées à 400 k€ (PME).");
    if (p.doct) push("droits", "cifre", 14000, "14 000 € par an pendant 3 ans pour un doctorant CIFRE (montant annuel retenu).");
    if (p.rd > 0 && st >= 1) push("droits", "prefi-cir", null, "Pour toucher le CIR de l'année en cours sans attendre la déclaration.", "Trésorerie");

    // --- concours
    const il = byId.ilab.stats, inv = byId.inov.stats;
    if ((p.labo || p.deeptech) && p.age < 2) push("concours", "ilab", 600000, `Plafond 600 k€. ${il.edition} : ${Math.round((il.laureats / il.candidats) * 100)} % de lauréats, aide moyenne ${fmtEur(il.enveloppe / il.laureats)}.`);
    if (st >= 1 && st <= 2) push("concours", "inov", inv.enveloppe / inv.laureats, `Aide moyenne par lauréat (${inv.edition}) ; projets de 1 à 5 M€ sur une thématique de vague.`);
    if ((p.deeptech || p.labo) && st >= 1) push("concours", "eic-acc", 2500000, "Partie subvention jusqu'à 2,5 M€ ; sélection en plusieurs étapes.");
    if (p.green && st >= 1) push("concours", "ademe-aap", null, "Appels à projets France 2030 thématiques.", "Selon AAP");
    if (p.green && st >= 2) push("concours", "premiere-usine", null, "Si vous industrialisez en France.", "Selon AAP");
    return out;
  }
  function readSim() {
    const f = $("#simform");
    if (!f) return SIM_DEFAULT;
    const n = (k) => Math.max(0, Number(f.elements[k].value) || 0);
    const b = (k) => f.elements[k].checked;
    return { age: n("age"), stade: f.elements.stade.value, fp: n("fp"), levee: n("levee"), rd: n("rd"), msrd: n("msrd"), inno: n("inno"), arr: n("arr"), deeptech: b("deeptech"), labo: b("labo"), green: b("green"), ess: b("ess"), zone: f.elements.zone.value, doct: b("doct"), aide: b("aide"), rdshare: b("rdshare"), exportp: b("exportp") };
  }

  /* ================================================================ */
  /* GABARITS COMMUNS                                                 */
  /* ================================================================ */
  // Silhouette d'horizon (cyprès, colonnes, rotonde) pour les bandeaux et le pied de page
  function horizon(fill) {
    let cyp = "";
    const pts = [40, 95, 130, 300, 335, 520, 690, 720, 905, 1080, 1115, 1380, 1420, 1540];
    pts.forEach((x, i) => {
      const h = 46 + ((i * 37) % 44);
      cyp += `<path d="M${x},96 C${x - 9},${88 - h * 0.25} ${x - 10},${96 - h * 0.7} ${x - 1},${96 - h} C${x},${94 - h} ${x + 1},${94 - h} ${x + 1},${96 - h} C${x + 10},${96 - h * 0.7} ${x + 9},${88 - h * 0.25} ${x},96Z"/>`;
    });
    const col = (x) => `<rect x="${x - 5}" y="44" width="10" height="52"/><rect x="${x - 8}" y="40" width="16" height="5"/><rect x="${x - 9}" y="90" width="18" height="6"/>`;
    const temple = `<rect x="1196" y="70" width="98" height="26"/><path d="M1200,70 C1202,34 1288,34 1290,70Z"/><rect x="1240" y="26" width="10" height="12"/>`;
    return `<svg class="horizon" viewBox="0 0 1600 110" preserveAspectRatio="xMidYMax slice" aria-hidden="true" style="fill:${fill}">
      <path d="M0,110 L0,94 C200,86 420,98 640,92 C860,86 1080,96 1300,90 C1440,86 1530,92 1600,90 L1600,110Z"/>${cyp}${col(560)}${col(600)}${col(980)}${temple}</svg>`;
  }
  function pageHead({ eyebrow = "", title = "", lead = "", extra = "", actions = "", before = "" }) {
    return `<header class="ph"><div class="wrap">${before}
      ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ""}
      <h1>${title}</h1>${lead ? `<p class="lead">${lead}</p>` : ""}${extra}
      ${actions ? `<div class="actions">${actions}</div>` : ""}</div>${horizon("var(--bg)")}</header>`;
  }
  const tagCat = (c) => `<span class="tag cat" style="background:${catColor(c)}">${esc(D.categories[c].label)}</span>`;
  const tagSt = (s) => `<span class="tag st-${s}" title="${esc(D.statuts[s].desc)}">${esc(D.statuts[s].label)}</span>`;
  const accesTxt = (d) => (d.auto ? "Droit automatique" : d.selectif ? "Sélectif" : "Sur dossier");
  const bindCmp = () => $$("[data-cmp]").forEach((i) => (i.onchange = (e) => toggleCmp(i.dataset.cmp, e.target.checked)));

  function dcard(d, withCmp = true) {
    return `<a class="dcard" href="#/d/${d.id}" style="--cat:${catColor(d.cat)}">
      ${withCmp ? `<label class="cmp-toggle" title="Ajouter au comparateur" onclick="event.stopPropagation()"><span class="sr">Comparer</span><input type="checkbox" data-cmp="${d.id}" ${cmp.includes(d.id) ? "checked" : ""}></label>` : ""}
      <div class="top-l">${logo(d.op, 30)}<span>${esc(opName(d))}</span></div>
      <h3>${esc(d.nom)}</h3>
      <div class="amt">${ticket(d)}</div>
      <p>${esc(d.desc)}</p>
      <div class="meta">${tagCat(d.cat)}${stageDots(d)}<span class="tag">${delaiTxt(d)}</span></div>
    </a>`;
  }
  function lrow(d, extra = "") {
    return `<a class="lrow" href="#/d/${d.id}">${logo(d.op, 44)}
      <div><div class="ln">${esc(d.nom)}</div><div class="lo">${esc(opName(d))} · ${esc(d.forme)}</div>
        <div class="lt">${tagCat(d.cat)}${stageDots(d)}<span class="tag">${delaiTxt(d)}</span>${d.selectif ? '<span class="tag sel">Sélectif</span>' : ""}${tagSt(d.statut)}</div>${extra}</div>
      <div class="la">${ticket(d)}<small>${esc(d.vd && d.vd.critere ? d.vd.critere : accesTxt(d))}</small></div></a>`;
  }

  /* ================================================================ */
  /* ACCUEIL : la promenade                                           */
  /* ================================================================ */
  let unmountWalk = null;
  const STAGE_PICKS = {
    amorcage: ["bft", "jei", "pret-amorcage", "ilab"],
    seed: ["pai", "cir", "inov", "vd-actyus"],
    "serie-a": ["pret-innovation", "eic-acc", "vd-kreos", "vd-wormser"],
    croissance: ["vd-claret", "vd-bei", "pret-croissance", "c3iv"],
  };
  const STAGE_TXT = {
    amorcage: "Les premiers mois sont les plus aidés : bourses, prêts d'honneur, et le statut JEI dès le premier salaire de R&D.",
    seed: "La première levée débloque des prêts adossés aux fonds propres. Les concours France 2030 s'ouvrent.",
    "serie-a": "Les prêteurs privés entrent en jeu. La venture debt allonge la piste entre deux tours.",
    croissance: "Moins de subventions, plus de dette : growth lending, prêts Bpifrance, crédits d'impôt industriels.",
  };

  function pageHome() {
    const N = D.dispositifs.length;
    const nAuto = D.dispositifs.filter((d) => d.auto).length;
    const nVd = D.dispositifs.filter((d) => d.cat === "venture-debt").length;
    const ilab = byId.ilab.stats, inov = byId.inov.stats;
    const sub = STADES.map((s) => D.dispositifs.filter((d) => d.cat === "subvention" && d.stades.includes(s)).length);
    const dette = STADES.map((s) => D.dispositifs.filter((d) => ["pret", "venture-debt", "garantie"].includes(d.cat) && d.stades.includes(s)).length);
    const ROM = ["I", "II", "III", "IV"];
    const pill = (id) => { const d = byId[id]; return d ? `<a class="pill" href="#/d/${id}"><i style="background:${catColor(d.cat)}"></i>${esc(d.nom)}</a>` : ""; };
    const chapters = [
      { id: "intro", a: 0, b: 0.075, label: "Départ" },
      ...STADES.map((s, i) => { const pz = DZWalk.STAGE_Z[i] / DZWalk.Z_END; return { id: s, a: pz - 0.12, b: pz + 0.015, label: D.stades[s].label, i }; }),
      { id: "fin", a: 0.9, b: 1.01, label: "Arrivée" },
    ];

    app.innerHTML = `
      <section class="wk" id="wk" aria-label="Promenade : le parcours de financement d'une startup">
        <div class="wk-stage">
          <div class="wk-scene"></div><div class="wk-grain"></div><div class="wk-vignette"></div>
          <div class="wk-chap intro" data-ch="intro">
            <h1>Financer sa startup <em>sans céder</em> de capital</h1>
            <p>${N} dispositifs non dilutifs, du premier prêt d'honneur à la dette de croissance. Faites quelques pas dans l'allée : chaque colonne est une étape de la vie d'une startup.</p>
            <div class="wk-hint"><span>Avancer</span><i></i></div>
          </div>
          ${STADES.map((s, i) => {
            const n = D.dispositifs.filter((d) => d.stades.includes(s)).length;
            return `<div class="wk-chap" data-ch="${s}"><div class="plaque">
              <div class="roman">COLONNE ${ROM[i]} · ${esc(D.stades[s].mois)}</div>
              <h2>${esc(D.stades[s].label)}</h2>
              <div><span class="big">${n}</span> <span style="font-size:15px;color:#4a5553">dispositifs ouverts</span></div>
              <p>${esc(STAGE_TXT[s])}</p>
              <div class="pills">${STAGE_PICKS[s].map(pill).join("")}</div>
            </div></div>`;
          }).join("")}
          <div class="wk-chap" data-ch="fin"><div class="plaque">
            <div class="roman">LE BELVÉDÈRE</div>
            <h2>Et vous, où en êtes-vous ?</h2>
            <p>Cinq questions suffisent pour trier les ${N} dispositifs et garder ceux qui vous concernent, avec les conditions à vérifier.</p>
            <div class="toolbar"><a class="btn primary" href="#/trouver">Trouver mes aides</a><a class="btn" href="#/explorer">Toute la base</a></div>
          </div></div>
          <nav class="wk-rail" aria-label="Étapes de la promenade">${chapters.map((c) => `<button data-go="${c.a + 0.02}" data-rail="${c.id}"><span>${esc(c.label)}</span><i></i></button>`).join("")}</nav>
        </div>
      </section>

      <div class="wrap">
        <section class="section first">
          <div class="figs">
            <div class="fig"><div class="v">${N}</div><div class="l">dispositifs</div><div class="s">${D.fournisseurs.length} opérateurs publics, européens et privés</div></div>
            <div class="fig"><div class="v">${nAuto}</div><div class="l">droits sans jury</div><div class="s">CIR, CII, JEI : il suffit de remplir les conditions</div></div>
            <div class="fig"><div class="v">${nVd}</div><div class="l">prêteurs privés</div><div class="s">venture debt, growth lending, financement sur revenus</div></div>
            <div class="fig"><div class="v">${D.cumuls.length}</div><div class="l">règles de cumul</div><div class="s">ce qui s'additionne et ce qui s'exclut</div></div>
          </div>
        </section>

        <section class="section">
          <div class="shead"><div><div class="eyebrow">La carte</div><h2>Où se trouve l'argent, stade par stade</h2><p class="sub">Nombre de dispositifs ouverts. Cliquez une case pour voir la liste.</p></div></div>
          <div class="grid g-7-5">
            <div class="panel chart">${heatmap()}</div>
            <div class="panel sky">
              <p class="ptitle">À retenir</p>
              <div style="margin-top:14px;font-size:15.5px;line-height:1.6">
                <p>Les subventions culminent au seed (${sub[1]} dispositifs). En croissance, il en reste ${sub[3]}, face à ${dette[3]} prêts, garanties et lignes de dette.</p>
                <p>La venture debt arrive après une première levée, ou plus tôt chez quelques prêteurs comme Actyus (dès 250 k€).</p>
                <p style="margin:0">i-Lab ${ilab.edition} : ${ilab.laureats} dossiers retenus sur ${ilab.candidats} (${Math.round((ilab.laureats / ilab.candidats) * 100)} %), ${fmtEur(ilab.enveloppe / ilab.laureats)} en moyenne. i-Nov : ${fmtEur(inov.enveloppe / inov.laureats)} par lauréat.</p>
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="callout">
            <div>
              <div class="eyebrow" style="color:#f3d9a8">Trouver mes aides</div>
              <h2>Cinq questions, une liste qui vous ressemble</h2>
              <p>Âge, stade, secteur, besoins, localisation. Le tri écarte ce qui ne vous concerne pas et signale les prérequis.</p>
              <a class="btn primary" href="#/trouver" style="margin-top:6px">Commencer</a>
            </div>
            <div class="art"><img src="/non-dilutif/img/atelier.jpg" alt="Un savant explique des plans à un jeune entrepreneur" loading="lazy" style="object-position:30% 40%"></div>
          </div>
        </section>

        <section class="section">
          <div class="shead"><div><div class="eyebrow">Les montants</div><h2>Combien, et en combien de temps</h2><p class="sub">Plafond publié par dispositif, échelle logarithmique. Trait plein : fourchette connue.</p></div>
            <div class="legend" style="margin:0">${CATS.map((c) => `<span><i style="background:${catColor(c)}"></i>${D.categories[c].label}</span>`).join("")}</div></div>
          <div class="panel chart">${ticketChart(D.dispositifs)}</div>
        </section>

        <section class="section">
          <div class="shead"><div><div class="eyebrow">Les opérateurs</div><h2>Qui finance</h2></div><a class="btn link" href="#/operateurs">Tous les opérateurs</a></div>
          <div class="logowall">${D.fournisseurs.map((o) => `<a href="#/op/${o.id}" title="${esc(o.nom)}">${logo(o.id, 40)}<span>${esc(o.nom.replace(/ \(.*\)$/, ""))}</span></a>`).join("")}</div>
        </section>

        <section class="section">
          <div class="shead"><div><div class="eyebrow">Pour commencer</div><h2>Quatre démarches presque universelles</h2></div><a class="btn link" href="#/parcours">Voir les parcours types</a></div>
          <div class="grid g4">${["jei", "cir", "bft", "pret-amorcage"].map((id) => dcard(byId[id], false)).join("")}</div>
        </section>
      </div>`;

    const sec = $("#wk");
    const chEls = $$(".wk-chap", sec), railEls = $$("[data-rail]", sec);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    unmountWalk = DZWalk.mount(sec, (p) => {
      let cur = null;
      chapters.forEach((c) => { if (p >= c.a && p < c.b) cur = c.id; });
      if (reduce) cur = "intro";
      chEls.forEach((e) => e.classList.toggle("on", e.dataset.ch === cur));
      railEls.forEach((e) => e.classList.toggle("on", e.dataset.rail === cur));
    });
    $$("[data-go]", sec).forEach((b) => (b.onclick = () => {
      const total = sec.offsetHeight - innerHeight;
      window.scrollTo({ top: sec.offsetTop + Number(b.dataset.go) * total, behavior: reduce ? "auto" : "smooth" });
    }));
  }

  /* ================================================================ */
  /* TROUVER MES AIDES                                                */
  /* ================================================================ */
  function pageFinder() {
    const steps = ["Âge", "Stade", "Secteur", "Besoins", "Localisation", "Résultats"];
    const answered = [F.age !== "", !!F.stade, F.secteurs.length > 0, F.besoins.length > 0, !!F.zone];
    const opt = (name, val, t, d, multi) => {
      const on = multi ? F[name].includes(val) : F[name] === val;
      return `<label class="opt ${on ? "on" : ""}"><input type="${multi ? "checkbox" : "radio"}" name="${name}" value="${val}" ${on ? "checked" : ""}><span class="t">${esc(t)}</span>${d ? `<span class="d">${esc(d)}</span>` : ""}</label>`;
    };
    const Q = [
      `<div class="q"><p class="ql">Depuis quand votre société existe-t-elle ?</p><p class="qh">Plusieurs aides d'amorçage sont réservées aux sociétés de moins d'un an.</p><div class="opts">${AGES.map(([v, t, d]) => opt("age", v, t, d)).join("")}</div></div>`,
      `<div class="q"><p class="ql">Où en est votre financement ?</p><p class="qh">Le stade ouvre ou ferme l'accès aux prêts et à la dette.</p><div class="opts">${STADES.map((s) => opt("stade", s, D.stades[s].label, D.stades[s].hint)).join("")}</div></div>`,
      `<div class="q"><p class="ql">Dans quel domaine travaillez-vous ?</p><p class="qh">Plusieurs choix possibles. Si rien ne s'applique, passez : vous verrez les dispositifs ouverts à tous.</p><div class="opts">${SECT.map(([v, t, d]) => opt("secteurs", v, t, d, true)).join("")}</div></div>`,
      `<div class="q"><p class="ql">Que voulez-vous financer ?</p><p class="qh">Plusieurs choix possibles. Ce qui couvre vos besoins remonte en tête.</p><div class="opts">${Object.entries(D.besoins).map(([v, b]) => opt("besoins", v, b.label, b.desc, true)).join("")}</div></div>`,
      `<div class="q"><p class="ql">Où êtes-vous installé ?</p><p class="qh">Certaines aides sont propres à Paris ou à l'Île-de-France.</p><div class="opts">${ZONES.map(([v, t, d]) => opt("zone", v, t, d)).join("")}</div></div>`,
    ];
    const r = findMatch(F);
    const step = Math.min(F.step, 5);
    const primary = r.ok.filter((m) => m.need > 0 || !F.besoins.length);
    const other = F.besoins.length ? r.ok.filter((m) => m.need === 0) : [];
    const row = (m) => lrow(m.d, `<div class="why">${m.why.map((w) => `<span>${esc(w)}</span>`).join("")}${m.warn.map((w) => `<span class="w">${esc(w)}</span>`).join("")}</div>`);

    const nav = `<div class="steps" role="tablist">${steps.map((s, i) => `<button role="tab" data-step="${i}" class="${i === step ? "on" : ""} ${i < 5 && answered[i] ? "done" : ""}"><b>${i < 5 ? (answered[i] ? "✓" : i + 1) : "→"}</b>${s}</button>`).join("")}</div>`;
    const live = `<div class="panel sky live">
        <div class="eyebrow" style="color:#f3d9a8">En direct</div>
        <div class="big" style="margin:10px 0 2px">${r.ok.length}</div>
        <p class="sub" style="margin-bottom:16px">dispositifs correspondent à vos réponses</p>
        <div class="stack">${CATS.map((c) => { const n = r.ok.filter((m) => m.d.cat === c).length; return n ? `<div style="width:${(n / Math.max(r.ok.length, 1)) * 100}%;background:${catColor(c)}" data-tip="<b>${D.categories[c].label}</b>${n}"></div>` : ""; }).join("")}</div>
        <div style="margin-top:16px">${primary.slice(0, 6).map((m) => `<a class="mini" href="#/d/${m.d.id}">${logo(m.d.op, 22)}<span>${esc(m.d.nom)}</span><span class="a">${m.d.max ? fmtEur(m.d.max) : ""}</span></a>`).join("")}</div>
        <div class="toolbar" style="margin-top:18px"><button class="btn primary" data-step="5">Voir toute la liste</button><button class="btn light" id="freset">Recommencer</button></div>
      </div>`;
    const results = `
      <div class="xbar" style="margin-top:0"><div class="count-line"><b>${r.ok.length}</b> dispositifs pour votre profil${F.besoins.length ? `, dont ${primary.length} sur vos besoins` : ""} · ${r.later.length} pour plus tard</div>
        <div class="toolbar"><a class="btn sm" href="#/simulateur">Chiffrer les montants</a><button class="btn sm" id="fcsv">Exporter</button><button class="btn sm" onclick="window.print()">Imprimer</button></div></div>
      <div class="group-h"><h2 style="font-size:34px">${F.besoins.length ? "Pour vos besoins" : "Accessibles maintenant"}</h2><span class="num muted">${primary.length}</span></div>
      <div class="ledger">${primary.length ? primary.map(row).join("") : `<p class="muted" style="padding:18px 0">Aucun dispositif ne couvre directement ces besoins à ce stade.</p>`}</div>
      ${other.length ? `<div class="group-h"><h2 style="font-size:34px">Également accessibles</h2><span class="num muted">${other.length}</span></div><div class="ledger">${other.map(row).join("")}</div>` : ""}
      ${r.later.length ? `<div class="group-h"><h2 style="font-size:34px">Plus tard</h2><span class="num muted">${r.later.length}</span></div><p class="sub" style="margin-bottom:12px">Ouverts à partir d'un stade plus avancé.</p><div class="pills">${r.later.map((m) => `<a class="pill" href="#/d/${m.d.id}"><i style="background:${catColor(m.d.cat)}"></i>${esc(m.d.nom)} <span class="muted">· ${D.stades[m.d.stades[0]].label}</span></a>`).join("")}</div>` : ""}
      <p class="sub" style="margin-top:28px;font-size:13px">${r.excluded} dispositifs écartés (âge, secteur ou zone). Il s'agit d'une éligibilité probable, pas d'un droit acquis : vérifiez les conditions auprès de l'opérateur.</p>`;

    app.innerHTML = pageHead({ eyebrow: "Trouver mes aides", title: "Les dispositifs faits pour <em>votre</em> entreprise", lead: "Répondez à cinq questions. La liste se met à jour à chaque réponse, et vous pouvez revenir en arrière à tout moment." }) +
      `<div class="wrap">${nav}
        ${step < 5
          ? `<div class="grid g-7-5" style="gap:40px;align-items:start"><div>${Q[step]}
              <div class="toolbar" style="margin-top:26px">${step > 0 ? `<button class="btn" data-step="${step - 1}">Précédent</button>` : ""}<button class="btn primary" data-step="${step + 1}">${step === 4 ? "Voir mes résultats" : "Suivant"}</button></div></div>${live}</div>`
          : results}
      </div>`;

    $$(".opt input").forEach((i) => (i.onchange = () => {
      const n = i.name;
      if (Array.isArray(F[n])) F[n] = $$(`.opt input[name="${n}"]:checked`).map((x) => x.value);
      else { F[n] = i.value; if (F.step < 4) F.step++; }
      saveF(); const y = scrollY; pageFinder(); bindTips(app); scrollTo(0, y);
    }));
    $$("[data-step]").forEach((b) => (b.onclick = () => { F.step = Number(b.dataset.step); saveF(); pageFinder(); bindTips(app); const s = $(".steps"); if (s) scrollTo({ top: Math.max(0, s.getBoundingClientRect().top + scrollY - 120) }); }));
    const rsBtn = $("#freset"); if (rsBtn) rsBtn.onclick = () => { F = { ...FIND_DEFAULT, secteurs: [], besoins: [] }; saveF(); pageFinder(); bindTips(app); };
    const cs = $("#fcsv"); if (cs) cs.onclick = () => exportCSV(r.ok.map((m) => m.d));
  }

  /* ================================================================ */
  /* EXPLORER                                                         */
  /* ================================================================ */
  function setQ(q) {
    const clean = Object.fromEntries(Object.entries(q).filter(([, v]) => v));
    const qs = new URLSearchParams(clean).toString();
    rs("#/explorer" + (qs ? "?" + qs : ""));
    pageExplorer([], clean, true);
    bindTips(app);
  }
  let filtersOpen = false;
  function pageExplorer(_, q, partial) {
    const list = filterList(q).sort(SORTS[q.sort || "pertinence"].fn);
    const view = q.view || "registre";
    const group = (key, label, opts) => `<div class="fgroup"><h4>${label}</h4>
      <button class="fopt ${!q[key] ? "on" : ""}" data-k="${key}" data-v=""><span class="box"></span>Tous</button>
      ${opts.map(([v, l, dot]) => `<button class="fopt ${q[key] === v ? "on" : ""}" data-k="${key}" data-v="${v}"><span class="box"></span>${dot ? `<span class="dot" style="background:${dot}"></span>` : ""}${esc(l)}<span class="ct">${filterList({ ...q, [key]: v }).length}</span></button>`).join("")}</div>`;
    const aside = `<aside class="${filtersOpen ? "open" : ""}" aria-label="Filtres">
      ${group("cat", "Catégorie", CATS.map((c) => [c, D.categories[c].label, catColor(c)]))}
      ${group("stade", "Stade", STADES.map((s) => [s, D.stades[s].label]))}
      ${group("secteur", "Secteur", Object.keys(D.secteurs).filter((s) => s !== "tous").map((s) => [s, D.secteurs[s]]))}
      ${group("type", "Opérateur", Object.keys(D.typesOperateur).map((t) => [t, D.typesOperateur[t]]))}
      ${group("acces", "Accès", [["auto", "Droit automatique"], ["ouvert", "Sur dossier"], ["selectif", "Sélectif"]])}
      ${group("statut", "Fiabilité", Object.keys(D.statuts).map((s) => [s, D.statuts[s].label]))}
      ${Object.keys(q).some((k) => !["sort", "view"].includes(k)) ? `<button class="btn sm" id="reset" style="margin-top:16px">Tout effacer</button>` : ""}
    </aside>`;
    const results = !list.length
      ? `<div class="empty">Aucun dispositif ne correspond.<br>Élargissez un filtre ou effacez la recherche.</div>`
      : view === "tableau"
        ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:30px"></th><th>Dispositif</th><th>Catégorie</th><th><button data-sort="montant">Plafond ↓</button></th><th>Stades</th><th><button data-sort="delai">Délai ↑</button></th><th>Accès</th><th>Fiabilité</th></tr></thead><tbody>
            ${list.map((d) => `<tr><td><input type="checkbox" data-cmp="${d.id}" ${cmp.includes(d.id) ? "checked" : ""} aria-label="Comparer ${esc(d.nom)}" style="accent-color:var(--terra)"></td>
              <td class="name"><div style="display:flex;gap:12px;align-items:center">${logo(d.op, 32)}<div><a href="#/d/${d.id}">${esc(d.nom)}</a><span class="op">${esc(opName(d))}</span></div></div></td>
              <td>${tagCat(d.cat)}</td><td class="num" style="white-space:nowrap">${ticket(d)}</td><td>${stageDots(d)}</td><td class="num" style="white-space:nowrap">${delaiTxt(d)}</td><td style="white-space:nowrap">${accesTxt(d)}</td><td>${tagSt(d.statut)}</td></tr>`).join("")}
          </tbody></table></div>`
        : view === "cartes" ? `<div class="grid g2">${list.map((d) => dcard(d)).join("")}</div>`
          : `<div class="ledger">${list.map((d) => lrow(d)).join("")}</div>`;

    const body = `<div class="xp">${aside}<div>
        <label class="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span class="sr">Rechercher</span>
          <input id="q" type="search" placeholder="Nom, opérateur, critère : doctorant, export, ARR…" value="${esc(q.q || "")}"></label>
        <div class="xbar"><div class="count-line"><b>${list.length}</b> dispositif${list.length > 1 ? "s" : ""}</div>
          <div class="toolbar"><button class="btn sm ftoggle" id="ftog">Filtres</button>
            <select id="sort" class="sel" aria-label="Trier">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${(q.sort || "pertinence") === k ? "selected" : ""}>${v.label}</option>`).join("")}</select>
            <div class="seg" role="group" aria-label="Affichage">${[["registre", "Liste"], ["cartes", "Cartes"], ["tableau", "Tableau"]].map(([v, l]) => `<button data-view="${v}" class="${view === v ? "on" : ""}">${l}</button>`).join("")}</div>
            <button class="btn sm" id="csv">Exporter</button></div></div>
        ${results}</div></div>`;

    if (partial) {
      const qEl = $("#q"); const pos = qEl ? qEl.selectionStart : null; const had = document.activeElement === qEl;
      $("#xpbody").innerHTML = body;
      if (had) { const n = $("#q"); n.focus(); n.setSelectionRange(pos, pos); }
    } else {
      app.innerHTML = pageHead({ eyebrow: "Explorer", title: "Toute la base", lead: `${D.dispositifs.length} dispositifs, ${D.fournisseurs.length} opérateurs. Filtrez librement, ou laissez-vous guider par <a href="#/trouver" style="color:#f3d9a8">Trouver mes aides</a>.` }) + `<div class="wrap" id="xpbody" style="margin-top:36px">${body}</div>`;
    }
    $$(".fopt[data-k]").forEach((b) => (b.onclick = () => setQ({ ...q, [b.dataset.k]: b.dataset.v })));
    let t;
    $("#q").oninput = (e) => { clearTimeout(t); const v = e.target.value; t = setTimeout(() => setQ({ ...q, q: v }), 160); };
    $("#sort").onchange = (e) => setQ({ ...q, sort: e.target.value });
    $$("[data-view]").forEach((b) => (b.onclick = () => setQ({ ...q, view: b.dataset.view })));
    $$("[data-sort]").forEach((b) => (b.onclick = () => setQ({ ...q, sort: b.dataset.sort })));
    const r = $("#reset"); if (r) r.onclick = () => setQ({ view: q.view, sort: q.sort });
    $("#ftog").onclick = () => { filtersOpen = !filtersOpen; $(".xp aside").classList.toggle("open", filtersOpen); };
    $("#csv").onclick = () => exportCSV(list);
    bindCmp();
  }

  /* ================================================================ */
  /* FICHE                                                            */
  /* ================================================================ */
  function pageDetail([id]) {
    const d = byId[id];
    if (!d) return pageNotFound();
    const op = opById[d.op];
    const order = ["levier", "cumul", "condition", "exclusif"];
    const cums = cumulsOf(d.id).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    const alts = D.dispositifs.filter((x) => x.id !== d.id && x.cat === d.cat && x.stades.some((s) => d.stades.includes(s)))
      .map((x) => ({ x, sc: x.stades.filter((s) => d.stades.includes(s)).length + x.secteurs.filter((s) => d.secteurs.includes(s)).length }))
      .sort((a, b) => b.sc - a.sc).slice(0, 4).map((o) => o.x);
    const inParcours = D.parcours.filter((p) => p.etapes.some((e) => e.items.includes(d.id)));
    const st = d.stats;
    app.innerHTML = pageHead({
      before: `<div class="crumbs"><a href="#/explorer">Explorer</a><span>/</span><a href="#/explorer?cat=${d.cat}">${D.categories[d.cat].label}</a></div>`,
      eyebrow: `<span style="display:inline-flex;gap:10px;align-items:center;margin-top:18px">${logo(d.op, 30)}${esc(opName(d))}</span>`,
      title: esc(d.nom), lead: esc(d.desc),
      extra: `<div class="tagrow"><span class="tag">${esc(d.forme)}</span><span class="tag">${accesTxt(d)}</span>${tagSt(d.statut)}${d.cat === "venture-debt" ? '<a class="tag" href="#/venture-debt">Le marché de la venture debt →</a>' : ""}</div>`,
    }) + `<div class="wrap"><div class="dt">
      <div style="padding-top:36px">
        <section><div class="eyebrow">Éligibilité</div><div class="prose" style="margin-top:10px"><p style="font-size:19px;color:var(--ink)">${esc(d.elig)}</p>${d.vd && d.vd.critere ? `<p><b>Critère d'entrée :</b> ${esc(d.vd.critere)}</p>` : ""}${d.levier ? `<p><b>Effet levier :</b> ${esc(d.levier)}</p>` : ""}</div>${d.note ? `<div class="note">${esc(d.note)}</div>` : ""}</section>
        ${st ? `<section class="section" style="margin-top:48px"><div class="eyebrow">Sélectivité, ${esc(st.edition)}</div><div class="figs" style="margin-top:14px;grid-template-columns:repeat(3,1fr)">
            <div class="fig"><div class="v" style="font-size:52px">${st.candidats ? Math.round((st.laureats / st.candidats) * 100) + " %" : st.laureats}</div><div class="s">${st.candidats ? `de succès (${st.laureats}/${st.candidats})` : esc(st.unite || "lauréats")}</div></div>
            <div class="fig"><div class="v" style="font-size:52px">${fmtEur(st.enveloppe)}</div><div class="s">au total</div></div>
            <div class="fig"><div class="v" style="font-size:52px">${fmtEur(st.enveloppe / st.laureats)}</div><div class="s">${st.unite ? "ticket moyen" : "par lauréat"}</div></div></div></section>` : ""}
        <section class="section" style="margin-top:56px"><div class="eyebrow">Se combine avec</div><h3 style="margin-top:6px">${cums.length ? `${cums.length} règle${cums.length > 1 ? "s" : ""} de cumul` : "Aucune règle documentée"}</h3>
          <div style="margin-top:14px">${cums.map((c) => `<a class="rel" href="#/d/${c.other}"><span class="cum-ic cum-${c.type}" title="${CUM_LABEL[c.type]}">${CUM_ICON[c.type]}</span><span><span class="rn">${esc(byId[c.other].nom)}</span> <span class="tag" style="margin-left:4px">${CUM_LABEL[c.type]}</span><br><span class="rt">${esc(c.txt)}</span></span></a>`).join("")}</div></section>
        ${inParcours.length ? `<section class="section" style="margin-top:56px"><div class="eyebrow">Dans les parcours types</div><div style="margin-top:14px">${inParcours.map((p) => { const e = p.etapes.find((x) => x.items.includes(d.id)); return `<a class="rel" href="#/parcours?p=${p.id}"><span class="cum-ic" style="background:var(--terra);width:40px;border-radius:999px;font-size:11px">${e.mois}</span><span><span class="rn">${esc(p.titre)}</span><br><span class="rt">${esc(e.txt)}</span></span></a>`; }).join("")}</div></section>` : ""}
        ${alts.length ? `<section class="section" style="margin-top:56px"><div class="eyebrow">À regarder aussi</div><div class="ledger" style="margin-top:14px">${alts.map((x) => lrow(x)).join("")}</div></section>` : ""}
      </div>
      <aside><div class="panel" style="box-shadow:0 24px 50px -30px rgba(20,40,40,.5)">
        <div class="eyebrow" style="color:var(--ink-3)">Montant</div>
        <div class="amount-xl" style="margin:6px 0 18px">${ticket(d)}</div>
        <div class="facts">
          <div class="fact"><span class="k">Couverture</span><span class="v">${esc(d.couverture)}</span></div>
          <div class="fact"><span class="k">Durée</span><span class="v">${esc(d.duree)}</span></div>
          <div class="fact"><span class="k">Délai</span><span class="v">${delaiTxt(d)}</span></div>
          <div class="fact"><span class="k">Dossier</span><span class="v">${effortTxt(d.effort)}</span></div>
          <div class="fact"><span class="k">Stades</span><span class="v">${d.stades.map((s) => D.stades[s].label).join(", ")}</span></div>
          <div class="fact"><span class="k">Secteurs</span><span class="v">${esc(secteurTxt(d))}</span></div>
          <div class="fact"><span class="k">Zone</span><span class="v">${esc(D.geos[d.geo])}</span></div>
          ${d.vd ? `<div class="fact"><span class="k">Warrants</span><span class="v">${d.vd.bsa === true ? "Oui" : d.vd.bsa === false ? "Non" : "Selon dossier"}</span></div>` : ""}
        </div>
        <div class="toolbar" style="margin-top:20px"><a class="btn primary" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">Page officielle ↗</a>
          <label class="btn" style="cursor:pointer"><input type="checkbox" data-cmp="${d.id}" ${cmp.includes(d.id) ? "checked" : ""} style="accent-color:var(--terra)"> Comparer</label></div>
        <div class="hr"></div>
        <a href="#/op/${d.op}" style="display:flex;gap:12px;align-items:center;text-decoration:none">${logo(d.op, 40)}<span><b>${esc(op ? op.nom : d.op)}</b><br><span class="muted" style="font-size:13px">${esc(op ? D.typesFournisseur[op.type] : "")}</span></span></a>
        <p class="muted" style="font-size:12.5px;margin:16px 0 0">Source : ${esc(d.source)} · relevé ${esc(D.meta.releve.toLowerCase())}. ${esc(D.statuts[d.statut].desc)}.</p>
      </div></aside>
    </div></div>`;
    bindCmp();
  }

  /* ================================================================ */
  /* COMPARER                                                         */
  /* ================================================================ */
  function pageCompare(_, q) {
    const ids = (q.ids || "").split(",").filter((id) => byId[id]);
    if (!ids.length) {
      app.innerHTML = pageHead({ eyebrow: "Comparateur", title: "Rien à comparer", lead: "Cochez jusqu'à trois dispositifs dans l'explorateur." }) + `<div class="wrap" style="margin-top:36px"><a class="btn primary" href="#/explorer?view=cartes">Aller à l'explorateur</a></div>`;
      return;
    }
    const L = ids.map((id) => byId[id]);
    const rows = [
      ["Montant", (d) => `<span style="font-family:var(--serif);font-size:30px;color:var(--sky)">${ticket(d)}</span>`], ["Catégorie", (d) => tagCat(d.cat)], ["Forme", (d) => esc(d.forme)],
      ["Couverture", (d) => esc(d.couverture)], ["Durée", (d) => esc(d.duree)], ["Stades", (d) => d.stades.map((s) => D.stades[s].label).join(", ")],
      ["Secteurs", (d) => esc(secteurTxt(d))], ["Délai", (d) => delaiTxt(d)], ["Dossier", (d) => effortTxt(d.effort)], ["Accès", (d) => accesTxt(d)],
      ["Éligibilité", (d) => `<span style="font-size:14px">${esc(d.elig)}</span>`], ["Fiabilité", (d) => tagSt(d.statut)],
    ];
    const pairs = [];
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const c = D.cumuls.find((x) => (x[0] === L[i].id && x[1] === L[j].id) || (x[1] === L[i].id && x[0] === L[j].id));
      pairs.push({ a: L[i], b: L[j], c });
    }
    app.innerHTML = pageHead({ eyebrow: "Comparateur", title: `${L.length} dispositifs côte à côte` }) + `<div class="wrap" style="margin-top:36px">
      <div class="tbl-wrap"><table class="tbl" style="min-width:${200 + L.length * 250}px"><thead><tr><th></th>${L.map((d) => `<th style="text-transform:none;letter-spacing:0;font-size:15px;color:var(--ink)"><div style="display:flex;gap:10px;align-items:center">${logo(d.op, 30)}<a href="#/d/${d.id}" style="text-decoration:none;font-family:var(--serif);font-size:22px;font-weight:400">${esc(d.nom)}</a><button class="btn link" data-rm="${d.id}" aria-label="Retirer">×</button></div></th>`).join("")}</tr></thead>
      <tbody>${rows.map(([k, f]) => `<tr><td class="muted" style="white-space:nowrap;font-size:13px">${k}</td>${L.map((d) => `<td>${f(d)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      ${pairs.length ? `<div class="panel" style="margin-top:28px"><p class="ptitle">Peut-on les cumuler ?</p><div style="margin-top:14px">${pairs.map((p) => `<div class="rel">${p.c ? `<span class="cum-ic cum-${p.c[2]}">${CUM_ICON[p.c[2]]}</span>` : `<span class="cum-ic" style="background:var(--line-2)">?</span>`}<span><span class="rn">${esc(p.a.nom)} + ${esc(p.b.nom)}</span><br><span class="rt">${p.c ? `${CUM_LABEL[p.c[2]]}. ${esc(p.c[3])}` : "Pas de règle documentée : cumul possible en principe, dans la limite des plafonds d'aides d'État."}</span></span></div>`).join("")}</div></div>` : ""}</div>`;
    $$("[data-rm]").forEach((b) => (b.onclick = () => { toggleCmp(b.dataset.rm, false); go("#/comparer?ids=" + cmp.join(",")); }));
  }

  /* ================================================================ */
  /* SIMULATEUR                                                       */
  /* ================================================================ */
  function pageSim() {
    let p = SIM_DEFAULT;
    try { p = { ...SIM_DEFAULT, ...JSON.parse(store.get("dz-sim") || "{}") }; } catch (e) { /* défaut */ }
    const num = (k, label, hint, step = 1000) => `<div class="field"><label for="f-${k}">${label}</label><input id="f-${k}" name="${k}" type="number" min="0" step="${step}" value="${p[k]}" inputmode="numeric">${hint ? `<div class="hint">${hint}</div>` : ""}</div>`;
    const chk = (k, label) => `<label class="check"><input type="checkbox" name="${k}" ${p[k] ? "checked" : ""}> <span>${label}</span></label>`;
    app.innerHTML = pageHead({ eyebrow: "Chiffrer", title: "Combien obtenir <em>sans diluer</em> ?", lead: "Renseignez vos chiffres : le calcul additionne crédits d'impôt, prêts adossés à vos fonds propres et concours, et indique la règle appliquée à chaque ligne." }) + `
      <div class="wrap" style="margin-top:36px"><div class="sim">
        <form id="simform" class="panel" onsubmit="return false">
          <div class="field-row">
            <div class="field"><label for="f-age">Âge (années)</label><input id="f-age" name="age" type="number" min="0" max="20" step="0.5" value="${p.age}"></div>
            <div class="field"><label for="f-stade">Stade</label><select id="f-stade" name="stade">${STADES.map((s) => `<option value="${s}" ${p.stade === s ? "selected" : ""}>${D.stades[s].label}</option>`).join("")}</select></div>
          </div>
          <div class="field"><label for="f-zone">Localisation</label><select id="f-zone" name="zone"><option value="autre" ${p.zone === "autre" ? "selected" : ""}>Hors Île-de-France</option><option value="idf" ${p.zone === "idf" ? "selected" : ""}>Île-de-France, hors Paris</option><option value="paris" ${p.zone === "paris" ? "selected" : ""}>Paris</option></select></div>
          <div class="hr"></div>
          ${num("fp", "Fonds propres et quasi-fonds propres (€)", "Capital, apports, BSA-AIR, prêts d'honneur")}
          ${num("levee", "Dernière levée (€)", "0 si pas encore levé", 10000)}
          ${num("arr", "Revenus récurrents annuels (€)", null, 10000)}
          <div class="hr"></div>
          ${num("rd", "Dépenses de R&D annuelles (€)", "Salaires chargés, sous-traitance, fonctionnement", 10000)}
          ${num("msrd", "dont masse salariale brute R&D (€)", null, 10000)}
          ${num("inno", "Dépenses de prototypes (€)", "Assiette du CII, hors R&D", 10000)}
          <div class="hr"></div>
          ${chk("rdshare", "R&D ≥ 20 % de nos charges")}${chk("aide", "Aide à l'innovation déjà obtenue")}${chk("deeptech", "Projet deeptech")}${chk("labo", "Issu d'un laboratoire")}${chk("doct", "Recrutement d'un doctorant")}${chk("green", "Climat, environnement, industrie verte")}${chk("ess", "ESS ou agrément ESUS")}${chk("exportp", "Prospection à l'international")}
          <button type="button" class="btn link" id="simreset" style="margin-top:10px">Réinitialiser</button>
        </form>
        <div id="simout"></div>
      </div></div>`;
    const f = $("#simform");
    const update = () => { const v = readSim(); store.set("dz-sim", JSON.stringify(v)); renderSimOut(v); };
    f.addEventListener("input", update);
    f.addEventListener("change", update);
    $("#simreset").onclick = () => { store.set("dz-sim", "{}"); pageSim(); bindTips(app); };
    renderSimOut(readSim());
  }
  function renderSimOut(p) {
    const r = simCompute(p);
    const sum = (arr) => arr.reduce((s, x) => s + (x.amt || 0), 0);
    const sD = sum(r.droits), sA = sum(r.acces), sC = sum(r.concours);
    const real = sD + sA;
    const ratio = p.fp + p.levee > 0 ? real / Math.max(p.fp, p.levee, 1) : null;
    const line = (x) => `<div class="bline"><a href="#/d/${x.id}">${esc(byId[x.id].nom)}</a><span class="amt">${x.amt != null ? fmtEur(x.amt) : `<span class="muted" style="font-size:13px">${esc(x.lbl || "—")}</span>`}</span><div class="why">${esc(x.why)}</div></div>`;
    const bucket = (title, sub, arr, color, total) => `<div class="bucket"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><div><h3 style="display:flex;align-items:center;gap:10px"><i style="width:11px;height:11px;border-radius:50%;background:${color};display:inline-block"></i>${title}</h3><p class="sub" style="font-size:13.5px">${sub}</p></div><span style="font-family:var(--serif);font-size:30px">${fmtEur(total)}</span></div>
      ${arr.length ? arr.map(line).join("") : `<p class="muted" style="font-size:14px">Rien d'identifié avec ces paramètres.</p>`}</div>`;
    const W = Math.max(real + sC, 1);
    $("#simout").innerHTML = `
      <div class="panel sky" style="padding:32px">
        <div class="eyebrow" style="color:#f3d9a8">Ordre de grandeur sur 12 à 18 mois</div>
        <div class="big-total" style="margin:12px 0 10px;color:#f4ecdb">${fmtEur(real)}</div>
        <p class="sub">Droits fiscaux et financements sur dossier.${ratio ? ` Soit ${ratio.toFixed(1).replace(".", ",")} fois vos fonds propres ou votre dernière levée.` : ""}${sC ? ` Concours en plus : jusqu'à ${fmtEur(sC)} si vous êtes retenu.` : ""}</p>
        <div class="stack" style="margin-top:20px;height:12px">
          <div style="width:${(sD / W) * 100}%;background:var(--c-fisc)" data-tip="<b>Droits fiscaux</b>${fmtEur(sD)}"></div>
          <div style="width:${(sA / W) * 100}%;background:#98b56f" data-tip="<b>Sur dossier</b>${fmtEur(sA)}"></div>
          <div style="width:${(sC / W) * 100}%;background:repeating-linear-gradient(45deg,#f3d9a8,#f3d9a8 3px,transparent 3px,transparent 6px)" data-tip="<b>Concours</b>${fmtEur(sC)}"></div>
        </div>
        <div class="legend" style="color:#d4ddd2"><span><i style="background:var(--c-fisc)"></i>Droits fiscaux</span><span><i style="background:#98b56f"></i>Sur dossier</span><span><i style="background:#f3d9a8"></i>Concours</span></div>
      </div>
      <div class="panel" style="margin-top:18px">
        ${bucket("Droits fiscaux", "Ouverts chaque année si les conditions sont remplies", r.droits, "var(--c-fisc)", sD)}
        ${bucket("Sur dossier", "Bpifrance, réseaux, banques, prêteurs privés", r.acces, "var(--c-pret)", sA)}
        ${bucket("Concours et appels à projets", "Non garantis, donc exclus du total", r.concours, "var(--c-sub)", sC)}
      </div>
      <p class="sub" style="margin-top:14px;font-size:13px">Calcul simplifié, pas un engagement des opérateurs. Les plafonds d'aides d'État et les conditions détaillées peuvent réduire ces montants.</p>`;
    bindTips($("#simout"));
  }

  /* ================================================================ */
  /* PARCOURS                                                         */
  /* ================================================================ */
  function pageParcours(_, q) {
    const P = D.parcours.find((x) => x.id === q.p) || D.parcours[0];
    const pill = (id) => { const d = byId[id]; return d ? `<a class="pill" href="#/d/${id}"><i style="background:${catColor(d.cat)}"></i>${esc(d.nom)}</a>` : ""; };
    app.innerHTML = pageHead({ eyebrow: "Parcours", title: "Quoi demander, <em>et quand</em>", lead: "Les fondateurs empilent rarement moins de quatre ou cinq dispositifs. Le schéma habituel : JEI et CIR dès les premiers salaires de R&D, une bourse au démarrage, puis des prêts adossés à chaque levée." }) + `
      <div class="wrap">
        <section class="section first">
          <div class="shead"><div><h2>Trois parcours types</h2><p class="sub">À adapter à votre calendrier de levée</p></div>
            <div class="seg">${D.parcours.map((x) => `<button data-p="${x.id}" class="${x.id === P.id ? "on" : ""}">${esc(x.titre)}</button>`).join("")}</div></div>
          <div class="grid g-5-7" style="gap:40px">
            <div class="panel sky" style="align-self:start"><div class="eyebrow" style="color:#f3d9a8">${esc(P.sous)}</div><h2 style="color:#f4ecdb;margin-top:8px">${esc(P.titre)}</h2>
              <div class="hr" style="border-color:rgba(244,236,219,.2)"></div>
              <p class="sub">Plafonds connus cumulés sur le parcours</p>
              <div style="font-family:var(--serif);font-size:64px;line-height:1;margin-top:6px">${fmtEur(P.etapes.flatMap((e) => e.items).reduce((s, id) => s + (byId[id] && byId[id].max ? byId[id].max : 0), 0))}</div>
              <p class="sub" style="margin-top:10px;font-size:13px">Sans compter les montants variables (CIR, prêts adossés aux levées, venture debt).</p></div>
            <div class="timeline">${P.etapes.map((e) => `<div class="tl-step"><div class="m">${e.mois}</div><p>${esc(e.txt)}</p><div class="pills">${e.items.map(pill).join("")}</div></div>`).join("")}</div>
          </div>
        </section>
        <section class="section">
          <div class="shead"><div><h2>Stade par stade</h2><p class="sub">Un dispositif peut figurer sur plusieurs stades</p></div></div>
          <div class="stages">${STADES.map((s, i) => { const L = CATS.flatMap((cat) => D.dispositifs.filter((d) => d.cat === cat && d.stades.includes(s))); return `<div class="stage-col">
            <div class="n">${["I", "II", "III", "IV"][i]} · ${D.stades[s].mois}</div><h3>${D.stades[s].label}</h3><p class="sub" style="font-size:13.5px">${D.stades[s].hint}</p>
            <div class="stack" style="margin:14px 0 6px;height:8px;color:var(--ink)">${CATS.map((c) => { const n = L.filter((d) => d.cat === c).length; return n ? `<div style="width:${(n / L.length) * 100}%;background:${catColor(c)}" data-tip="<b>${D.categories[c].label}</b>${n}"></div>` : ""; }).join("")}</div>
            <p class="sub" style="font-size:12.5px;margin-bottom:10px">${L.length} dispositifs</p>
            ${L.map((d) => `<a class="mrow" href="#/d/${d.id}"><i style="background:${catColor(d.cat)}"></i><span>${esc(d.nom)}</span><span class="a">${d.max ? fmtEur(d.max) : ""}</span></a>`).join("")}</div>`; }).join("")}</div>
        </section>
      </div>`;
    $$("[data-p]").forEach((b) => (b.onclick = () => { rs("#/parcours?p=" + b.dataset.p); pageParcours([], { p: b.dataset.p }); bindTips(app); }));
  }

  /* ================================================================ */
  /* CUMULS                                                           */
  /* ================================================================ */
  function pageCumuls(_, q) {
    const ids = Array.from(new Set(D.cumuls.flatMap((c) => [c[0], c[1]]))).filter((id) => byId[id]);
    ids.sort((a, b) => CATS.indexOf(byId[a].cat) - CATS.indexOf(byId[b].cat) || byId[a].nom.localeCompare(byId[b].nom, "fr"));
    const filt = q.t || "";
    const get = (a, b) => D.cumuls.find((c) => (c[0] === a && c[1] === b) || (c[0] === b && c[1] === a));
    const counts = Object.fromEntries(Object.keys(CUM_LABEL).map((t) => [t, D.cumuls.filter((c) => c[2] === t).length]));
    const short = (d) => (d.nom.length > 30 ? d.nom.slice(0, 29) + "…" : d.nom);
    const legend = `<p class="ptitle">Lecture</p><p class="psub">Survolez ou cliquez une pastille</p>
      ${Object.keys(CUM_LABEL).map((t) => `<div class="rel"><span class="cum-ic cum-${t}">${CUM_ICON[t]}</span><span><span class="rn">${CUM_LABEL[t]}</span><br><span class="rt">${{ levier: "L'un ouvre l'accès à l'autre : prérequis, quasi-fonds propres, garantie.", cumul: "Les deux s'additionnent sans difficulté.", condition: "Cumul possible avec des assiettes séparées ou dans les plafonds d'aides.", exclusif: "Il faut choisir l'un ou l'autre." }[t]}</span></span></div>`).join("")}
      <div class="hr"></div><p class="sub" style="font-size:13px">Petit point gris : pas de règle documentée. Les aides publiques se cumulent en principe dans la limite des intensités prévues par l'encadrement européen.</p>`;
    app.innerHTML = pageHead({ eyebrow: "Cumuls", title: "Ce qui s'additionne, <em>ce qui s'exclut</em>", lead: `${D.cumuls.length} règles entre ${ids.length} dispositifs : effets de levier, cumuls simples, cumuls sous conditions, exclusions.` }) + `
      <div class="wrap" style="margin-top:36px">
        <div class="chips" style="margin-bottom:18px"><button class="chip ${!filt ? "on" : ""}" data-t="">Toutes <span class="ct">${D.cumuls.length}</span></button>
          ${Object.keys(CUM_LABEL).map((t) => `<button class="chip ${filt === t ? "on" : ""}" data-t="${t}">${CUM_LABEL[t]} <span class="ct">${counts[t]}</span></button>`).join("")}</div>
        <div class="grid g-cum" id="cumgrid">
          <div class="matrix-wrap"><table class="mx"><thead><tr><th></th>${ids.map((id) => `<th><div><a href="#/d/${id}" style="text-decoration:none">${esc(short(byId[id]))}</a></div></th>`).join("")}</tr></thead>
            <tbody>${ids.map((a) => `<tr><th><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${catColor(byId[a].cat)};margin-right:7px"></span><a href="#/d/${a}" style="text-decoration:none">${esc(short(byId[a]))}</a></th>${ids.map((b) => {
              if (a === b) return `<td><span class="self"></span></td>`;
              const c = get(a, b);
              if (!c || (filt && c[2] !== filt)) return `<td><span></span></td>`;
              return `<td><span class="has ${c[2]}" data-a="${a}" data-b="${b}" data-tip="${esc(`<b>${esc(byId[a].nom)} + ${esc(byId[b].nom)}</b>${CUM_LABEL[c[2]]}. ${esc(c[3])}`)}"></span></td>`;
            }).join("")}</tr>`).join("")}</tbody></table></div>
          <div class="panel" id="cumdetail" style="position:sticky;top:90px">${legend}</div>
        </div>
      </div>`;
    $$("[data-t]").forEach((b) => (b.onclick = () => { rs("#/cumuls" + (b.dataset.t ? "?t=" + b.dataset.t : "")); pageCumuls([], { t: b.dataset.t }); bindTips(app); }));
    $$(".mx span.has").forEach((s) => (s.onclick = () => {
      const c = get(s.dataset.a, s.dataset.b), A = byId[s.dataset.a], B = byId[s.dataset.b];
      $("#cumdetail").innerHTML = `<p class="ptitle" style="display:flex;gap:10px;align-items:center"><span class="cum-ic cum-${c[2]}">${CUM_ICON[c[2]]}</span>${CUM_LABEL[c[2]]}</p>
        <div class="hr"></div>${[A, B].map((X) => `<a class="rel" href="#/d/${X.id}">${logo(X.op, 30)}<span><span class="rn">${esc(X.nom)}</span><br><span class="rt">${esc(opName(X))} · ${ticket(X)}</span></span></a>`).join("")}
        <div class="hr"></div><p style="font-size:15px;color:var(--ink-2);margin:0">${esc(c[3])}</p>
        <div class="toolbar" style="margin-top:16px"><a class="btn sm" href="#/comparer?ids=${A.id},${B.id}">Comparer</a><button class="btn sm link" id="cumback">Légende</button></div>`;
      $("#cumback").onclick = () => { $("#cumdetail").innerHTML = legend; };
    }));
  }

  /* ================================================================ */
  /* OPÉRATEURS                                                       */
  /* ================================================================ */
  function pageOps(_, q) {
    const t = q.type || "";
    const list = D.fournisseurs.filter((o) => !t || o.type === t).map((o) => ({ o, L: D.dispositifs.filter((d) => d.op === o.id || (d.autresOps || []).includes(o.id)) }));
    const typeCounts = Object.keys(D.typesFournisseur).map((k) => [k, D.fournisseurs.filter((o) => o.type === k).length]).filter(([, n]) => n);
    const top = D.fournisseurs.map((o) => ({ label: o.nom, v: D.dispositifs.filter((d) => d.op === o.id).length, href: `#/op/${o.id}` })).filter((x) => x.v > 1).sort((a, b) => b.v - a.v);
    app.innerHTML = pageHead({ eyebrow: "Opérateurs", title: "Qui finance, <em>et comment</em>", lead: "Bpifrance, l'État, l'Union européenne, les régions, les réseaux de prêts d'honneur, les banques et les prêteurs privés." }) + `
      <div class="wrap">
        <section class="section first"><div class="grid g2">
          <div class="panel"><p class="ptitle">Qui porte le plus de dispositifs</p><p class="psub">Opérateurs présents plusieurs fois dans la base</p>${hbars(top, top[0].v, "var(--sky)")}</div>
          <div class="panel"><p class="ptitle">Ce que finance chaque famille</p><p class="psub">Dispositifs par catégorie</p>
            ${Object.keys(D.typesFournisseur).map((k) => { const L = D.dispositifs.filter((d) => opById[d.op] && opById[d.op].type === k); return L.length ? `<div style="padding:7px 0"><div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:5px"><span>${D.typesFournisseur[k]}</span><span class="num muted">${L.length}</span></div><div class="stack" style="height:9px;color:var(--ink)">${CATS.map((c) => { const v = L.filter((d) => d.cat === c).length; return v ? `<div style="width:${(v / L.length) * 100}%;background:${catColor(c)}" data-tip="<b>${D.categories[c].label}</b>${v}"></div>` : ""; }).join("")}</div></div>` : ""; }).join("")}
            <div class="legend">${CATS.map((c) => `<span><i style="background:${catColor(c)}"></i>${D.categories[c].label}</span>`).join("")}</div></div>
        </div></section>
        <section class="section">
          <div class="chips" style="margin-bottom:20px"><button class="chip ${!t ? "on" : ""}" data-ty="">Tous <span class="ct">${D.fournisseurs.length}</span></button>${typeCounts.map(([k, n]) => `<button class="chip ${t === k ? "on" : ""}" data-ty="${k}">${D.typesFournisseur[k]} <span class="ct">${n}</span></button>`).join("")}</div>
          <div class="grid g3">${list.map(({ o, L }) => `<div class="panel op-card">
            <div style="display:flex;gap:14px;align-items:center">${logo(o.id, 52)}<div><h3 style="margin:0;font-size:24px"><a href="#/op/${o.id}" style="text-decoration:none">${esc(o.nom)}</a></h3><span class="muted" style="font-size:13px">${D.typesFournisseur[o.type]}</span></div></div>
            <p style="margin:0;font-size:14.5px;color:var(--ink-2)">${esc(o.focus)}</p>
            <div class="cnt">${L.length} dispositif${L.length > 1 ? "s" : ""}${L.length ? " · " + Array.from(new Set(L.flatMap((d) => d.stades))).sort((a, b) => STADES.indexOf(a) - STADES.indexOf(b)).map((s) => D.stades[s].label).join(", ") : ""}</div>
            <div class="links">${L.slice(0, 5).map((d) => `<a class="pill" href="#/d/${d.id}"><i style="background:${catColor(d.cat)}"></i>${esc(d.nom)}</a>`).join("")}${L.length > 5 ? `<a class="pill" href="#/op/${o.id}">+${L.length - 5}</a>` : ""}</div>
          </div>`).join("")}</div>
        </section>
      </div>`;
    $$("[data-ty]").forEach((b) => (b.onclick = () => { rs("#/operateurs" + (b.dataset.ty ? "?type=" + b.dataset.ty : "")); pageOps([], { type: b.dataset.ty }); bindTips(app); }));
  }

  function pageOp([id]) {
    const o = opById[id];
    if (!o) return pageNotFound();
    const L = D.dispositifs.filter((d) => d.op === o.id || (d.autresOps || []).includes(o.id));
    app.innerHTML = pageHead({
      before: `<div class="crumbs"><a href="#/operateurs">Opérateurs</a><span>/</span><span>${D.typesFournisseur[o.type]}</span></div><div style="margin-top:22px">${logo(o.id, 76)}</div>`,
      title: esc(o.nom), lead: esc(o.focus),
      actions: `<a class="btn primary" href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">Site officiel ↗</a>`,
    }) + `<div class="wrap"><section class="section first"><div class="shead"><h2>${L.length} dispositif${L.length > 1 ? "s" : ""}</h2></div>
      ${L.length ? `<div class="ledger">${L.map((d) => lrow(d)).join("")}</div>` : `<div class="empty">Aucun dispositif rattaché pour l'instant.</div>`}</section></div>`;
  }

  /* ================================================================ */
  /* VENTURE DEBT                                                     */
  /* ================================================================ */
  function pageVD() {
    const M = D.vdMarche;
    const L = D.dispositifs.filter((d) => d.cat === "venture-debt");
    const vdL = L.filter((d) => d.vd), rbfL = L.filter((d) => !d.vd);
    const maxA = Math.max(...M.acteurs.map((a) => a.montant));
    // fourchettes de tickets, échelle log 100 k€ – 60 M€
    const lo = Math.log10(1e5), hi = Math.log10(6e7);
    const pos = (v) => ((Math.log10(v) - lo) / (hi - lo)) * 100;
    const ranged = vdL.filter((d) => d.min != null && d.max != null).sort((a, b) => a.min - b.min || a.max - b.max);
    const unranged = vdL.filter((d) => !(d.min != null && d.max != null));
    const ticks = [1e5, 3e5, 1e6, 3e6, 1e7, 3e7];
    const rangeChart = `<div class="panel">
      <p class="ptitle">Qui prête combien</p><p class="psub">Fourchette de ticket par prêteur, échelle logarithmique</p>
      <div class="rng">
        <div></div><div style="position:relative;height:22px">${ticks.map((t) => `<span style="position:absolute;left:${pos(t)}%;transform:translateX(-50%);font-size:11.5px;color:var(--ink-3)">${fmtEur(t)}</span>`).join("")}</div>
        ${ranged.map((d) => `<a href="#/d/${d.id}" style="display:flex;gap:10px;align-items:center;text-decoration:none;padding:7px 0;min-width:0">${logo(d.op, 30)}<span style="font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(opById[d.op].nom.replace(/ \(.*\)$/, ""))}</span></a>
          <div style="position:relative;height:30px;overflow:visible" data-tip="${esc(`<b>${esc(d.nom)}</b>${esc(d.vd.ticket)}${d.vd.critere ? "<br>" + esc(d.vd.critere) : ""}`)}">
            ${ticks.map((t) => `<span style="position:absolute;left:${pos(t)}%;top:0;bottom:0;border-left:1px dashed var(--line)"></span>`).join("")}
            <span style="position:absolute;left:${pos(d.min)}%;width:${Math.max(pos(d.max) - pos(d.min), 1)}%;top:10px;height:10px;border-radius:5px;background:var(--c-vd)"></span>
            <span style="position:absolute;${pos(d.max) > 72 ? `right:calc(${100 - pos(d.min)}% + 8px)` : `left:calc(${pos(d.max)}% + 8px)`};top:5px;font-size:12px;color:var(--ink-2);white-space:nowrap" class="num">${esc(d.vd.ticket)}</span>
          </div>`).join("")}
      </div>
      ${unranged.length ? `<p class="sub" style="margin-top:14px;font-size:13px">Ticket non publié : ${unranged.map((d) => `<a href="#/d/${d.id}">${esc(opById[d.op].nom.replace(/ \(.*\)$/, ""))}</a>`).join(", ")}.</p>` : ""}
    </div>`;
    const row = (d) => {
      const o = opById[d.op];
      return `<tr>
        <td class="name"><div style="display:flex;gap:12px;align-items:center">${logo(d.op, 34)}<div><a href="#/d/${d.id}">${esc(o.nom.replace(/ \(.*\)$/, ""))}</a><span class="op">${esc(d.forme)}</span></div></div></td>
        <td style="white-space:nowrap">${d.vd && d.vd.ticket !== "Non publié" ? `<span class="num">${esc(d.vd.ticket)}</span>` : '<span class="muted">Non publié</span>'}</td>
        <td style="font-size:14px">${d.vd && d.vd.critere ? esc(d.vd.critere) : esc(d.elig)}</td>
        <td>${stageDots(d)}</td>
        <td style="white-space:nowrap">${d.vd ? (d.vd.bsa === true ? '<span class="tag sel">Oui</span>' : '<span class="muted">Selon dossier</span>') : "Non"}</td>
        <td>${tagSt(d.statut)}</td></tr>`;
    };
    const head = `<thead><tr><th>Acteur</th><th>Ticket</th><th>Critère d'entrée</th><th>Stades</th><th>Warrants</th><th>Fiabilité</th></tr></thead>`;
    app.innerHTML = pageHead({ eyebrow: "Venture debt", title: "Allonger la piste <em>entre deux levées</em>", lead: "La venture debt prête à des startups déjà soutenues par des investisseurs, en s'appuyant sur leur trajectoire plutôt que sur leurs bénéfices. Elle ajoute 6 à 12 mois de trésorerie sans nouveau tour de table, contre des intérêts et, souvent, quelques warrants." }) + `
      <div class="wrap">
        <section class="section first"><div class="figs">
          <div class="fig"><div class="v">${fmtEur(M.volume)}</div><div class="l">prêtés en Europe en ${M.annee}</div><div class="s">${M.operations} opérations</div></div>
          <div class="fig"><div class="v">${M.taux}</div><div class="l">taux d'intérêt usuels</div><div class="s">${esc(M.tauxDetail)}</div></div>
          <div class="fig"><div class="v">20–35 %</div><div class="l">du dernier tour</div><div class="s">ticket habituel</div></div>
          <div class="fig"><div class="v">${L.length}</div><div class="l">acteurs référencés</div><div class="s">${vdL.length} prêteurs, ${rbfL.length} financeurs sur revenus</div></div>
        </div><p class="sub" style="font-size:12.5px;margin-top:14px">Marché : ${esc(M.source)}.</p></section>

        <section class="section">${rangeChart}</section>

        <section class="section"><div class="grid g-7-5">
          <div class="panel"><p class="ptitle">Les plus gros prêteurs en ${M.annee}</p><p class="psub">Montants déployés en venture debt, Europe</p>
            ${M.acteurs.map((a) => `<a href="#/op/${a.id}" style="display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:14px;align-items:center;padding:12px 0;border-top:1px solid var(--line);text-decoration:none">${logo(a.id, 40)}
              <span><b>${esc(a.nom)}</b><span style="display:block;height:8px;border-radius:4px;background:var(--line);margin-top:7px"><span style="display:block;height:100%;border-radius:4px;width:${(a.montant / maxA) * 100}%;background:var(--c-vd)"></span></span></span>
              <span style="text-align:right"><span style="font-family:var(--serif);font-size:26px">${fmtEur(a.montant)}</span><span class="muted" style="display:block;font-size:12px">${a.operations} opérations · ${fmtEur(a.montant / a.operations)} en moyenne</span></span></a>`).join("")}</div>
          <div class="panel sky"><div class="eyebrow" style="color:#f3d9a8">Un cas réel</div><p class="ptitle" style="margin-top:8px;font-size:30px">${esc(M.exemple.titre)}</p>
            <p style="margin:14px 0;line-height:1.65">${esc(M.exemple.txt)}</p><a href="${esc(M.exemple.url)}" target="_blank" rel="noopener noreferrer" style="font-size:13.5px;color:#f3d9a8">Communiqué de la société ↗</a></div>
        </div></section>

        <section class="section"><div class="shead"><div><div class="eyebrow">Avant de signer</div><h2>Trois choses à regarder</h2></div></div>
          <div class="grid g3">
            <div class="panel"><h3>Le ticket</h3><p class="sub" style="font-size:15px;color:var(--ink-2)">Calculé sur le dernier tour : 20 à 35 % du montant levé le plus souvent. Les prêteurs regardent surtout qui sont vos investisseurs et s'ils suivront.</p></div>
            <div class="panel"><h3>Le coût</h3><p class="sub" style="font-size:15px;color:var(--ink-2)">Un taux de 7 à 13 %, des frais d'entrée et de sortie, et souvent des warrants : le droit d'acheter quelques actions plus tard. Dilution faible, mais pas nulle.</p></div>
            <div class="panel"><h3>Les garanties</h3><p class="sub" style="font-size:15px;color:var(--ink-2)">Nantissement du fonds de commerce, de la propriété intellectuelle ou des comptes, clauses de défaut. Elles comptent souvent plus que le taux.</p></div>
          </div></section>

        <section class="section"><div class="shead"><div><h2>Prêteurs venture et growth debt</h2><p class="sub">Du seed à la croissance</p></div><a class="btn link" href="#/explorer?cat=venture-debt">Ouvrir dans l'explorateur</a></div>
          <div class="tbl-wrap"><table class="tbl">${head}<tbody>${vdL.sort((a, b) => (a.min ?? 9e9) - (b.min ?? 9e9)).map(row).join("")}</tbody></table></div></section>

        <section class="section"><div class="shead"><div><h2>Financement sur revenus</h2><p class="sub">Pour les entreprises qui encaissent déjà des revenus réguliers, avec ou sans levée</p></div></div>
          <div class="tbl-wrap"><table class="tbl">${head}<tbody>${rbfL.map(row).join("")}</tbody></table></div></section>

        <section class="section"><div class="shead"><h2>Quel instrument choisir</h2></div>
          <div class="tbl-wrap"><table class="tbl" style="min-width:700px"><thead><tr><th></th><th>Prêt Bpifrance</th><th>Venture debt</th><th>Financement sur revenus</th></tr></thead><tbody>
            <tr><td class="muted">Pour qui</td><td>Startups innovantes, dès l'amorçage</td><td>Startups ayant levé, ou rentables</td><td>Entreprises à revenus récurrents</td></tr>
            <tr><td class="muted">Montant</td><td>Limité par les fonds propres, jusqu'à 5 M€</td><td>De 250 k€ à 50 M€ selon le prêteur</td><td>Quelques mois de revenus</td></tr>
            <tr><td class="muted">Durée</td><td>5 à 8 ans, avec différé</td><td>3 à 5 ans, intérêts seuls au début</td><td>Quelques mois</td></tr>
            <tr><td class="muted">Dilution</td><td>Aucune</td><td>Faible, via des warrants</td><td>Aucune</td></tr>
            <tr><td class="muted">À voir</td><td><a href="#/d/pret-innovation">Prêt Innovation</a>, <a href="#/d/pai">PAI</a></td><td><a href="#/d/vd-actyus">Actyus</a>, <a href="#/d/vd-wormser">Wormser</a>, <a href="#/d/vd-isai">ISAI</a>, <a href="#/d/vd-claret">Claret</a>, <a href="#/d/vd-bei">BEI</a></td><td><a href="#/d/rbf-silvr">Silvr</a>, <a href="#/d/rbf-karmen">Karmen</a></td></tr>
          </tbody></table></div></section>
      </div>`;
  }

  /* ================================================================ */
  /* MÉTHODE                                                          */
  /* ================================================================ */
  function pageMethod() {
    const sec = (t, txt) => `<div class="panel"><h3>${t}</h3><div class="prose" style="margin-top:8px">${txt}</div></div>`;
    app.innerHTML = pageHead({ eyebrow: "Méthodologie", title: "Comment lire la base" }) + `<div class="wrap"><div class="grid g2 section first">
      ${sec("Périmètre", "<p>Dispositifs de financement non dilutif accessibles aux entreprises innovantes françaises : subventions, avances récupérables, prêts publics, prêts d'honneur, prêts bancaires, garanties, avantages fiscaux et dette privée (venture debt, growth lending, financement sur revenus). Les fonds propres sont exclus, y compris l'option equity de l'EIC Accelerator. La venture debt s'accompagne parfois de warrants, à l'effet dilutif faible : c'est indiqué sur les fiches.</p>")}
      ${sec("Trois niveaux de fiabilité", `<p><b>Vérifié</b> : relu sur une source officielle (opérateur, Service Public Entreprendre, boss.gouv.fr, MESR) en ${esc(D.meta.releve.toLowerCase())}.</p><p><b>Recoupé</b> : concordant dans plusieurs sources récentes ou dans le relevé de l'éditeur, page officielle non relue.</p><p><b>Répertoire</b> : à reconfirmer auprès de l'opérateur.</p>`)}
      ${sec("Champs", "<p>Montant, couverture, durée, stades, secteurs, zone, délai indicatif, effort de dossier, mode d'accès, critère d'entrée pour la dette privée, source et statut. Délais et efforts sont des ordres de grandeur.</p>")}
      ${sec("Règles de cumul", "<p>Quatre types : effet de levier, cumul, cumul sous conditions, exclusion. L'absence de règle ne signifie pas que le cumul est interdit.</p>")}
      ${sec("Simulateur", `<p>CIR à 30 % de la R&D nette de l'exonération JEI et des subventions ; CII à 20 % dans la limite de 400 k€ ; exonération JEI estimée à 25 % de la masse salariale R&D, plafonnée à 5 PASS (${fmtFull(5 * D.meta.pass2026)} en 2026) ; prêt d'amorçage borné par les fonds propres ; venture debt à 25 % du dernier tour.</p>`)}
      ${sec("Avertissement", "<p>Point d'entrée, pas un conseil en financement. Les régimes d'aides publiques relèvent du droit européen des aides d'État : seules les conditions officielles font foi.</p>")}
    </div></div>`;
  }

  function pageNotFound() {
    app.innerHTML = pageHead({ title: "Page introuvable", actions: `<a class="btn light" href="#/">Retour à l'accueil</a>` });
  }


  $("#menu").onclick = () => { const t = $(".top"); const open = !t.classList.contains("open"); t.classList.toggle("open", open); $("#menu").setAttribute("aria-expanded", String(open)); };
  $$("#nav a").forEach((a) => a.addEventListener("click", () => { $(".top").classList.remove("open"); $("#menu").setAttribute("aria-expanded", "false"); }));
  const fh = $("#foot-h"); if (fh) fh.outerHTML = horizon("#163f42");
  if (location.hash.startsWith("#/")) { rs(location.hash); rendered = true; } // anciens liens partagés : titre recalculé
  lastRoute = location.pathname;
  fixLinks(document);
  render();
})();
