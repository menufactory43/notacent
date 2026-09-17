# Brancher GitHub

Deux applications GitHub, un rôle chacune. Le maker ne voit que l'écran le plus doux que GitHub sache afficher.

## 1a. L'OAuth App : savoir qui se connecte

Sur https://github.com/settings/developers, onglet « OAuth Apps », « New OAuth App » :

| Champ | Valeur |
|---|---|
| Application name | `Not a Cent` |
| Homepage URL | `https://notacent.app` |
| Authorization callback URL | `https://notacent.app/api/auth/callback` |
| Enable Device Flow | décoché |

Aucun scope n'est demandé à la connexion : l'écran GitHub dit « Public data only ». Note le Client ID, génère un Client Secret :

```
printf "Iv…" | npx vercel env add GITHUB_OAUTH_ID production --yes
pbpaste | npx vercel env add GITHUB_OAUTH_SECRET production --yes
```

Tant que ces deux variables manquent, le site se rabat sur l'OAuth de la GitHub App (écran « Act on your behalf »).

## 1b. La GitHub App : les repos privés seulement

Sur https://github.com/settings/apps, l'app existante « Not a Cent » (ou une nouvelle) :

| Champ | Valeur |
|---|---|
| Callback URL | `https://notacent.app/api/auth/callback` |
| Request user authorization (OAuth) during installation | **décoché** |
| Setup URL | `https://notacent.app/ajouter`, « Redirect on update » coché |
| Webhook · Active | décoché |
| Repository permissions · Contents | **No access** (retirer, si l'app l'avait) |
| Repository permissions · Metadata | Read-only (imposé) |
| Where can this GitHub App be installed? | **Any account** |

Avec « Metadata » seul, GitHub ne donne que les statistiques du repo : commits par semaine et par jour sur un an, jamais le contenu. Retirer une permission ne redemande rien aux installations existantes. Le maker n'installe l'app que s'il veut lister un repo privé, depuis le lien de la page « Classer mon app ».

Un jeton serveur lit les repos publics, comme n'importe qui peut les lire : `GITHUB_TOKEN` (un jeton personnel sans aucun scope suffit), sinon le jeton laissé par l'admin (`ADMIN_LOGIN`) à sa connexion.

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

2. Sur https://dashboard.stripe.com/webhooks, ajoute un endpoint `https://notacent.app/api/sponsor/webhook` qui écoute `checkout.session.completed`, copie son secret de signature, puis :

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
node scripts/mcp-smoke.mjs https://notacent.app/api/mcp
```

## ChatGPT (Apps SDK)

1. https://platform.openai.com → Apps → **Submit**. Il faut un compte développeur OpenAI vérifié.
2. Serveur MCP : `https://notacent.app/api/mcp`, authentification : aucune.
3. Métadonnées : nom « Not a Cent », description « Free apps polished for months, ranked by days of work read from the repo, not by revenue », icône `public/favicon.svg`, politique de confidentialité `https://notacent.app/en/confidentialite`, pays : tous.
4. Consignes de test pour le reviewer : « Ask: *find me a free Mac app for messaging* → the assistant calls `search_apps`. Ask: *what took the maker of Correspondance the longest?* → `get_app`. » Aucun compte de test nécessaire.
5. Le tableau de bord donne l'état de la revue et les retours.

## Claude (Connectors Directory)

La soumission se fait dans Claude.ai › réglages d'organisation › Connectors, ce qui demande un plan **Team ou Enterprise**.
Même URL, même politique de confidentialité ; les outils portent déjà les annotations `readOnlyHint` que la revue exige.
En attendant, n'importe qui peut l'ajouter à la main : `claude mcp add --transport http notacent https://notacent.app/api/mcp`.

# Brancher les alertes par mail (Resend)

Les alertes sont gratuites : un filtre (outil, plateforme, langage, intention), un mail par semaine au plus, seulement quand des apps sont arrivées dedans. Elles partent à la fin du cron quotidien. Sans clé, elles sont enregistrées mais rien n'est envoyé.

1. Sur https://resend.com, crée une clé API et vérifie un domaine d'envoi, puis :

```
pbpaste | npx vercel env add RESEND_API_KEY production --yes
echo "Not a Cent <alertes@ton-domaine.fr>" | npx vercel env add ALERT_FROM production --yes
```

2. Redéploie. Le lien de désinscription est dans chaque mail (`/api/alertes?token=…&stop=1`).

# Les coulisses et la prospection

`/coulisses` n'existe que pour le login GitHub nommé dans `ADMIN_LOGIN` (404 pour tout le monde d'autre) :

```
printf menufactory43 | npx vercel env add ADMIN_LOGIN production --yes
echo "ADMIN_LOGIN=menufactory43" >> .env.local
```

Le même jeton que cet admin a laissé en se connectant sert au cron pour relire, chaque nuit, les fiches non réclamées (elles n'ont pas de jeton à elles).

Chercher des candidats, en local, avec le jeton de `gh auth login` (ou `GITHUB_TOKEN` dans `.env.local`) :

```
npm run prospect                      # toutes les recherches, 40 candidats retenus chacune
npm run prospect -- mac cli-rust      # seulement celles-là
npm run prospect -- --limit 10        # plus court
```

Rien n'est publié par le script : lister, composer le mail et marquer envoyé se font dans `/coulisses`, à la main. L'export CSV des fiches listées avec une adresse est sur `/api/coulisses`.

# IndexNow (Bing, et donc ChatGPT)

Une clé de 32 caractères hexadécimaux, servie sur `/indexnow.txt` pour prouver qu'elle est à nous. Le site la pousse lui-même à chaque fiche listée, publiée ou modifiée, et pour toutes les pages à la fin du cron.

```
KEY=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
printf "$KEY" | npx vercel env add INDEXNOW_KEY production --yes
echo "INDEXNOW_KEY=$KEY" >> .env.local
```

Les envois se vérifient sur https://www.bing.com/webmasters, onglet IndexNow.
