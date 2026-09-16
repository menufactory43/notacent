# Où on en est, et la suite

Mis à jour le 17 septembre 2026, à la fin de la session qui a codé les fiches non réclamées et les coulisses.

## Le positionnement

**Le travail vérifié, pas le revenu.** TrustMRR classe par revenu vérifié (Stripe) et vend l'entrée, la visibilité et la sortie (marché d'acquisition, commission). PeerPush fait payer la mise en ligne et vend de la visibilité auprès des IA. Nous : la donnée vérifiée, c'est le travail lu dans le repo GitHub (jours actifs, série, durée de vie). Être listé ne coûte pas un centime, et ça ne le coûtera jamais. Le zéro euro est la direction artistique, pas la promesse.

Deux publics : le maker (visibilité, SEO, badge, lien dofollow, acheteurs) et le chercheur de pépites (apps travaillées, pas encore vues, parfois à reprendre).

## Ce qui est en ligne

- Site sur https://notacent.app, redirections depuis vercel.app et www, sitemap soumis à Google Search Console.
- Étoiles GitHub et plateforme lues à la publication et chaque nuit (cron 3h17 UTC). Les étoiles ne classent pas, elles signalent « pas encore vue ».
- Accueil : hero, fil « En ce moment », bloc « ce que tu gagnes », trois tampons hebdo (app de la semaine, plus longue série, sous les radars), rangée épurée, cinq onglets, section Parcourir.
- Pages Parcourir : `/outil/x`, `/plateforme/x`, `/langage/x`, `/intention/x`, FR et EN, fil d'Ariane, ItemList, RSS par page.
- Fiche : fil d'Ariane, étoiles, badge SVG à coller (`/api/badge/<slug>.svg`), bloc « ouverte à une reprise », trois apps proches, phrase de classement.
- Alertes gratuites : email + filtre sur chaque page Parcourir, mail hebdo via Resend à la fin du cron, désinscription par lien.
- Sponsor : Stripe branché, 29 € les 7 jours, webhook sur notacent.app. Aucun paiement réel encore passé.
- MCP public sur `/api/mcp`, llms.txt, données structurées.
- Mode sombre « craie sur ardoise ».

## Ce qu'on fait payer, et quand

| Quoi | Prix | État |
|---|---|---|
| Spot sponsor, 7 jours, une seule fiche | 29 € | codé, en ligne |
| Mise en avant 7 jours dans « Pépites » | 19 € | à coder, quand > 50 apps |
| « À reprendre » épinglé 30 jours + poussé dans les alertes | 49 € | à coder, quand > 50 apps |
| Alertes acheteurs illimitées, quotidiennes, RSS, webhook | 5 €/mois ou 39 €/an | gratuit pour l'instant, palier payant quand > 100 apps |

Jamais l'entrée, jamais le badge, jamais le dofollow, jamais les tampons.

## La suite, dans l'ordre

### 1. Fiches non réclamées et prospection (codé, à déployer puis à faire tourner)

Le problème : 11 apps. Personne, humain ou IA, ne recommande un annuaire à 11 fiches.

Ce que font les annuaires pour grandir, dans l'ordre : préremplir large à partir de données publiques et laisser réclamer (AlternativeTo, Crunchbase, les annuaires MCP), le badge dans le README comme lien entrant (PeerPush, TrustMRR, Product Hunt), la donnée qu'on cite (classements, pages par catégorie), puis un lancement groupé quand l'annuaire a l'air plein. La prospection à froid n'est pas un moteur, c'est un accélérateur sur les plus belles fiches.

Le mécanisme : une fiche créée sous un compte maker avec son identifiant GitHub, sans jeton (`users.claimed = false`). Quand il se connecte, le upsert du callback retrouve le compte, le passe en `claimed`, et la fiche est à lui : il atterrit direct sur la page de modification. Réclamer = se connecter.

