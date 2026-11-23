// Contrôle qualité des données d'index.html : `npm run check`.
// Sort en erreur (code 1) sur un problème bloquant, affiche des avertissements sinon.
//   - chaque *_BASE se relit en JSON
//   - champs obligatoires et valeurs plausibles (année, mois, jour, montant)
//   - doublons probables : même société à moins de 120 jours d'écart
//     (même tour annoncé deux fois, annonce d'un investisseur puis tour chiffré…)
//   - tirets cadratins dans les textes (règle de style du site)
//   - couverture : semaines récentes avec trop peu de levées par rapport à la médiane
const { load } = require("./data-io");

const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);
const noDay = [];

const data = {};
for (const k of ["LD_BASE", "MD_BASE", "PE_BASE", "STARTUPS_BASE", "INVFULL_BASE"]) {
  try { data[k] = load(k); } catch (e) { err(`${k} illisible : ${e.message}`); }
}
const L = data.LD_BASE || [], M = data.MD_BASE || [], P = data.PE_BASE || [];
const now = new Date();
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const day = (d) => Date.UTC(d.an, (d.mo || 1) - 1, d.j || 15) / 864e5;
const label = (d) => `${d.s} (${d.an}-${String(d.mo).padStart(2, "0")}${d.j ? "-" + String(d.j).padStart(2, "0") : ""}, ${d.stade || "stade ?"}, ${d.m ?? "n.c."} M€)`;

// --- champs
L.forEach((d, i) => {
  const where = `LD_BASE[${i}] ${d.s || "?"}`;
  if (!d.s) err(`${where} : nom manquant`);
  if (!Number.isInteger(d.an) || d.an < 2015 || d.an > now.getUTCFullYear() + 1) err(`${where} : année invalide (${d.an})`);
  if (!Number.isInteger(d.mo) || d.mo < 1 || d.mo > 12) err(`${where} : mois invalide (${d.mo})`);
  if (d.j != null && (!Number.isInteger(d.j) || d.j < 1 || d.j > 31)) err(`${where} : jour invalide (${d.j})`);
  if (d.m != null && (typeof d.m !== "number" || d.m <= 0 || d.m > 5000)) err(`${where} : montant invalide (${d.m})`);
  if (day(d) > now / 864e5 + 2) err(`${where} : date dans le futur`);
  if (d.an >= 2026 && d.j == null) noDay.push(d.s);
  if (d.an >= 2026 && !d.stade) warn(`${where} : stade manquant`);
});
let undatedOps = 0;
M.forEach((d, i) => { if (!d.s) err(`MD_BASE[${i}] : cible manquante`); else if (!d.an || !d.mo) undatedOps++; });
P.forEach((d, i) => { if (!d.cible || !d.an_entree) err(`PE_BASE[${i}] : cible ou année d'entrée manquante`); });

// --- doublons probables
function dupes(arr, name, key) {
  const by = {};
  arr.forEach((d, i) => (by[norm(key(d))] ||= []).push({ d, i }));
  for (const list of Object.values(by)) {
    list.sort((a, b) => day(a.d) - day(b.d));
    for (let k = 1; k < list.length; k++) {
      const a = list[k - 1].d, b = list[k].d;
      if (day(b) - day(a) <= 120) {
        const same = a.m != null && a.m === b.m;
        (same ? err : warn)(`${name} doublon ${same ? "certain" : "probable"} : ${label(a)} / ${label(b)}`);
      }
    }
  }
}
dupes(L, "LD_BASE", (d) => d.s);
dupes(M.map((d) => ({ ...d, s: d.s })), "MD_BASE", (d) => d.s + "|" + d.acq);

// --- style
const DASH = /—|&#8212;/;
L.forEach((d) => DASH.test(d.p || "") && warn(`LD_BASE ${d.s} : tiret cadratin dans le pitch`));
M.forEach((d) => DASH.test((d.sub || "") + (d.ctx || "")) && warn(`MD_BASE ${d.s} : tiret cadratin`));
P.forEach((d) => DASH.test(d.desc || "") && warn(`PE_BASE ${d.cible} : tiret cadratin`));

