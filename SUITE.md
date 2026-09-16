# Où on en est, et la suite

Mis à jour le 17 septembre 2026, à la fin de la session qui a mis le site sur notacent.app.

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

### 1. Fiches non réclamées et prospection (à attaquer demain)

Le problème : 11 apps. Personne, humain ou IA, ne recommande un annuaire à 11 fiches.

Le mécanisme : une fiche créée sous un compte maker avec son identifiant GitHub, sans jeton. Quand il se connecte, le compte fusionne (le upsert sur github_id existe déjà dans le callback) et la fiche est à lui. Réclamer = se connecter.

À coder :
- Table `outreach` : app_id, email, sent_at, status (listed / sent / claimed / no / ignored), note.
- Page privée `/coulisses` réservée au login `ADMIN_LOGIN`. Trois colonnes, clavier : J/K pour naviguer, L lister, E composer le mail, X ignorer.
- Recherches prêtes via l'API GitHub Search : apps Mac SwiftUI actives depuis 6 mois avec < 50 étoiles ; outils CLI Rust/Go ; repos avec un `CLAUDE.md` ; etc. Score pépite = durée × activité ÷ (étoiles + 5).
- Chaque candidat : nom, phrase, langage, étoiles, premier et dernier push, site, nombre de contributeurs, email public du profil GitHub (l'email des commits derrière une case à cocher).
- Lister : lit les dates de commit avec le jeton admin, crée la fiche en pointillé « non réclamée » (déjà rendue par Row.astro via la mention).
- Composer : texte brut personnalisé avec les vrais chiffres (rang, jours, série), bouton copier + export CSV pour Mailmeteor. Un mail par maker, jamais de relance automatique.
- Un « non » retire la fiche et bloque le login de ce github_id.
- Une fiche non réclamée n'a ni tampon « à reprendre » ni lien dofollow tant que le maker n'a pas mis son URL.

Envoi : depuis le Gmail de Gabriel avec Mailmeteor (50 par jour max), pas via Resend (interdit pour la prospection). Plus tard : domaine dédié + Google Workspace + chauffe, le montage PeerPush.

Texte de référence :

> Bonjour Léa,
> J'ai trouvé Sémaphore sur GitHub : 167 jours de commits depuis janvier, 19 semaines d'affilée. Ça méritait une fiche sur Not a Cent, un annuaire où on classe les apps par travail vérifié, pas par revenu. Elle est 2e des apps Mac.
> notacent.app/app/semaphore
> C'est gratuit, ça ne le sera jamais. Si tu te connectes avec GitHub, la fiche est à toi : une phrase, une image, et un badge « 167 jours actifs, vérifié » pour ton README. Si tu préfères qu'elle disparaisse, réponds « non » et je la retire.
> Gabriel

Objectif : 100 apps listées, rituel hebdo ensuite.

### 2. Indexation et découverte par les IA (dix minutes, à faire demain aussi)

- Bing Webmaster Tools : https://www.bing.com/webmasters, import depuis Search Console. C'est l'index de ChatGPT.
- IndexNow (clé + ping à chaque nouvelle fiche), petit ajout au cron.
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

- Secrets sur Vercel : STRIPE_SECRET_KEY (clé restreinte), STRIPE_WEBHOOK_SECRET, SPONSOR_PRICE_CENTS=2900, RESEND_API_KEY, ALERT_FROM, CRON_SECRET, GitHub App.
- Installation et branchements : INSTALLATION.md.
- Mockup de référence (canvas) : https://claude.ai/artifact/WqpFyx2GvMMkkGrkBvXgRA
- Le cron local passe par les jetons utilisateur (pas de clé privée GitHub App en local), en prod par le jeton d'installation.
