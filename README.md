# maladie-masters

Un TCG dont les cartes sont des maladies. Le catalogue est importé de Wikipédia
(~12 000 maladies, en français, en anglais et en chinois), et la rareté vient
de la popularité des articles : plus une maladie est lue, plus sa carte est
rare.

Tout est disponible en français, en anglais et en chinois : les deux fronts, et
les cartes elles-mêmes. Voir [Langues](#langues).

Un joueur reçoit un paquet toutes les 10 minutes, jusqu'à 10 paquets stockés.
Un paquet est un booster comme dans Magic ou Pokémon, avec 3 emplacements de
communes, 1 emplacement de peu communes et 1 emplacement rare. Seul
l'emplacement rare peut donner une Épique (environ 1 paquet sur 7) ou une
Légendaire (environ 1 paquet sur 60). La composition et les poids se règlent
dans le panel admin.

Les cartes d'un paquet se retournent une par une, de la plus commune à la plus
rare.

Chaque carte tirée a aussi **une chance sur 10 000 d'être shiny**, quelle que
soit sa rareté. Elle s'affiche alors en couleurs inversées, avec un cadre
irisé. Le shiny est un attribut de l'exemplaire : on peut posséder la même
maladie en normal et en shiny. Le taux se règle dans le panel admin.

## Architecture

Même structure que git-web-review (backend) et Agility Pro (panel admin).

| Dossier                        | Rôle                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| [`backend/`](backend/)         | API NestJS 11, Prisma 7 / PostgreSQL, auth Firebase, import Wikipédia et cron            |
| [`admin-panel/`](admin-panel/) | Back office React (design system Organic d'Agility Pro) : stats, joueurs, cartes, import, règles |
| [`frontend/`](frontend/)       | Front joueur, d'après le design de [`design_handoff_player_frontend/`](design_handoff_player_frontend/) (brief : [`DESIGN_BRIEF.md`](frontend/DESIGN_BRIEF.md)) |
| [`websocket-relay/`](websocket-relay/) | Relais WebSocket : pousse aux fronts les événements que le backend publie sur Redis |

```
Wikidata (SPARQL) ──┐
                    ├─▶ import (cron ou bouton admin) ─▶ PostgreSQL ◀─ API NestJS ◀─ front joueur, panel admin
Wikipédia (API) ────┘                                                     │ publie
                                                                          ▼
                                                                        Redis ─▶ websocket-relay ─▶ front joueur, panel admin
```

## Démarrer

### Avec Docker

```bash
cp example.env .env                 # renseigner POSTGRES_PASSWORD, REDIS_PASSWORD, ADMINS, VITE_FIREBASE_*
cp firebase-service-account.json secrets/
docker compose up -d --build
```

- API : http://localhost:3005 (Swagger sur `/api` si `SWAGGER_ENABLED=true`)
- front joueur : http://localhost:5173
- panel admin : http://localhost:5174
- relais WebSocket : ws://localhost:3006/ws

Au premier démarrage, le catalogue est vide. Le cron lance l'import environ
15 secondes après le boot. Il dure une demi-heure la première fois, à cause
des résumés d'article dans les trois langues, puis quelques minutes.

### Sur un VPS derrière Traefik

Traefik doit déjà tourner, avec un réseau Docker externe (`traefik` par défaut).

```bash
cp example.env .env                 # décommenter le bloc « VPS derrière Traefik »
cp firebase-service-account.json secrets/
docker compose up -d --build
```

`COMPOSE_FILE` dans `.env` remplace la publication des ports par les labels
Traefik ([`docker-compose.traefik.yml`](docker-compose.traefik.yml)) : trois
sous-domaines (API, front, admin), TLS géré par Traefik, Postgres et Redis
jamais exposés. Le relais WebSocket est servi sur l'hôte de l'API, chemin `/ws`.
Les nginx des fronts ne font que servir les fichiers statiques du build.

### En local

Node ≥ 22.12 (Prisma 7).

```bash
docker compose up -d postgres redis # Postgres sur 127.0.0.1:5433, Redis sur 127.0.0.1:6380

cd backend
cp .env.example .env                # DATABASE_URL, ADMINS…
npm install
npx prisma migrate deploy
npm run start:dev                   # http://localhost:3005

npm run build && npm run sync:diseases   # import Wikipédia au premier plan, si besoin

cd ../websocket-relay && npm install && REDIS_PASSWORD=… npm run dev            # :3006
cd ../admin-panel && cp .env.example .env.local && npm install && npm run dev   # :5174
cd ../frontend    && cp .env.example .env.local && npm install && npm run dev   # :5173
```

## Temps réel

Le backend publie des événements sur Redis, et
[`websocket-relay/`](websocket-relay/) les pousse aux navigateurs. Pour se
connecter, un front demande un ticket à usage unique (`POST
/v1/realtime/ticket`), puis ouvre le socket avec. Le détail est dans le
[README du relais](websocket-relay/README.md).

| Événement          | Destinataires | Quand                                              |
| ------------------ | ------------- | -------------------------------------------------- |
| `player.joined`    | admins        | un joueur s'inscrit                                |
| `pack.opened`      | admins        | un paquet est ouvert (meilleure rareté, shinies)   |
| `audit.recorded`   | admins        | toute action admin                                 |
| `sync.progress`    | admins        | l'import avance (phase, compteurs) ou se termine   |
| `packs.granted`    | le joueur     | un admin lui offre des paquets                     |
| `packs.refilled`   | le joueur     | un admin remplit son stock                         |
| `card.granted`     | le joueur     | un admin lui débloque une carte                    |
| `card.removed`     | le joueur     | un admin lui retire une carte                      |
| `settings.updated` | tout le monde | les règles du jeu changent                         |

- **Ce sont des signaux, pas un flux de données.** Un événement manqué ne coûte
  rien : à chaque reconnexion, les fronts rechargent ce qu'ils affichent.
- **Panel admin** : le tableau de bord, les joueurs, les cartes, l'import et
  l'audit se mettent à jour seuls (au plus un rechargement toutes les 2 s par
  vue). L'état de la connexion s'affiche en bas du menu.
- **Front joueur** : un paquet ou une carte offerts s'affichent en
  notification, et le stock se met à jour sans recharger la page.
- **Sans Redis**, l'API fonctionne normalement. Les événements sont perdus,
  et le ticket répond `REALTIME_UNAVAILABLE` (503). Si `REDIS_URL` est vide,
  le temps réel est désactivé.

Pour ajouter un événement (par exemple une annonce) :

1. le déclarer dans `backend/src/realtime/realtime-events.ts` ;
2. le publier avec `RealtimeService.toUser`, `toAdmins` ou `toEveryone` ;
3. ajouter son type dans `admin-panel/src/lib/realtime.ts` et/ou
   `frontend/src/realtime/connection.ts`.

## Firebase

Un seul projet Firebase sert aux deux fronts.

- Backend : le compte de service (`secrets/firebase-service-account.json`)
  vérifie les ID tokens.
- Fronts : la config web publique (`VITE_FIREBASE_*`).
- Fournisseurs : Google (et email/mot de passe pour le panel admin).

Une adresse email non vérifiée (claim `email_verified`) est toujours refusée,
quel que soit le fournisseur. Sans ce garde-fou, il
suffirait de créer un compte email/mot de passe à l'adresse d'un admin pour en
hériter les droits.

Le premier appel à `GET /v1/me` crée le joueur avec 10 paquets.

## Langues

Français (`fr`), anglais (`en`) et chinois simplifié (`zh`).

- **Le compte** a une langue (`locale`). Elle est choisie à l'inscription
  d'après l'en-tête `Accept-Language`, et se change avec `PATCH /v1/me`. Le front
  joueur affiche son interface dans cette langue.
- **Les cartes** sont servies dans la langue de la requête, choisie dans cet
  ordre :
  1. `?lang=`, comme le fait le panel admin pour suivre sa propre langue ;
  2. sinon la langue du compte ;
  3. sinon `Accept-Language` ;
  4. sinon l'anglais.

  Le nom, la description, le résumé et le lien viennent de l'article Wikipédia
  de cette langue.
- **Repli** : une maladie sans article dans la langue demandée est servie en
  anglais, puis dans la langue qui en a un. Le champ `lang` de chaque carte dit
  dans quelle langue elle est arrivée, pour que le front puisse le signaler.
- **La recherche** par nom porte sur toutes les langues, et le tri par nom suit
  le nom affiché.
- **La rareté** reste la même pour tout le monde : elle se calcule sur les vues
  additionnées des trois Wikipédias.

Pour le chinois, Wikipédia stocke les articles dans les deux écritures.
L'import demande la variante simplifiée (`zh-cn`) pour les titres et les
résumés, et prend les descriptions courtes en `zh-hans` sur Wikidata.

Côté données, une carte (`cards`) correspond à un item Wikidata. Tout ce qui
dépend de la langue est dans `card_localizations`, avec une ligne par langue
qui a un article.

## Administrateurs

Les droits admin sont attribués par email :

- au démarrage, via la variable `ADMINS` ;
- ensuite, depuis le panel (« Accès & audit »).

Le dernier admin ne peut pas être retiré. Un admin ne peut pas être suspendu
(il se verrouillerait hors du panel). Chaque action admin est inscrite au
journal d'audit.

## Le panel admin

- **Tableau de bord** : joueurs actifs, paquets ouverts, activité quotidienne,
  taux de drop observés comparés aux taux attendus, catalogue par rareté,
  cartes et collectionneurs du top, état de l'import.
- **Joueurs** : recherche, filtres et export CSV. La fiche d'un joueur permet
  de donner ou retirer des paquets bonus, remplir sa minuterie, débloquer ou
  retirer des cartes, le suspendre. Elle montre aussi sa progression par
  rareté, ses derniers paquets et son audit.
- **Cartes** : tout le catalogue. On peut désactiver une carte (elle ne tombe
  plus, les exemplaires possédés restent), forcer sa rareté, ou recalculer les
  raretés.
- **Synchro Wikipédia** : lancer un import à la main, suivre l'import en cours
  et son journal en direct, consulter l'historique.
- **Règles du jeu** : minuterie et plafond, composition du booster (types
  d'emplacements, nombre, poids par rareté). Le panel affiche en direct la part
  de chaque rareté et sa fréquence (« 1 paquet sur N »). On y règle aussi la
  répartition du catalogue et la planification de l'import.

## L'import Wikipédia

[`backend/src/sync/disease-sync.service.ts`](backend/src/sync/disease-sync.service.ts)

1. **Wikidata** liste les maladies qui ont un article sur fr, en ou zh.wikipedia.org
   (une requête par langue). Une maladie est :
   - une sous-classe, à n'importe quelle profondeur, de *maladie* (Q12136) ;
   - ou une instance de *maladie*, *classe de maladie* (Q112193867), *maladie
     rare* (Q929833) ou *maladie génétique* (Q42303753).

   Les codes CIM-10 viennent au passage.
2. **Chaque Wikipédia** donne, par lots de 50, les vues des 60 derniers jours,
   la vignette et la description courte de ses articles. Les résumés sont
   récupérés par lots de 20, une fois par article.
3. Écriture des cartes :
   - nouvelles maladies → nouvelles cartes, numérotées par popularité ;
   - maladies disparues de Wikidata → marquées « disparues » (elles ne tombent
     plus, les joueurs les gardent) ;
   - deux items qui mènent au même article par une redirection → un seul le
     garde, langue par langue ;
   - une langue qui perd son article → la carte se replie sur les autres.
4. **Raretés** : classement par vues (somme des trois langues), puis découpage selon les parts réglées
   (1 / 4 / 10 / 25 % par défaut). Les raretés forcées par un admin sont
   conservées.

Garde-fous :

- un seul import à la fois ;
- un import interrompu par un redémarrage est marqué en échec ;
- si Wikidata renvoie moins de la moitié des maladies connues, l'import
  s'arrête au lieu de tout marquer disparu.

Wikimedia demande un contact dans le User-Agent : renseigner
`WIKIMEDIA_CONTACT` (URL du projet ou email).

Le cron
([`backend/src/cron/cron.service.ts`](backend/src/cron/cron.service.ts)) vérifie
chaque minute si un import est dû, selon l'intervalle réglé dans le panel
(24 h par défaut). Après un échec, il retente au bout de 30 minutes.

## La minuterie des paquets

[`backend/src/packs/pack-wallet.ts`](backend/src/packs/pack-wallet.ts)

Rien ne tourne en tâche de fond. Le joueur stocke `packsStored` à l'instant
`packsAnchorAt`, et ce qui s'est accumulé depuis est calculé à chaque lecture.

- Un stock plein n'accumule pas de temps : après en avoir ouvert un, le suivant
  arrive 10 minutes plus tard.
- Les paquets bonus (dons admin) passent au-dessus du plafond et s'ouvrent après
  ceux de la minuterie, pour ne jamais bloquer celle-ci.
- L'ouverture verrouille la ligne du joueur : deux requêtes simultanées ne
  peuvent pas ouvrir le même paquet.

## Le bot Discord

[`backend/src/discord/`](backend/src/discord/)

Quand un joueur tire une carte légendaire, le bot la poste dans le salon choisi
de chaque serveur Discord dont il est membre, en le mentionnant.

- **Le joueur** ouvre la section Discord de son profil sur le site, obtient un code (valable
  10 min) et tape `/maladie link code:XXXX-XXXX` sur Discord (dans un serveur
  qui a le bot ou en message privé au bot). Il peut couper les annonces sans
  délier, ou délier (`/maladie unlink` ou bouton sur le site).
- **N'importe quel serveur** peut ajouter le bot avec le lien « Ajouter à
  Discord » de la même section. Un membre qui a « Gérer le serveur » choisit le
  salon avec `/maladie-setup channel` (le salon courant par défaut, ou l'option
  `channel`). Un serveur peut en avoir plusieurs : `/maladie-setup list` les
  montre, `/maladie-setup off channel:#salon` en retire un, `/maladie-setup off`
  les retire tous. Le bot poste un message d'accueil dans le salon pour vérifier
  ses permissions avant d'enregistrer.
- **Pas de doublon** : Discord n'accepte un bot qu'une fois par serveur. En base,
  un serveur est une ligne (`DiscordGuild`) et chaque salon une
  ligne (`DiscordChannel`, clé = id du salon) : un salon ne peut pas être ajouté
  deux fois. Le joueur est vérifié une fois par serveur, puis l'annonce part dans
  chacun de ses salons.
- Les annonces sont dans la langue du joueur (`User.locale`, celle choisie sur
  le site), quel que soit le serveur. Le message d'accueil du réglage est dans
  la langue du serveur (celle de l'admin si le serveur n'est pas
  « communautaire »).

Le bot n'ouvre pas de connexion gateway : Discord envoie les commandes slash en
HTTP signé à `POST /v1/discord/interactions`, et le bot poste via l'API REST.
Mise en place :

1. Créer une application sur <https://discord.com/developers/applications>,
   avec comme icône [`assets/discord/bot-icon.png`](assets/discord/bot-icon.png)
   (onglets *General Information* et *Bot*).
2. Onglet *Bot* : laisser **Public Bot** coché (sinon vous seul pouvez
   l'ajouter), aucun intent privilégié n'est nécessaire. Générer le token.
3. Renseigner `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY` et
   `DISCORD_BOT_TOKEN` dans `.env`, puis redémarrer : les commandes slash sont
   enregistrées au démarrage.
4. Onglet *General Information* : *Interactions Endpoint URL* =
   `https://<api>/v1/discord/interactions`. Discord l'appelle pour valider,
   l'API doit donc tourner et être joignable en HTTPS.

Un serveur qui retire le bot est oublié à la première annonce qui échoue, avec
ses salons ; un salon supprimé aussi, et le serveur part avec son dernier salon. Chaque légendaire coûte une requête « membre ? » par
serveur configuré : suffisant pour quelques centaines de serveurs.

## Tests

```bash
cd backend && npm test    # règles de la minuterie, des raretés et du dédoublonnage
cd websocket-relay && npm test   # filtres d'hôte, d'origine et lecture des tickets
```
