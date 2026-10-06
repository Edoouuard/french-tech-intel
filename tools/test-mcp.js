// Test local de api/mcp.js : sert la fonction comme Vercel (req.body, res.status/json) puis appelle quelques outils.
// Usage : npm run mcp:test  (ou node tools/test-mcp.js https://www.insights-french-tech.com/mcp pour tester la prod)
const http = require("http");
const target = process.argv[2];
const handler = require("../api/mcp.js");

async function run(url) {
  let id = 0;
  const call = async (method, params) => {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
    const j = await r.json();
    if (j.error) throw new Error(JSON.stringify(j.error));
    return j.result;
  };
  const tool = async (name, args = {}) => (await call("tools/call", { name, arguments: args })).structuredContent;
  const init = await call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  console.log("serveur :", init.serverInfo.name, init.serverInfo.version);
  console.log("outils :", (await call("tools/list", {})).tools.length);
  const d = await tool("search_deals", { limit: 3 });
  console.log("dernières levées :", d.deals.map((x) => `${x.company} ${x.amount_eur_m ?? "n.c."}M ${x.date}`).join(" | "));
  const f = await tool("find_investors", { sector: "IA", stage: "Seed", amount_eur_m: 2, limit: 3 });
  console.log("find_investors :", f.shortlist.map((x) => `${x.score} ${x.investor.name}`).join(", "));
  const s = await tool("data_status");
  console.log("données :", s.latest, s.counts.deals, "levées");
}

if (target) run(target).catch((e) => { console.error("ÉCHEC", e.message); process.exit(1); });
else {
  const srv = http.createServer(async (req, res) => {
    let raw = ""; for await (const c of req) raw += c;
    req.body = raw ? JSON.parse(raw) : undefined;
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); return res; };
    await handler(req, res);
  }).listen(0, async () => {
    try { await run(`http://localhost:${srv.address().port}/mcp`); } catch (e) { console.error("ÉCHEC", e.message); process.exitCode = 1; }
    srv.close();
  });
}
