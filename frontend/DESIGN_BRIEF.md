# Maladie Masters — brief pour le front joueur

Ce dossier contient un **squelette fonctionnel** (React 19 + Vite + Firebase) :
connexion, ouverture de paquets, collection, classement. Il est branché sur la
vraie API mais n'a aucun design. Ce brief sert à le concevoir avec Claude Design.

Le jeu est **trilingue : français, anglais, chinois simplifié**. Les textes
d'interface sont dans [`src/i18n/dictionaries.ts`](src/i18n/dictionaries.ts).

## Le jeu en une phrase

Un TCG dont les cartes sont les ~12 000 maladies qui ont un article sur
Wikipédia en français, en anglais ou en chinois. Plus une maladie est lue,
plus sa carte est rare.

## Raretés

Un paquet est un booster, comme dans Magic ou Pokémon : 3 emplacements de
communes, 1 emplacement de peu communes et 1 emplacement « rare », le seul qui
puisse donner Épique ou Légendaire.

| Rareté      | Part du catalogue | Fréquence (booster par défaut) | Exemples réels           |
| ----------- | ----------------- | ------------------------------ | ------------------------ |
| Légendaire  | 1 %               | ~1 paquet sur 60               | Tuberculose, Schizophrénie, Lèpre |
| Épique      | 4 %               | ~1 paquet sur 7                | Acromégalie              |
| Rare        | 10 %              | presque tous les paquets       |                          |
| Peu commune | 25 %              | au moins 1 par paquet          |                          |
| Commune     | le reste          | ~3 par paquet                  | Grossesse hétérotopique  |

**Shiny** : chaque carte tirée a 1 chance sur 10 000 d'être shiny, quelle que
soit sa rareté. Une commune peut donc être shiny.

- Le shiny se voit dans `isShiny` (ouverture), `shinyQuantity` (collection et
  fiche), et dans le filtre `owned=shiny`.
- Rendu attendu : un traitement spécial bien visible. Le squelette inverse les
  couleurs de l'image, avec un cadre irisé et un badge ✦ ; un effet sépia est
  l'alternative envisagée.
- À l'ouverture, une carte shiny mérite la plus grosse mise en scène, au-dessus
  d'une légendaire.

Tout est réglable dans le panel admin : ne rien écrire en dur. Les cartes
arrivent **triées de la plus commune à la plus rare**, et la plus rare se
révèle donc en dernier. C'est le moment fort à mettre en scène.

## Ce que porte une carte (`Card`)

