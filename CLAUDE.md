# maladie-masters — contexte pour les agents

Ce fichier est lu automatiquement par Claude Code. `AGENTS.md` renvoie ici pour
les autres agents. Le [README](README.md) explique le fonctionnement aux
humains. Ce fichier-ci résume ce qu'il faut savoir **avant de toucher au
code**.

## Le produit

Un TCG dont les cartes sont des maladies importées de Wikipédia : ~12 000 items
Wikidata qui ont un article en français, en anglais ou en chinois. La rareté
vient de la popularité : plus une maladie est lue (vues sur 60 jours,
additionnées sur les 3 Wikipédias), plus sa carte est rare.

Règles par défaut, toutes réglables dans le panel admin (table `game_settings`) :

- **Paquets** : 1 paquet toutes les 10 min, 10 stockés au maximum.
- **Booster** (`game_settings.pack_slots`, JSON `[{ count, weights }]`), calqué
  sur Magic et Pokémon. Le défaut est `DEFAULT_PACK_SLOTS` dans
  `src/cards/rarity.ts` :
  - 3 emplacements de communes (95 % C / 5 % U) ;
  - 1 emplacement de peu communes (90 % U / 10 % R) ;
  - 1 emplacement rare (84,3 % R / 14 % E / 1,7 % L).

  Seul l'emplacement rare donne Épique ou Légendaire : un Épique tous les ~7
  paquets, un Légendaire tous les ~60. Ces taux ont été vérifiés sur 610
  paquets réels.
- **Shiny** : chaque carte tirée a une chance sur `shinyOneIn` (10 000 par
  défaut, réglable) d'être shiny, quelle que soit sa rareté (`rollShiny`).
  - Le shiny est un attribut de **l'exemplaire**, pas de la carte du
    catalogue. Il est stocké dans `PackOpeningCard.isShiny` et
    `UserCard.shinyQuantity` ; une même maladie peut être possédée normale et
    shiny.
  - Un admin peut débloquer un exemplaire shiny (`shiny: true`).
  - Côté front, une carte shiny a les couleurs inversées
    (`filter: invert(1)`), un cadre irisé et un badge ✦. Pour un rendu sépia,
    une ligne CSS suffit.
- **Ordre des cartes** : de la plus commune à la plus rare. Le backend trie
  (`byRarityAscending`) avant d'enregistrer les `slot`, et le front retrie
  aussi.
- **Emplacement épuisé** : si sa rareté n'a plus de carte, il prend la rareté
  disponible la plus proche, vers le bas d'abord (`nearestAvailable`). Il ne
  tire jamais au hasard parmi toutes les raretés.
- **Paquets bonus** : donnés par un admin, hors plafond.
- **Raretés** : COMMON < UNCOMMON < RARE < EPIC < LEGENDARY. Les parts du
  catalogue sont 1/4/10/25 % du haut du classement de popularité ; le reste est
  COMMON.

Tout est trilingue : `fr`, `en`, `zh` (chinois simplifié). Le repli se fait sur
l'anglais.

## Structure

| Dossier | Stack | Port local |
| --- | --- | --- |
| `backend/` | NestJS 11 + Prisma 7 + PostgreSQL + firebase-admin. Calqué sur `../git-web-review/backend` | 3005 |
| `admin-panel/` | React 18 + Vite 5 + Tailwind 3. Porté de `../Agility-Pro/admin-panel` (design system Organic) | 5174 |
| `frontend/` | React 19 + Vite 7, CSS maison sans framework. Design livré par Claude Design (`design_handoff_player_frontend/`) | 5173 |
| `websocket-relay/` | Node + `ws` + ioredis, JS sans build. Calqué sur `../git-web-review/websocket-relay`, mais authentifié par ticket | 3006 |

Fichiers compose :

- `docker-compose.yml` : la base, sans ports.
- `docker-compose.override.yml` : les ports en local. Postgres est sur
  127.0.0.1:5433, Redis sur 127.0.0.1:6380 (le 6379 est pris par un autre
  projet).
- `docker-compose.traefik.yml` : le VPS derrière Traefik, sélectionné via
  `COMPOSE_FILE` dans `.env`. Le relais est servi sur l'hôte de l'API, chemin
  `/ws`.

