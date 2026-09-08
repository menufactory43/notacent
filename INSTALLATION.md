# Brancher GitHub

Le site fonctionne avec une **GitHub App** (pas une OAuth App) : le maker l'installe sur les repos qu'il choisit, et elle ne demande que la lecture des métadonnées et du contenu, jamais l'écriture. C'est ce qui rend crédible « on ne lit jamais le code ».

## 1. Créer l'app

https://github.com/settings/apps/new (GitHub demande une vérification par e-mail avant).

| Champ | Valeur |
|---|---|
| GitHub App name | `Not a Cent` |
| Homepage URL | `https://notacent.vercel.app` |
| Callback URL | `https://notacent.vercel.app/api/auth/callback` |
| Expire user authorization tokens | décoché |
| Request user authorization (OAuth) during installation | **coché** |
| Setup URL | vide |
| Webhook · Active | décoché |
| Repository permissions · Contents | Read-only |
| Repository permissions · Metadata | Read-only (imposé) |
| Where can this GitHub App be installed? | **Any account** |

Le nom public de l'app (« slug ») apparaît dans l'URL après création, par exemple `not-a-cent`.

## 2. Les secrets, à poser toi-même

Sur la page de l'app : **Generate a new client secret**, puis **Generate a private key** (télécharge un `.pem`). Ensuite, depuis `~/notacent`, une commande par variable, pour `production` :

```
npx vercel env add GITHUB_APP_ID production
npx vercel env add GITHUB_APP_SLUG production
npx vercel env add GITHUB_CLIENT_ID production
npx vercel env add GITHUB_CLIENT_SECRET production
npx vercel env add GITHUB_APP_PRIVATE_KEY production < ~/Downloads/not-a-cent.*.private-key.pem
```

Puis redéployer : `npx vercel deploy --prod --yes`.

Pour développer en local, ajoute les mêmes lignes à `.env.local` (jamais commité) et lance `npm run dev`.

## 3. Ce qui se passe ensuite

1. « Ajouter mon app » envoie sur GitHub, qui demande d'autoriser Not a Cent.
2. Au premier passage, GitHub propose d'installer l'app sur les repos choisis.
3. Retour sur `/ajouter` : la liste des repos ouverts, à cocher.
4. Chaque repo coché est lu (dates de commit seulement), publié, puis on arrive sur sa fiche à compléter.
5. Chaque nuit à 3 h 17 UTC, le cron relit tous les repos publiés avec le jeton d'installation de l'app.

# Brancher Stripe (fiche sponsorisée)

Le code est prêt, il s'active dès que les clés existent. Sans elles, le bouton n'apparaît pas.

1. Sur https://dashboard.stripe.com/apikeys, copie la clé secrète, puis :

```
pbpaste | npx vercel env add STRIPE_SECRET_KEY production --yes
```

2. Sur https://dashboard.stripe.com/webhooks, ajoute un endpoint `https://notacent.vercel.app/api/sponsor/webhook` qui écoute `checkout.session.completed`, copie son secret de signature, puis :

```
pbpaste | npx vercel env add STRIPE_WEBHOOK_SECRET production --yes
```

3. Optionnel, pour changer le tarif (défaut : 19 € pour 7 jours) :

```
printf 1900 | npx vercel env add SPONSOR_PRICE_CENTS production --yes
printf 7 | npx vercel env add SPONSOR_DAYS production --yes
```

Puis `npx vercel deploy --prod --yes`. Le maker voit alors « Sponsoriser 7 jours » sur sa fiche. Un seul emplacement à la fois : si un sponsor est en place, le suivant prend la suite à la fin.

# Soumettre le serveur MCP aux annuaires

Le serveur (`/api/mcp`) est public, sans OAuth, en lecture seule ; la politique de confidentialité est sur
`/confidentialite` et `/en/confidentialite`. Avant de soumettre, vérifie qu'il répond en production :

```
node scripts/mcp-smoke.mjs https://notacent.vercel.app/api/mcp
```

## ChatGPT (Apps SDK)

1. https://platform.openai.com → Apps → **Submit**. Il faut un compte développeur OpenAI vérifié.
2. Serveur MCP : `https://notacent.vercel.app/api/mcp`, authentification : aucune.
3. Métadonnées : nom « Not a Cent », description « Free apps polished for months, ranked by days of work read from the repo, not by revenue », icône `public/favicon.svg`, politique de confidentialité `https://notacent.vercel.app/en/confidentialite`, pays : tous.
4. Consignes de test pour le reviewer : « Ask: *find me a free Mac app for messaging* → the assistant calls `search_apps`. Ask: *what took the maker of Correspondance the longest?* → `get_app`. » Aucun compte de test nécessaire.
5. Le tableau de bord donne l'état de la revue et les retours.

## Claude (Connectors Directory)

La soumission se fait dans Claude.ai › réglages d'organisation › Connectors, ce qui demande un plan **Team ou Enterprise**.
Même URL, même politique de confidentialité ; les outils portent déjà les annotations `readOnlyHint` que la revue exige.
En attendant, n'importe qui peut l'ajouter à la main : `claude mcp add --transport http notacent https://notacent.vercel.app/api/mcp`.
