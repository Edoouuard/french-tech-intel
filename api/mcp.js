// Serveur MCP hébergé : https://www.insights-french-tech.com/mcp (Streamable HTTP, sans état).
// Les données viennent des lignes *_BASE d'index.html : chaque mise à jour hebdomadaire du site
// redéploie la fonction avec les nouvelles levées.
const fs = require("fs");
const path = require("path");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const Insights = require("../lib/insights.js");
const { build } = require("../lib/model.js");
const { createServer } = require("../lib/tools.js");
const VEH = require("../data/vehicles.json");

let cache = null;
function load() {
  if (cache) return cache;
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const INS = Insights.parse(html);
  INS.meta.url = "https://www.insights-french-tech.com/";
  const deployedAt = new Date().toISOString();
  cache = { INS, M: build(INS, VEH), deployedAt };
  return cache;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (req.method === "OPTIONS") return res.status(204).end();
  const data = load();
  if (req.method === "GET") {
    return res.status(200).json({
      name: "insights-french-tech", transport: "streamable-http", endpoint: "/mcp",
      deals: data.INS.meta.counts.deals, latest_month: data.INS.meta.latest_deal_month,
      docs: "https://www.insights-french-tech.com/#mcp",
    });
  }
  if (req.method !== "POST") return res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
  try {
    const server = createServer({ M: () => data.M, INS: () => data.INS, lastRefresh: () => ({ ok: true, source: "déploiement du site", at: data.deployedAt }) });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { transport.close(); server.close(); });
    await server.connect(transport);
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);
    await transport.handleRequest(req, res, body);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
  }
};
