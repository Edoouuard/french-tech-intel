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
| `api/pages.js`, `lib/pages.js` | Pages indexables rendues côté serveur depuis les données d'`index.html` : `/startup/<slug>`, `/fonds/<slug>` (investisseurs avec au moins 3 deals, hors business angels individuels), `/levees/<AAAA-MM>`, les index `/startups`, `/fonds`, `/levees`, et `/sitemap.xml`. Routage dans `vercel.json`, cache CDN jusqu'au déploiement suivant : rien à régénérer après une mise à jour des données. |
| `robots.txt` | Autorise l'indexation (hors `/api/`) et déclare le sitemap. |
| `data/vehicles.json` | Fonds en déploiement, lus par le serveur MCP. |
| `data/public-profiles.json` | Profils publics des fonds les plus actifs (véhicule concerné, ticket, stades, réinvestissement, rôle, source), uniquement ce que dit la source citée, affichés sur les fiches sans comparaison avec les deals, qui sont rattachés à la société de gestion tous fonds confondus. `npm run rebuild` en génère `assets/public-profiles.js`. |

## Mise à jour hebdomadaire des données

Ajouter les nouvelles levées à la fin du tableau de la ligne `var LD_BASE=[…];` et les opérations à celle de `var MD_BASE=[…];`, directement dans `index.html`, sans reformater les lignes. Le format d'une levée :

```json
{"s":"Startup","t":"IA","p":"Pitch en une phrase.","m":3,"i":"Fonds A, Fonds B","stade":"Seed","mo":9,"an":2026,"j":21}
```

Chaque commit redéploie le site et le serveur MCP avec les nouvelles données.

Pour modifier les données par script, `tools/data-io.js` lit et réécrit une ligne `*_BASE` sans toucher au reste du fichier :

```js
const d = require("./tools/data-io");
const L = d.load("LD_BASE");
L.push({ s: "Startup", t: "IA", p: "…", m: 3, i: "Fonds A", stade: "Seed", mo: 11, an: 2026, j: 18 });
d.save({ LD_BASE: L });
```

La procédure complète suivie par la tâche planifiée (sources, rapprochement semaine par semaine, règles anti-doublons) est dans `docs/mise-a-jour-hebdo.md`.

Avant chaque commit de données, lancer `npm run check` (`tools/check-data.js`) : JSON valide, champs plausibles, doublons (même société à moins de 120 jours), tirets cadratins, et couverture par mois et par semaine pour repérer une mise à jour qui décroche. Le script sort en erreur sur un doublon certain ou une donnée invalide.

Conventions : `j` (jour) est toujours renseigné sur les nouvelles levées ; quand seule la semaine est connue, `j` vaut le vendredi de la semaine et `"jw":1` le signale. Les stades suivent `STAGE_ORDER` d'`assets/app.js` (au-delà de la Série C : `Growth`, extension ou obligations convertibles : stade vide). L'annonce d'une prise de participation sans montant (ex. un corporate qui annonce entrer au capital) n'a pas de ligne propre si le tour chiffré correspondant est publié dans les mois qui suivent : on garde uniquement le tour chiffré.

## Modifier l'interface

Éditer `src/shell.html` ou `assets/app.js`, puis `npm run rebuild` pour régénérer `index.html` : les lignes de données actuelles sont conservées telles quelles.

## Serveur MCP

URL : `https://www.insights-french-tech.com/mcp` (Streamable HTTP, sans authentification). Mode d'emploi dans l'onglet « MCP » du site.

28 outils (levées, investisseurs, fonds européens, exits, dossier de levée, nouveautés de la semaine, comparaison de fonds, co-investisseurs, tour suivant, tendances sectorielles, acquéreurs probables), 4 parcours guidés (`preparer_levee`, `brief_investisseur`, `veille_hebdo`, `strategie_sortie`) et la ressource `insights://methodologie`. Code dans `lib/model.js` et `lib/tools.js`.

Mesure d'usage : `lib/mcp-tracking.js` envoie un événement Vercel Web Analytics par connexion (« MCP connexion » : nom et version du client), par appel d'outil (« MCP outil » : outil, paramètres résumés, client, résultat ok / vide / introuvable, durée) et par parcours guidé (« MCP parcours »). À consulter dans Vercel > Analytics > Events. Rien n'est envoyé hors de Vercel (tests locaux).

```bash
npm install
npm run mcp:test                                              # test local
node tools/test-mcp.js https://www.insights-french-tech.com/mcp   # test de la prod
```
