// Régénère index.html à partir de src/shell.html en conservant les lignes de données *_BASE
// actuelles d'index.html (celles que la mise à jour hebdomadaire modifie). À lancer après
// une modification de l'interface : `npm run rebuild`.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const indexPath = path.join(root, "index.html");
const html = fs.readFileSync(indexPath, "utf8");
const shell = fs.readFileSync(path.join(root, "src/shell.html"), "utf8");

// Profils publics des fonds (sites, communiqués, presse) : data/public-profiles.json → assets/public-profiles.js
const pub = JSON.parse(fs.readFileSync(path.join(root, "data/public-profiles.json"), "utf8"));
fs.writeFileSync(path.join(root, "assets/public-profiles.js"), "// Généré par tools/build.js depuis data/public-profiles.json : ne pas modifier à la main.\nwindow.IFT_PUBLIC=" + JSON.stringify(pub) + ";\n");

// Réinvestissements vérifiés (investisseurs déjà au capital lors d'une levée) : data/followons.json → assets/followons.js
const fol = JSON.parse(fs.readFileSync(path.join(root, "data/followons.json"), "utf8"));
fs.writeFileSync(path.join(root, "assets/followons.js"), "// Généré par tools/build.js depuis data/followons.json : ne pas modifier à la main.\nwindow.IFT_FOLLOWONS=" + JSON.stringify(fol) + ";\n");

const data = html.split("\n").filter((l) => /^var [A-Z][A-Z0-9_]*_BASE\s*=/.test(l));
if (!data.some((l) => l.startsWith("var LD_BASE"))) throw new Error("LD_BASE introuvable dans index.html");

const DATA = "<!-- DONNÉES : lignes mises à jour chaque semaine (LD_BASE = levées, MD_BASE = exits & M&A…). Ne pas reformater. -->\n<script>\n" + data.join("\n") + "\n</script>\n<!-- FIN DONNÉES -->";
const head = `<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<link rel="manifest" href="manifest.json">\n<link rel="icon" href="icon-192.png">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n<meta name="theme-color" content="#0A1D30">\n`;
const body = shell
  .replace("<!--@@DATA@@-->", () => DATA)
  .replace("<!--@@LIB@@-->", '<script src="assets/insights-lib.js"></script>')
  .replace("<!--@@VEH@@-->", '<script src="assets/vehicles.js"></script>\n<script src="assets/public-profiles.js"></script>\n<script src="assets/followons.js"></script>')
  .replace("<!--@@LOGOS@@-->", '<script src="assets/logos.js"></script>')
  .replace("<!--@@APP@@-->", '<script src="assets/app.js"></script>');
const split = body.indexOf("</style>") + "</style>".length;
const analytics = `\n<script>\n  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };\n</script>\n<script defer src="/_vercel/insights/script.js"></script>`;
fs.writeFileSync(indexPath, head + body.slice(0, split) + analytics + "\n</head>\n<body>\n" + body.slice(split).trimStart() + "\n</body>\n</html>\n");
console.log(`index.html régénéré · ${data.length} lignes de données conservées`);
