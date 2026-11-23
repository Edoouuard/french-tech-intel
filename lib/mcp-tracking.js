// Mesure d'usage du serveur MCP : un événement Vercel Web Analytics par connexion, par appel
// d'outil et par parcours guidé. Aucun identifiant n'est enregistré par le site : seulement
// l'outil, un résumé des paramètres, le client (Claude, ChatGPT…), le résultat et la durée.
// Les événements apparaissent dans Vercel > Analytics > Events (plan Pro).
const { track } = require("@vercel/analytics/server");

const MAX = 200; // longueur maximale d'une valeur envoyée
const cut = (s) => (s.length > MAX ? s.slice(0, MAX - 1) + "…" : s);

// Famille du client à partir du nom déclaré à l'initialisation ou du user-agent.
function clientFamily(name = "", ua = "") {
  const t = `${name} ${ua}`.toLowerCase();
  if (/claude|anthropic/.test(t)) return "Claude";
  if (/chatgpt|openai/.test(t)) return "ChatGPT";
  if (/cursor/.test(t)) return "Cursor";
  if (/vscode|visual studio|copilot/.test(t)) return "VS Code";
  if (/windsurf|codeium/.test(t)) return "Windsurf";
  if (/mistral|le chat/.test(t)) return "Mistral";
  if (/gemini|google/.test(t)) return "Gemini";
  if (/inspector/.test(t)) return "MCP Inspector";
  if (/node|python|curl|httpx|axios|undici/.test(t)) return "Script";
  return name ? cut(name) : "Autre";
}

// Résumé lisible des paramètres d'un appel, sans la pagination.
function summarizeArgs(a = {}) {
  const parts = [];
  for (const [k, v] of Object.entries(a)) {
    if (v == null || v === "" || k === "limit" || k === "offset") continue;
    parts.push(`${k}=${Array.isArray(v) ? v.join("|") : typeof v === "object" ? JSON.stringify(v) : String(v).replace(/\s+/g, " ").trim()}`);
  }
  return parts.length ? cut(parts.join(" · ")) : "(aucun)";
}

// Le résultat est-il vide ? Erreur « introuvable », total à 0, ou liste principale vide.
function outcome(result) {
  const o = result && result.structuredContent;
  if (!o || typeof o !== "object") return "ok";
  if (o.error) return "introuvable";
  if (o.total === 0 || o.returned === 0) return "vide";
  const lists = Object.values(o).filter(Array.isArray);
  if (lists.length && lists.every((l) => l.length === 0)) return "vide";
  return "ok";
}

// Crée la fonction d'envoi pour une requête HTTP donnée (en-têtes nécessaires à Vercel).
function tracker(req) {
  const ua = (req.headers && req.headers["user-agent"]) || "";
  let client = clientFamily("", ua);
  const send = (name, data) => {
    if (!process.env.VERCEL_URL) return Promise.resolve(); // hors Vercel : rien
    const p = track(name, { client, ...data }, { headers: req.headers }).catch((e) => console.error("[mcp-tracking]", e.message));
    return Promise.race([p, new Promise((r) => setTimeout(r, 800))]); // ne retarde jamais la réponse de plus de 0,8 s
  };
  return {
    setClient: (name) => { client = clientFamily(name, ua); },
    connection: (info = {}) => send("MCP connexion", { client_name: cut(String(info.name || "")), client_version: cut(String(info.version || "")) }),
    tool: (tool, args, result, ms) => send("MCP outil", { tool, params: summarizeArgs(args), result: outcome(result), ms: Math.round(ms) }),
    prompt: (prompt, args) => send("MCP parcours", { prompt, params: summarizeArgs(args) }),
  };
}

module.exports = { tracker, clientFamily, summarizeArgs, outcome };
