// Pages indexables (/startup/…, /fonds/…, /levees/…, index et sitemap.xml), rendues à partir
// des données d'index.html. Les URL publiques sont réécrites vers cette fonction par vercel.json ;
// le chemin demandé arrive dans le paramètre `p`. Mises en cache par le CDN jusqu'au prochain déploiement.
const fs = require("fs");
const path = require("path");
const { createPages } = require("../lib/pages.js");
const VEH = require("../data/vehicles.json");

let pages = null;
const get = () => pages || (pages = createPages(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"), VEH));

module.exports = (req, res) => {
  const url = new URL(req.url, "https://www.insights-french-tech.com");
  const p = url.searchParams.get("p") || url.pathname;
  let out;
  try { out = get().render(p); } catch (e) { console.error(e); return res.status(500).send("Erreur"); }
  if (!out.body) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600");
    return res.status(404).send(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Page introuvable | Insights French Tech</title><p style="font-family:system-ui;padding:40px">Page introuvable. <a href="/">Retour à Insights French Tech</a> · <a href="/startups">Startups</a> · <a href="/fonds">Fonds</a> · <a href="/levees">Levées</a></p>`);
  }
  res.setHeader("Content-Type", out.type || "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800");
  res.status(200).send(out.body);
};