- `number` : numéro de collection (#1 = la maladie la plus lue au premier import)
- `lang` : la langue du nom et de l'article. Elle vaut la langue du compte,
  sauf quand la maladie n'a pas d'article dans cette langue : la carte arrive
  alors en anglais (ou dans la langue disponible). Prévoir un petit indicateur
  discret pour ce cas.
- `name`, `description` (courte, parfois absente), `imageUrl` (vignette
  Wikimedia, **absente pour ~40 % des cartes** : prévoir un visuel par défaut)
- `rarity`, `pageviews` (vues sur 60 jours), `popularityRank`
- détail (`GET /v1/cards/:id`) : `extract` (3 phrases de l'article), `icd10`
  (codes CIM-10), `quantity` possédée, `ownersCount`, lien `wikipediaUrl`

Une carte non possédée (`quantity: 0`) se montre face cachée ou en silhouette.

## Écrans

1. **Connexion** : Google via Firebase.
2. **Accueil / paquets** (`GET /v1/me`, `POST /v1/me/packs/open`)
   - stock : `available` = minuterie (`natural`, max `maxStored` = 10) + `bonus`
     (offerts par un admin, sans plafond)
   - compte à rebours jusqu'à `nextPackAt` (un paquet toutes les 10 min ; `null`
     quand le stock est plein). Corriger la dérive avec `serverTime`.
   - bouton d'ouverture, puis **révélation carte par carte**, comme Wiki
     Masters. L'API renvoie tout le paquet d'un coup, et le front garde le
     suspense : un tas face cachée, on le touche (ou Espace / Entrée) pour
     retourner la carte suivante, de la plus commune à la plus rare. La
     meilleure carte arrive donc toujours en dernier.
     - Chaque retournement est mis en scène selon la rareté : plus fort pour
       Épique, encore plus pour Légendaire.
     - Un lien « Tout révéler » permet de passer.
     - À la fin, les 5 cartes sont étalées, avec le nombre de nouvelles et un
       badge « nouvelle » sur `isNew`.
     - Pendant la révélation, rien ne doit vendre la mèche : le bouton
       d'ouverture est masqué et les compteurs de progression ne sont mis à
       jour qu'à la fin.
     - Implémentation actuelle : [`src/components/PackReveal.tsx`](src/components/PackReveal.tsx).
   - Le corps de réponse contient le stock mis à jour.
   - erreur `NO_PACK_AVAILABLE` (409) : afficher le compte à rebours.
3. **Collection** (`GET /v1/me/collection`) : grille paginée, filtres possédées /
   manquantes / toutes, par rareté, recherche, tris (numéro, nom, rareté,
   popularité, récentes). Progression par rareté (`collection.byRarity`).
4. **Fiche carte** : modale ou page avec l'extrait et le lien Wikipédia.
5. **Historique** (`GET /v1/me/packs/history`) : les paquets passés.
6. **Classement** (`GET /v1/leaderboard`) : score = Commune 1, Peu commune 3,
   Rare 10, Épique 30, Légendaire 100 points par carte distincte.
7. **Profil** (`PATCH /v1/me`) : changer `displayName` et `locale` (fr / en /
   zh). La langue choisie pilote à la fois l'interface et la langue des cartes
   renvoyées par l'API.
8. **Discord** (`GET/PATCH/DELETE /v1/me/discord`,
   `POST /v1/me/discord/link-code`) : lier son compte Discord avec un code à
   taper dans `/maladie link`, couper les annonces de légendaires, et lien
   d'invitation du bot (`inviteUrl`). Masquer l'écran si `enabled` est faux.

**Notifications en direct.** Le serveur pousse des événements par WebSocket
(`src/realtime/`). Aujourd'hui, ce sont les cadeaux d'un admin : paquets
bonus, stock rempli, carte débloquée. Les annonces viendront ensuite. Elles
s'affichent dans [`src/components/Notices.tsx`](src/components/Notices.tsx),
une pile en haut à droite qui se ferme seule après 10 s. C'est la partie à
habiller. La mise à jour du stock et de la collection est déjà branchée.

États à prévoir : chargement, catalogue vide (`EMPTY_CATALOG`, 503 : l'import
Wikipédia n'a pas encore tourné), compte suspendu (`ACCOUNT_SUSPENDED`, 403),
email non vérifié (`EMAIL_NOT_VERIFIED`, 403).

## Contraintes

- Ton : collection ludique, mais le sujet reste des maladies réelles ; éviter
  l'humour sur les patients.
- Mobile d'abord : l'ouverture de paquet est l'action la plus fréquente.
- Les images viennent de Wikimedia Commons (formats et ratios variables).
- Typographie : prévoir une police qui couvre le chinois (ou une pile de
  secours CJK). Les noms chinois sont courts, les noms français et anglais
  peuvent être très longs (« Encéphalomyélite myalgique/syndrome de fatigue
  chronique »).

## Contrat d'API

Le contrat complet est en OpenAPI : `http://localhost:3005/api` (Swagger UI) ou
`npm run openapi:generate` dans `backend/`. Les types utilisés ici sont dans
[`src/api/types.ts`](src/api/types.ts) et le client dans
[`src/api/client.ts`](src/api/client.ts) : ils peuvent être gardés tels quels
sous le nouveau design.
