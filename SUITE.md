# Où on en est, et la suite

Mis à jour le 21 septembre 2026, à la fin de la session qui a codé les pages « alternative à », la page Chiffres et le badge Markdown.

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
- La fiche dit d'où vient le chiffre : « lu le », commits, auteurs, et la part du maker quand elle tombe sous 80 % des commits. Le calendrier des jours actifs sur 53 semaines est le visuel à partager. La page /methode explique tout. Jusqu'à deux co-makers par fiche (table `makers`), ajoutés par login depuis la page de modification, visibles à leur première connexion, avec droit de modification ; leurs commits comptent dans la part du maker. Une personne à deux comptes GitHub se règle pareil.

Le rituel :
1. `npm run prospect`, puis dans `/coulisses`, lister les 200 à 300 candidats qui tiennent la route (une vraie app, un vrai site). Le site paraît vivant, Google indexe autant de pages en plus.
2. Écrire à la main aux 50 meilleures fiches, celles qui ont une adresse et un score haut. Le mail vend le badge et le rang, pas la fiche. 5 par jour la première semaine, 10 la deuxième, 20 ensuite. Un mail par maker, jamais de relance.
3. Lancer sur Show HN et Product Hunt une fois que l'annuaire a l'air plein, le classement comme angle.

Envoi : depuis un Google Workspace sur un domaine cousin (notacent.co ou équivalent, environ 10 € l'an plus 7 € le mois), SPF, DKIM et DMARC posés dès le premier jour, jamais depuis notacent.app ni Resend (interdit pour la prospection). Pas de publipostage ni de pixel d'ouverture : la seule mesure qui compte, c'est `claimed`, et le site la connaît seul. À 50 par jour en continu, et seulement là, Instantly avec trois boîtes.

Une règle GitHub à respecter : ses conditions interdisent d'utiliser les données de l'API pour du mail non sollicité en masse. Ce qui nous protège : volume faible, un mail écrit pour une personne, une fiche déjà créée pour elle, un « non » qui efface tout.

Objectif : 300 fiches listées, 100 réclamées, rituel hebdo ensuite.

### 1 ter. Les permissions GitHub, réduites au minimum (codé, à brancher côté GitHub)

Ce que voit un maker, dans l'ordre : un écran « Public data only » à la connexion (OAuth App sans scope), puis la liste de ses repos publics, lus avec le jeton serveur comme n'importe qui peut les lire. Aucune installation, aucun jeton gardé à son nom. Un repo privé, et seulement lui, passe par l'installation de la GitHub App en « Metadata » seule : GitHub n'y donne que les statistiques, commits par jour sur 52 semaines et par semaine avant, jamais le contenu. Le registre `active_dates` garde les jours exacts déjà connus et le cron l'allonge chaque nuit. Les statistiques par contributeur ne se calculent pas sur certains repos (GitHub répond 202 sans fin) : dans ce cas on garde le nombre de commits déjà connu, et les jours viennent de l'activité de l'année, robots compris, on n'y peut rien.

À faire sur GitHub (INSTALLATION.md, 1a et 1b) : créer l'OAuth App et poser ses deux secrets sur Vercel ; sur la GitHub App, retirer « Contents », décocher « Request user authorization during installation », poser le Setup URL.

Trouvé en route : les jours actifs comptent tous les commits humains de la branche, quel que soit l'auteur. Dictus desktop porte l'historique de Handy (cjpais, 487 commits) sous le nom de Pierre (177). Question ouverte : compter seulement les commits du maker, ou afficher le nombre de contributeurs sur la fiche.

### 2. Indexation et découverte par les IA (dix minutes, à faire demain aussi)

- Bing Webmaster Tools : fait le 17 septembre 2026, importé depuis Search Console. C'est l'index de ChatGPT.
- IndexNow : fait. Clé `INDEXNOW_KEY`, servie sur `/indexnow.txt`, ping à chaque fiche listée, publiée ou modifiée, et toutes les pages après le cron. Vérifier sur Bing Webmaster (onglet IndexNow) que les envois arrivent.
- Vérifier que le domaine Resend est « Verified » sur https://resend.com/domains.

### 2 bis. Avant de télécharger : App Store et notarisation (codé, à migrer puis à déployer)

Venu d'un commentaire sur X : « notarized or App Store, c'est la première chose que je vérifie avant de télécharger une app Mac d'un indépendant ». C'est la même promesse que le reste du site — une donnée vérifiée, pas déclarée — appliquée au moment où quelqu'un s'apprête à ouvrir un binaire inconnu.

Deux signaux, deux niveaux de preuve, et la fiche dit lequel :
- **App Store** : le maker colle le lien de sa fiche dans la page de modification, on le vérifie chez Apple à chaque lecture (`itunes.apple.com/lookup`, API publique, sans clé). Un lien qui ne mène à rien est refusé à la saisie. Nom et éditeur affichés tels qu'Apple les renvoie. Vérification pleine.
- **Notarisation** : sur un repo public d'app Mac, on lit l'arborescence puis jusqu'à quatorze fichiers de publication (workflows, `scripts/`, `Makefile`, `tauri.conf.json`…) et on y cherche `notarytool`, `stapler staple`, `altool --notarize-app`, une action de notarisation ou les identifiants qui vont avec. Trouvé : la fiche l'écrit et lie le fichier. Certificat Developer ID sans notarisation : « signée seulement », distingué, parce que depuis macOS 10.15 ça ne passe plus Gatekeeper. Preuve indirecte, dite comme telle.

Mesuré sur quatorze vrais repos Mac : Loop, exelban/stats (Makefile), ollama (`scripts/create-dmg.sh`), Zed et Pake détectés, aucun faux positif. Maccy, QuickRecorder, Gifski, BetterDisplay n'ont aucun script de publication dans le repo (ils signent depuis leur machine) : la fiche dit « repo lu le X, rien trouvé », jamais « pas signée ». Se limiter aux `.github/workflows` ratait Zed, stats et ollama : d'où l'élargissement aux scripts appelés par les workflows.

Ce que ça donne : une ligne « avant de télécharger » sur la fiche Mac, un tampon dans le classement, une page `/intention/signed` (« Signées : App Store ou notarisées ») avec son alerte et son RSS comme les autres, `appStore` et `macSigning` dans le MCP, une section sur `/methode` qui dit ce que ça ne prouve pas (on ne télécharge aucun binaire, on n'en vérifie aucun ticket : il faudrait un Mac, le serveur n'en est pas un). Relu une fois par semaine par fiche, pas chaque nuit : l'arborescence plus quatorze fichiers, c'est une à quatre secondes.

À faire : `npm run migrate` (trois colonnes : `store_url`, `store`, `notarized`), déployer, puis remplir le champ « Lien App Store » sur les fiches qui en ont une. Angle de post X : le seul annuaire qui te dit si le DMG est signé avant que tu cliques.

### 3. Pages « alternative à » (codé le 21 septembre 2026, à remplir)

C'est la requête la plus fréquente qu'un assistant reçoit. Un champ « Alternative gratuite à » sur la page de modification, trois noms au plus. Chaque nom devient une page `/alternative-a/notion` (et `/en/…`) sur le moule des pages Parcourir : classement, ItemList, RSS, alerte. La page n'existe que si une app s'en réclame, sinon 404 : pas de page vide à indexer. Deux orthographes du même produit donnent une seule page (la base garde le nom et son segment côte à côte, `alternative_to` et `alt_slugs`, et reprend l'orthographe déjà écrite). Une app terminée reste une alternative : ces pages ne filtrent pas sur « en cours ».

Branché partout : ligne sur la fiche, colonne dans Parcourir, sitemap, llms.txt, IndexNow, `freeAlternativeTo` dans le MCP et dans les données structurées, et `search_apps` trouve « notion ».

L'admin peut modifier une fiche non réclamée (bouton « ✎ remplir » dans les coulisses) : sans ça, quatorze fiches sur vingt-six n'auraient personne pour remplir le champ. Pour cette raison les pages disent « listées comme alternative à », jamais « leur maker dit ».

À faire : remplir le champ sur les vingt-six fiches, en commençant par les siennes. Une page à une app vaut déjà mieux que pas de page. `/coulisses` affiche le compte.

### 3 bis. Le badge, en Markdown (codé le 21 septembre 2026)

Un README s'écrit en Markdown et la fiche ne donnait que du HTML. Le bloc montre maintenant le vrai SVG, la ligne Markdown d'abord, la ligne HTML ensuite, un bouton copier sur chacune. Le même bloc s'affiche en haut de la page de modification juste après une réclamation : c'est le moment où le maker a son README ouvert à côté.

Le cron lit chaque nuit le README des repos publics réclamés et note la première fois qu'il y voit le badge ou le lien de la fiche (`badge_at`, remis à zéro s'il disparaît). La fiche le dit (« vu dans le README le… »), `/coulisses` affiche le total. C'est la mesure de la prospection qui compte après `claimed` : un lien entrant depuis github.com.

### 3 ter. La page Chiffres (codée le 21 septembre 2026)

`/chiffres`, `/en/chiffres`, `/chiffres.json`. Ce qu'on cite, ce n'est pas un annuaire, c'est un chiffre : jours de commits en médiane derrière une app gratuite, quartiles, durée de vie, part sous vingt étoiles, part à un seul auteur, répartition par jour de la semaine, tableaux par plateforme et langage. Médianes, pas moyennes ; l'effectif à côté de chaque chiffre ; aucun groupe de moins de trois apps ; les repos privés sortis du calcul par jour de semaine (leurs vieux jours sont notés au dimanche). Données structurées `Dataset`, licence CC BY 4.0, une phrase prête à coller, et une section « ce que ces chiffres ne disent pas ». Un bandeau prévient tant qu'il y a moins de cent apps.

Premier relevé, 25 apps : 103 jours en médiane, 6 mois, 92 % sous vingt étoiles, 27 % du travail le week-end (29 % si c'était au hasard : ils ne travaillent pas plus le week-end, contrairement à ce qu'on croit). C'est un angle de post.

### 3 quater. Le courrier (réglé le 21 septembre 2026)

La prospection part de `gabriel@getnotacent.com`, Google Workspace, MX, SPF et DKIM en place. `getnotacent.com` redirige vers notacent.app (il répondait 404 : un maker qui tapait le domaine de l'expéditeur tombait sur rien). Le bouton « ouvrir dans Gmail » force ce compte (`authuser`). `notacent.app` n'a pas de MX, exprès : seul Resend y envoie, depuis `send.notacent.app`. À poser un jour : un DMARC sur getnotacent.com.

### 4. Se lister partout

Quand l'annuaire a l'air plein (300 fiches listées), dans cet ordre, avec le même texte partout : « ranked by verified work in the repo, not revenue ».

1. Hacker News, en Show HN. Le public exact : des devs qui ont un repo et une app. Un seul essai, le matin heure US.
2. Product Hunt, le même jour ou le lendemain, pour la portée et le badge.
3. Les petits, une matinée, un par un, chacun donne un lien et une poignée de visites : Peerlist, DevHunt, Uneed, Microlaunch, TinyLaunch, Fazier, LaunchIgniter, Tiny Startup, PeerPush, TrustMRR.
4. Rendement faible, coût nul : Indie Hackers, r/SideProject, Betalist, SideProjectors, SaaSHub, Toolfolio, SaaS Genius, les annuaires de LaunchDirectories.
5. Non : There's an AI for that, on n'est pas un outil d'IA.

Pour le MCP : Smithery, mcp.so, Glama, PulseMCP, et la soumission ChatGPT Apps décrite dans INSTALLATION.md.

Ceux qu'on étudie plutôt qu'on n'utilise : TrustMRR et PeerPush sont nos voisins directs. OpenAlternative et AlternativeTo sont le modèle des pages « alternative à » de l'étape 3, et la preuve que c'est la requête que les gens tapent.

Vérifié le 17 septembre 2026, à ne pas refaire : les sites de lancement ne sont pas une source de candidats pour la prospection. Uneed, Microlaunch, TinyLaunch, DevHunt, Peerlist, PeerPush, Fazier et LaunchIgniter n'ont ni flux RSS ni lien GitHub sur leurs pages produit (au mieux l'URL du site, rendue côté client). OpenAlternative a un flux et le repo de chaque outil, mais il liste des projets établis : sur 49 outils du flux, 44 avaient plus de 80 étoiles, les autres étaient trop jeunes ou portés par une organisation. Zéro candidat. La recherche GitHub reste la seule source.

### 4 bis. X, le rituel et la règle du tweet

Le compte perso de Gabriel, pas un compte de marque. X Premium (environ 10 € par mois), le seul abonnement à prendre. Un rituel : chaque semaine, le classement en image (générée par le site, comme les cartes OG), les trois tampons, les makers tagués, le lien en première réponse. Entre deux, une pépite et une question. Une fois, quand l'annuaire a l'air plein, le post de lancement : pourquoi le travail vérifié plutôt que le revenu. Blotato est branché pour planifier.

Ce que dit l'algorithme publié en 2026 (dépôt xai-org/x-algorithm, réécriture en Rust et Python de janvier 2026, mises à jour en mai et août ; le code de 2023 est obsolète) :

- Score = Σ poids × probabilité prédite de chaque action. Positives : like, réponse, repost, citation, partage, partage par DM, copie du lien, clics, attention. Négatives : « pas intéressé », masquer, bloquer, signaler, et « pas lu » (not dwelled). Les négatives pèsent beaucoup plus lourd. Les poids chiffrés qui circulent (réponse 13,5, réponse de l'auteur 75, signalement moins 369) viennent du code de 2023 ; en 2026 ce sont des paramètres non publiés, l'ordre de grandeur tient, pas les chiffres.
- Le temps de lecture est un signal : un post survolé compte contre toi. Écrire dense, lu jusqu'au bout.
- Le partage par DM et la copie du lien comptent. Faire un format qu'on envoie à quelqu'un.
- Un nouvel auteur avec peu d'impressions reçoit un coup de pouce de position : les premiers posts ont une chance qu'ils n'auront plus.
- Un même auteur répété dans le fil est décoté, avec un plancher : un post fort par jour, pas cinq.
- Le hors-réseau est décoté et ne passe que par un lien au second degré (un abonnement du lecteur a interagi avec toi). Taguer les makers listés est le levier : leurs abonnés sont le public.
- Grok classe le contenu (catégorie, spam, ton). Un post agressif perd de la portée même s'il fait réagir.
- La visibilité est filtrée à part du classement. Le README ne dit rien de précis sur les liens ni sur Premium ; la pénalité sur les liens externes est empirique, pas dans le code.

La règle du tweet qui en sort : pas de lien dans le corps, une image, une accroche qui appelle une réponse (une question sur une app, pas une annonce), répondre à chaque réponse dans l'heure, taguer les makers, zéro hashtag, pas de « thread », 15h à 17h heure de Paris, le même jour chaque semaine.

Sources : https://github.com/xai-org/x-algorithm · https://techcrunch.com/2026/08/13/x-open-sources-its-ranking-algorithm-letting-users-see-if-theyve-been-shadowbanned/ · https://opentweet.io/blog/x-algorithm-open-source-github-2026 (avec la réserve sur les chiffres).

Canal payant à considérer après le lancement : un encart dans une newsletter de devs (TLDR, Console.dev, Bytes). Pas SuperX ni un outil de prospection : trop tôt, trop de volume pour ce qu'on fait.

### 5. Mails aux makers inscrits (via Resend, consenti)

Classement de la semaine, tampon gagné, passage en pause, avec la ligne « sponsoriser 7 jours, 29 € ». C'est le mail qui vend le sponsor. Les événements existent déjà dans la table `activity`.

### 6. Plus tard

Mise en avant payante, « à reprendre » épinglé, palier alertes payant, newsletter éditoriale hebdo opt-in, voile sur les captures claires en mode sombre.

Emplacements publicitaires, le montage TrustMRR : vignettes dans les marges sur desktop et bannières sur mobile, 20 places fixes en rotation toutes les 10 secondes, 1 499 $ le mois en libre-service Stripe, file d'attente avec 999 $ d'acompte quand c'est plein, pour 200 000 visites mensuelles (environ 15 centimes la visite). À ouvrir chez nous à partir de 20 000 visites par mois sur Vercel Analytics, au même ratio (autour de 150 € le mois pour commencer), ce qui demande de redessiner la page avec des marges. Avant ça, le spot sponsor à 29 € est la même idée à notre échelle, et une pub sur un site sans trafic est le signal inverse de ce qu'on construit.

## Repères

- Secrets sur Vercel : STRIPE_SECRET_KEY (clé restreinte), STRIPE_WEBHOOK_SECRET, SPONSOR_PRICE_CENTS=2900, RESEND_API_KEY, ALERT_FROM, CRON_SECRET, ADMIN_LOGIN, INDEXNOW_KEY, GITHUB_OAUTH_ID, GITHUB_OAUTH_SECRET, GitHub App (privés seulement).
- Installation et branchements : INSTALLATION.md.
- Mockup de référence (canvas) : https://claude.ai/artifact/WqpFyx2GvMMkkGrkBvXgRA
- Le cron local passe par les jetons utilisateur (pas de clé privée GitHub App en local), en prod par le jeton d'installation.
