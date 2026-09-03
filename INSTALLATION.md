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