## Backend : où est quoi

- `src/common/locale.ts` : `LOCALES`, `FALLBACK_LOCALE`, `fallbackChain`,
  `pickLocalized`, et la config des Wikipédias (`WIKIS`, variante `zh-cn` pour
  le chinois).
- `src/common/request-locale.decorator.ts` : `@RequestLocale()` choisit la
  langue d'une requête dans cet ordre :
  1. `?lang=` ;
  2. `user.locale` ;
  3. `Accept-Language` ;
  4. `en`.

  `LocaleQueryDto` accepte `lang`. **Toute DTO de query doit en hériter**
  (directement ou via `PageQueryDto`), sinon `forbidNonWhitelisted` rejette
  `?lang=`. Pour une route sans DTO de query, documenter avec `@ApiLocalized()`.
- `src/cards/card-mapper.ts` :
  - charger les cartes avec `include: CARD_INCLUDE` (les localisations) ;
  - les sérialiser avec `toCardDto(card, locale)` ; chaque `CardDto` porte
    `lang`, la langue réellement servie ;
  - dans l'audit et les logs, utiliser `cardLabel(card)`.
- `src/cards/localized-order.ts` : recherche par nom dans toutes les langues
  (`nameSearch`) et tri par nom localisé (`pageIdsByName`, en SQL brut).
- `src/cards/rarity.ts` et `src/packs/pack-wallet.ts` : les règles du jeu en
  fonctions pures, testées.
- La minuterie des paquets est calculée à la lecture : `packsStored` est exact
  à `packsAnchorAt`, il n'y a aucun job. L'ouverture verrouille la ligne
  `users` (`SELECT … FOR UPDATE`).
- `src/sync/disease-sync.service.ts` : l'import Wikipédia. Il est lancé par le
  cron (`src/cron`, toutes les `syncIntervalHours`), par le bouton admin ou par
  `npm run sync:diseases`.
  - **Durée** : ~30 min la première fois (résumés dans 3 langues), quelques
    minutes ensuite.
  - **Un seul import à la fois.**
  - **Garde-fou** : si Wikidata renvoie moins de 50 % des cartes connues,
    l'import échoue au lieu de tout marquer disparu.
- `src/wikipedia/` : clients Wikidata (SPARQL, une requête par motif et par
  langue, sinon timeout) et Wikipédia (lots de 50, `continue`, `maxlag`,
  retries).
- `src/admin/` : routes `/v1/admin/*`, réservées au rôle ADMIN. Toute action
  admin sur un joueur ou le catalogue passe par `AuditService.record`.
- `src/realtime/` : le temps réel.
  - Le contrat (canaux Redis et événements) est dans `realtime-events.ts`. Il
    est partagé avec `websocket-relay/` et recopié dans les fronts.
  - Publier avec `RealtimeService.toUser`, `toAdmins` ou `toEveryone`. C'est
    sans `await` et cela n'échoue jamais : publier **après** l'écriture en
    base.
  - `AuditService.record` publie déjà `audit.recorded` pour toute action
    admin.
  - Quand les droits d'un joueur changent, appeler `realtime.disconnect(userId)` :
    le relais ferme ses sockets, et le front revient avec un nouveau ticket.
  - Le ticket (`POST /v1/realtime/ticket`) est le seul endroit où le relais
    est authentifié : le relais n'appelle jamais l'API.
  - Le joueur ne reçoit **pas** `pack.opened` : un rafraîchissement du profil
    pendant la révélation dévoilerait les cartes.
- Erreurs :
  - toujours `throw new AppException(ErrorCode.X, status, message)`, avec un
    code dans `src/common/error-code.enum.ts` ;
  - les fronts traduisent le `code`, jamais le message ;
  - un nouveau code doit aussi être ajouté aux dictionnaires des fronts.
- Documentation des routes : `@ApiEndpoint({...})` et
  `@ApiAuthenticatedController` / `@ApiAdminController`, comme dans
  git-web-review.
