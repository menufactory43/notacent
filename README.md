# Not a Cent

Un annuaire d'apps peaufinées pendant des mois, pour pas un centime. On ne classe pas par revenu : on lit le repo GitHub et on compte les jours actifs.

Astro sur Vercel, français et anglais. Fond blanc, bords tracés à la main, chiffres bien droits.

## Lancer

    npm install
    npm run dev

## Feuille de route

1. Projet Astro bilingue déployé à vide.
2. Connexion GitHub et liste des repos à cocher.
3. Lecture du repo et calcul des métriques : jours actifs, durée de vie, commits, série max.
4. Fiche et formulaire à quatre champs : lien, image, « ce qui m'a pris le plus de temps », outil.
5. Classement réel, exclusion des payants, statut après 90 jours.
6. Le geste « bravo » et le compteur.
7. Cron quotidien et fil d'activité.
8. Fiche sponsorisée via Stripe Checkout. ← reste à faire
9. Serveur MCP public (`/api/mcp`) pour ChatGPT, Claude et les autres assistants.

Les étapes 2 à 7 sont codées. Elles s'activent dès que l'app GitHub est branchée : voir INSTALLATION.md.

Le site ne se liste pas lui-même : son repo est public, ça suffit.

## Serveur MCP

Le site expose un serveur [MCP](https://modelcontextprotocol.io) sans état ni authentification sur `/api/mcp`
(Streamable HTTP, réponses JSON). Quatre outils, tous en lecture : `search_apps`, `get_app`, `top_apps`,
`how_to_submit`. Il sert exactement ce que les pages montrent ; publier une app passe toujours par GitHub.

    node scripts/mcp-smoke.mjs                                 # contre le serveur de dev
    node scripts/mcp-smoke.mjs https://notacent.vercel.app/api/mcp

Pour l'essayer dans Claude Code : `claude mcp add --transport http notacent https://notacent.vercel.app/api/mcp`.
Soumission aux annuaires : voir INSTALLATION.md.
