# Insights French Tech

Intelligence de marché sur la French Tech : levées de fonds, exits & M&A, fonds VC (dont les fonds en cours de déploiement), PE Watch, comparables et acquéreurs. Site : https://www.insights-french-tech.com

## Structure

| Chemin | Rôle |
|---|---|
| `index.html` | Page publiée. Contient les données `var XX_BASE=[…];` (une ligne par jeu), mises à jour chaque semaine. |
| `assets/app.js` | Interface (vues, graphiques, fiches, recherche ⌘K, page MCP). |
| `assets/insights-lib.js` | Normalisation des données `*_BASE`, partagée avec le serveur MCP. |
| `assets/vehicles.js`, `assets/logos.js` | Fonds VC européens en déploiement (vue « Fonds européens ») et logos des investisseurs. |
| `src/shell.html` | Gabarit HTML/CSS d'`index.html`. |
| `api/mcp.js`, `lib/` | Serveur MCP hébergé sur `/mcp` (fonction Vercel). |
| `data/vehicles.json` | Fonds en déploiement, lus par le serveur MCP. |

## Mise à jour hebdomadaire des données

Ajouter les nouvelles levées à la fin du tableau de la ligne `var LD_BASE=[…];` et les opérations à celle de `var MD_BASE=[…];`, directement dans `index.html`, sans reformater les lignes. Le format d'une levée :

```json
{"s":"Startup","t":"IA","p":"Pitch en une phrase.","m":3,"i":"Fonds A, Fonds B","stade":"Seed","mo":9,"an":2026,"j":21}
```

Chaque commit redéploie le site et le serveur MCP avec les nouvelles données.

## Modifier l'interface

Éditer `src/shell.html` ou `assets/app.js`, puis `npm run rebuild` pour régénérer `index.html` : les lignes de données actuelles sont conservées telles quelles.

## Serveur MCP

URL : `https://www.insights-french-tech.com/mcp` (Streamable HTTP, sans authentification). Mode d'emploi dans l'onglet « MCP » du site.

```bash
npm install
npm run mcp:test                                              # test local
node tools/test-mcp.js https://www.insights-french-tech.com/mcp   # test de la prod
```