Ce qui est codé :
- `npm run prospect` (`scripts/prospect.mjs`) : quatorze recherches GitHub (Mac, menubar, SwiftUI, iOS, CLI Rust et Go, TUI, Tauri, Electron, MCP, indie, side-project, claude-code), filtre sur une personne, un site, une description, au plus 3 contributeurs, au moins 20 jours actifs et 2 ce mois. Score pépite = jours actifs × plus longue série ÷ (étoiles + 5). Email du profil public, sinon email des commits mis de côté. Jeton : `GITHUB_TOKEN` ou celui de `gh auth login`. Tout va dans la table `outreach`, rien n'est publié.
- `/coulisses` (login `ADMIN_LOGIN`) : trois colonnes, à lister / listées / envoyées. J K pour bouger, L lister, E composer, X ignorer. Composer génère le mail (FR ou EN selon le profil) avec les vrais chiffres et le rang, bouton copier, bouton « ouvrir dans Gmail » prérempli, « marquer envoyé ». Export CSV sur `/api/coulisses`.
- Une fiche non réclamée : bordure en pointillé et mention dans le classement, bloc « fiche non réclamée » avec le bouton « Réclamer ma fiche » à la place du badge, lien de sortie en nofollow, pas de tampon « à reprendre ». Le cron la relit chaque nuit avec le jeton de l'admin.
- « A dit non » : la fiche part, le compte fantôme est bloqué (plus jamais relisté), les adresses sont effacées. Le login reste possible : s'il vient lui-même, c'est son choix.
- Réclamée : événement « a réclamé sa fiche » dans le fil, adresses effacées, statut `claimed` dans les coulisses.
- Confidentialité : paragraphe « Les fiches non réclamées » (source, base légale, effacement, opposition en une réponse).

Le rituel :
1. `npm run prospect`, puis dans `/coulisses`, lister les 200 à 300 candidats qui tiennent la route (une vraie app, un vrai site). Le site paraît vivant, Google indexe autant de pages en plus.
2. Écrire à la main aux 50 meilleures fiches, celles qui ont une adresse et un score haut. Le mail vend le badge et le rang, pas la fiche. 5 par jour la première semaine, 10 la deuxième, 20 ensuite. Un mail par maker, jamais de relance.
3. Lancer sur Show HN et Product Hunt une fois que l'annuaire a l'air plein, le classement comme angle.

Envoi : depuis un Google Workspace sur un domaine cousin (notacent.co ou équivalent, environ 10 € l'an plus 7 € le mois), SPF, DKIM et DMARC posés dès le premier jour, jamais depuis notacent.app ni Resend (interdit pour la prospection). Pas de publipostage ni de pixel d'ouverture : la seule mesure qui compte, c'est `claimed`, et le site la connaît seul. À 50 par jour en continu, et seulement là, Instantly avec trois boîtes.

Une règle GitHub à respecter : ses conditions interdisent d'utiliser les données de l'API pour du mail non sollicité en masse. Ce qui nous protège : volume faible, un mail écrit pour une personne, une fiche déjà créée pour elle, un « non » qui efface tout.

Objectif : 300 fiches listées, 100 réclamées, rituel hebdo ensuite.

### 2. Indexation et découverte par les IA (dix minutes, à faire demain aussi)

- Bing Webmaster Tools : https://www.bing.com/webmasters, import depuis Search Console. C'est l'index de ChatGPT.
- IndexNow : fait. Clé `INDEXNOW_KEY`, servie sur `/indexnow.txt`, ping à chaque fiche listée, publiée ou modifiée, et toutes les pages après le cron. Reste à vérifier sur Bing Webmaster (onglet IndexNow) que les envois arrivent.
- Vérifier que le domaine Resend est « Verified » sur https://resend.com/domains.

### 3. Pages « alternative à » (une demi-journée)

Un champ « alternative à » sur la fiche, des pages `/alternative-a/notion`. C'est la requête la plus fréquente qu'un assistant reçoit. Même moule que les pages Parcourir.

### 4. Se lister partout

PeerPush et TrustMRR (oui), Product Hunt, Show HN, Indie Hackers, r/SideProject, les annuaires de LaunchDirectories. Pour le MCP : Smithery, mcp.so, Glama, PulseMCP, et la soumission ChatGPT Apps décrite dans INSTALLATION.md.

### 5. Mails aux makers inscrits (via Resend, consenti)

Classement de la semaine, tampon gagné, passage en pause, avec la ligne « sponsoriser 7 jours, 29 € ». C'est le mail qui vend le sponsor. Les événements existent déjà dans la table `activity`.

### 6. Plus tard

Mise en avant payante, « à reprendre » épinglé, palier alertes payant, newsletter éditoriale hebdo opt-in, voile sur les captures claires en mode sombre.

## Repères

- Secrets sur Vercel : STRIPE_SECRET_KEY (clé restreinte), STRIPE_WEBHOOK_SECRET, SPONSOR_PRICE_CENTS=2900, RESEND_API_KEY, ALERT_FROM, CRON_SECRET, ADMIN_LOGIN, INDEXNOW_KEY, GitHub App.
- Installation et branchements : INSTALLATION.md.
- Mockup de référence (canvas) : https://claude.ai/artifact/WqpFyx2GvMMkkGrkBvXgRA
- Le cron local passe par les jetons utilisateur (pas de clé privée GitHub App en local), en prod par le jeton d'installation.