// --- couverture : levées par mois (tous les rows) et par semaine (rows datés au jour)
const ym = (an, mo) => an * 12 + mo - 1;
const curM = ym(now.getUTCFullYear(), now.getUTCMonth() + 1);
const perMonth = {};
L.forEach((d) => { perMonth[ym(d.an, d.mo)] = (perMonth[ym(d.an, d.mo)] || 0) + 1; });
const past = []; for (let k = curM - 12; k < curM; k++) past.push(perMonth[k] || 0);
const med = [...past].sort((a, b) => a - b)[6];
const monthName = (k) => `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}`;
for (let k = curM - 3; k < curM; k++) {
  const n = perMonth[k] || 0;
  if (n < med * 0.6) warn(`Couverture faible : ${monthName(k)} compte ${n} levées (médiane des 12 derniers mois : ${med})`);
}
// Mois en cours : rythme attendu au prorata des jours écoulés
const dom = now.getUTCDate(), dim = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
const curN = perMonth[curM] || 0, expected = Math.round((med * dom) / dim);
if (dom >= 10 && curN < expected * 0.6) warn(`Couverture faible : ${monthName(curM)} compte ${curN} levées au ${dom}, environ ${expected} attendues à ce stade du mois`);
const weekStart = (t) => { const x = new Date(t * 864e5); return Math.floor(t) - ((x.getUTCDay() + 6) % 7); };
const perWeek = {};
L.filter((d) => d.j).forEach((d) => { const w = weekStart(day(d)); perWeek[w] = (perWeek[w] || 0) + 1; });
const thisWeek = weekStart(Math.floor(now / 864e5));
const fmt = (w) => new Date(w * 864e5).toISOString().slice(0, 10);
const coverage = []; for (let w = thisWeek - 7 * 8; w <= thisWeek; w += 7) coverage.push(`semaine du ${fmt(w)} : ${perWeek[w] || 0}`);
if (noDay.length) warn(`${noDay.length} levées 2026+ sans jour (j), mal triées dans « Dernières levées » : ${noDay.slice(-10).join(", ")}${noDay.length > 10 ? "…" : ""}`);
if (undatedOps) warn(`${undatedOps} opérations MD_BASE sans date (anciennes fiches de cibles), ignorées des vues datées`);

// --- Section non dilutive (Dilution Zéro) : données lisibles, références cohérentes, relevé récent
try {
  const { createNonDilutif } = require("../lib/nondilutif.js");
  const ND = createNonDilutif(require("fs").readFileSync(require("path").join(__dirname, "..", "non-dilutif", "data.js"), "utf8"));
  const DZ = ND.data, ids = new Set(DZ.dispositifs.map((d) => d.id));
  DZ.dispositifs.forEach((d) => { if (!ND.opById[d.op]) err(`non-dilutif ${d.id} : opérateur inconnu (${d.op})`); if (!d.url) warn(`non-dilutif ${d.id} : pas de lien officiel`); });
  DZ.cumuls.forEach((c) => { if (!ids.has(c[0]) || !ids.has(c[1])) warn(`non-dilutif : cumul vers un dispositif inconnu (${c[0]} / ${c[1]})`); });
  const MOISN = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
  const r = String(DZ.meta.releve || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/([a-z]+)\s+(\d{4})/);
  if (r) { const age = (now.getUTCFullYear() * 12 + now.getUTCMonth()) - (+r[2] * 12 + MOISN.indexOf(r[1])); if (age >= 2) warn(`non-dilutif : relevé de ${DZ.meta.releve}, à revérifier (voir docs/mise-a-jour-hebdo.md, étape mensuelle)`); }
  else warn("non-dilutif : date de relevé illisible dans DZ.meta.releve");
  const byStatut = DZ.dispositifs.reduce((a, d) => ((a[d.statut] = (a[d.statut] || 0) + 1), a), {});
  console.log(`Non-dilutif : ${DZ.dispositifs.length} dispositifs (${Object.entries(byStatut).map(([k, n]) => k + " " + n).join(", ")}), relevé ${DZ.meta.releve}`);
} catch (e) { err("non-dilutif/data.js illisible : " + e.message); }

console.log(`LD_BASE ${L.length} levées · MD_BASE ${M.length} opérations · PE_BASE ${P.length} participations`);
console.log(`Levées par mois (12 derniers, médiane ${med}) : ` + past.join(" ") + ` · mois en cours : ${curN}`);
console.log(`Levées datées au jour, par semaine :\n  ` + coverage.join("\n  "));
if (warns.length) console.log(`\n${warns.length} avertissement(s) :\n  ` + warns.slice(0, 80).join("\n  ") + (warns.length > 80 ? `\n  … ${warns.length - 80} de plus` : ""));
if (errors.length) { console.log(`\n${errors.length} erreur(s) :\n  ` + errors.join("\n  ")); process.exit(1); }
console.log("\nAucune erreur bloquante.");