- `src/discord/` : le bot Discord, sans gateway ni dépendance.
  - Discord POSTe les commandes slash à `/v1/discord/interactions`, signées
    Ed25519 sur le corps brut (gardé par le `json({ verify })` de `main.ts`).
    Route publique, non limitée, hors OpenAPI.
  - Commandes enregistrées au boot (`discord-commands.ts`) : `/maladie link|unlink`
    pour le joueur, `/maladie-setup channel|off|list` (Gérer le serveur).
    **En anglais uniquement**, sans `*_localizations` : un nom traduit ne
    correspondrait plus à `/maladie link` écrit sur le site.
  - Un serveur = une ligne `DiscordGuild`, plusieurs `DiscordChannel`
    (clé = id du salon, donc jamais en double). Un seul appel « membre ? » par
    serveur, puis un post par salon.
  - Une annonce est dans la langue du joueur (`User.locale`), pas du serveur.
  - Liaison : code généré sur le site (`DiscordLinkCode`, 10 min), tapé dans
    Discord. Jamais l'inverse : personne ne peut faire mentionner un autre.
  - `DiscordAnnouncerService.announceLegendaries` est appelé par
    `PacksService.open` après le commit, en tâche détachée : Discord ne doit ni
    ralentir ni faire échouer une ouverture.
  - Désactivé tant que les trois `DISCORD_*` ne sont pas renseignées.

## Modèle de données (`backend/prisma/schema/`, un fichier par modèle)

- `Card` : un item Wikidata, neutre en langue. Il porte `number`, `imageUrl`,
  `icd10`, `pageviews` (la somme des langues), `rarity`, `enabled` et
  `missingSince`. Une carte n'est **jamais supprimée** : des joueurs la
  possèdent.
  - `rarity` est la rareté effective, égale à
    `rarityOverride ?? popularityRarity`.
  - Une carte n'est tirable que si `enabled` est vrai et `missingSince` est
    nul.
- `CardLocalization` : clé `(cardId, locale)`, une ligne par langue qui a un
  article. Elle porte `name`, `pageTitle`, `wikipediaUrl`, `description`,
  `extract` et `pageviews`.
