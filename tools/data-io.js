// Lecture / écriture des lignes de données `var XX_BASE=[…];` d'index.html.
// Chaque jeu de données tient sur une seule ligne : on remplace la ligne entière,
// sans toucher au reste du fichier.
const fs = require("fs"), path = require("path");
const INDEX = path.join(__dirname, "..", "index.html");

function readHtml() { return fs.readFileSync(INDEX, "utf8"); }

function lineOf(lines, name) {
  const re = new RegExp("^var " + name + "\\s*=");
  const i = lines.findIndex((l) => re.test(l));
  if (i < 0) throw new Error(name + " introuvable dans index.html");
  return i;
}

function load(name, html = readHtml()) {
  const lines = html.split("\n");
  const l = lines[lineOf(lines, name)];
  const body = l.slice(l.indexOf("=") + 1).trim().replace(/;\s*$/, "");
  return JSON.parse(body);
}

function save(updates) {
  const lines = readHtml().split("\n");
  for (const [name, arr] of Object.entries(updates)) {
    lines[lineOf(lines, name)] = "var " + name + "=" + JSON.stringify(arr) + ";";
  }
  fs.writeFileSync(INDEX, lines.join("\n"));
}

module.exports = { load, save, INDEX };