- `User` : porte `locale` (choisie à l'inscription via `Accept-Language`),
  le portefeuille de paquets et `suspendedAt`. `UserCard` porte la quantité de
  chaque carte possédée.
- `PackOpening` / `PackOpeningCard` (la rareté est figée au moment du tirage),
  `AdminAuditEntry`, `DiseaseSyncRun` (phase, compteurs, log JSON),
  `GameSettings` (une seule ligne, `id = "global"`), `AdminGrant` (par email).
- `DiscordAccount` (un compte Discord par joueur), `DiscordLinkCode`,
  `DiscordGuild` (un par serveur) et `DiscordChannel` (ses
  salons d'annonce).

## Fronts

- **Admin** :
  - `src/lib/api.ts` reprend les types des DTO backend. Il ajoute `?lang=` à
    chaque appel, d'après la langue du panneau (`setApiLocale`).
  - Les textes sont dans `src/i18n/{fr,en,zh}.ts`. `fr` définit la forme : une
    clé manquante ailleurs est une erreur de compilation. Toute nouvelle clé
    va dans les 3 fichiers.
  - Les composants UI (`src/components/ui`) viennent d'Agility-Pro.
  - Temps réel : `useAdminResource(load, deps, { live })` recharge la vue en
    silence quand un événement correspond, au plus une fois toutes les 2 s.
    Les filtres sont dans `src/lib/live.ts`. Après une reconnexion, toutes les
    vues `live` rechargent.
- **Joueur** :
  - La langue de l'interface est celle du compte (`me.locale`). Le sélecteur
    fait un `PATCH /v1/me { locale }` puis recharge.
  - Les données dépendent de `me.locale`.
  - Les textes sont dans `src/i18n/dictionaries.ts`.
  - Le style est dans `src/styles.css` : tokens CSS sur `:root` (sombre),
    basculés par `html[data-mm-theme="light"]`. Le thème est par navigateur
    (`localStorage` `mm-theme`, défaut `prefers-color-scheme`), appliqué avant
    le premier rendu par `index.html`.
  - Une carte (`src/components/CardTile.tsx`) est dimensionnée en `em` à
    partir de sa largeur (`font-size = width / 15`).
  - Discord est une section repliée du Profil (`/profil`) ; `/discord`
    redirige vers elle.
  - L'ouverture d'un paquet se révèle **carte par carte**, comme Wiki Masters
    (`src/components/PackReveal.tsx`). C'est du pur front : l'API renvoie tout
    le paquet en un appel.
    - Les effets (charge, rayons, anneaux, particules, flash) sont des appels
      Web Animations sur des refs : un re-rendu React ne les relance jamais.
      Le shiny a la plus grosse mise en scène, au-dessus de la légendaire.
    - Les cartes se retournent de la plus commune à la plus rare, triées par
      le front lui-même.
    - Le profil (`me`) n'est rafraîchi qu'à la fin, pour que la progression ne
      dévoile rien.
  - Les événements poussés passent par `src/components/Notices.tsx`. Pour le
    stock, utiliser `setWallet` (n'a aucun risque de dévoiler la révélation)
    plutôt que `refresh`.

## Commandes

Node ≥ 22.12 est requis (Prisma 7). Le Node par défaut de nvm est trop vieux :

```bash
export PATH=/home/leandre/.nvm/versions/node/v26.2.0/bin:$PATH
docker compose up -d postgres redis           # base locale :5433, Redis :6380
cd backend
npm run start:dev                             # API :3005, Swagger sur /api
npm test                                      # tests unitaires (ts-node + node:test, fichiers *.spec.ts)
npm run build && npm run sync:diseases        # import Wikipédia au premier plan
npm run openapi:generate                      # contrat OpenAPI sans base ni Firebase
cd ../admin-panel && npm run build            # tsc + vite
cd ../frontend && npm run build
cd ../websocket-relay && npm test             # REDIS_PASSWORD=… npm run dev pour le lancer
```

## Pièges connus

- **Le hook RTK filtre la sortie de `tsc`.** Il affiche « No errors found »
  même quand ce n'est pas vrai. Utiliser
  `rtk proxy ./node_modules/.bin/tsc --noEmit -p tsconfig.build.json`.
- **Prisma accepte des `select` invalides sans erreur de typage.** Un champ
  supprimé peut survivre à `tsc`. Après un changement de schéma, faire un
  `grep` sur l'ancien nom.
- **`prisma migrate dev` refuse de tourner en non-interactif** dès qu'une
  migration perd des données. Il faut générer le SQL avec
  `./node_modules/.bin/prisma migrate diff --from-config-datasource --to-schema prisma/schema --script`,
  écrire la migration à la main (copie des données incluse), puis lancer
  `prisma migrate deploy` et `prisma generate`.
- **Ne pas démarrer le serveur pendant un import lancé en CLI.** Au boot, le
  cron marque en échec les imports restés `RUNNING`.
- **Firebase n'est pas configuré en local** (pas de `secrets/`). Pour tester
  l'API de bout en bout, démarrer l'app Nest en remplaçant
  `FirebaseService.verifyToken` par un stub (le token `alice` devient
  `alice@test.dev`), avec `ADMINS=admin@test.dev`. Ce script reste hors du
  dépôt.
- **`.env` racine : valeurs entre guillemets.** Docker retire les guillemets,
  pas un `grep | cut`. Le `DATABASE_URL` de `backend/.env` ne correspond pas
  forcément au mot de passe de la base Docker.
- **`REDIS_PASSWORD` est obligatoire pour compose** (`:?`), y compris en local.
  `backend/.env` doit avoir le même que le `.env` racine.
- **Chromium headless ne s'affiche pas dans cet environnement** : il n'y a pas
  de validation visuelle automatisée des fronts.
- **Données Wikidata discutables** : certaines entrées classées « maladie »
  (paraphilies, par ex. « Zoophilie », « BDSM ») sortent légendaires. On les
  désactive depuis le panel (Cartes) ; pas de filtre codé en dur.
- **Wikimedia demande un contact dans le User-Agent** (`WIKIMEDIA_CONTACT`). Ne
  jamais y mettre l'email de l'utilisateur sans son accord.

## Conventions

- **Code et commentaires en anglais.** Les docs (`README`, `DESIGN_BRIEF`) sont
  en français.
- **Commentaires** : expliquer le pourquoi, dans le style des projets de
  référence.
- **Pas de commit sans demande explicite.**
