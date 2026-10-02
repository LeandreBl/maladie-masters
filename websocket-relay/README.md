# websocket-relay

Le relais entre Redis et les navigateurs. Le backend publie ses événements sur
Redis, le relais les pousse aux sockets qui ont le droit de les voir. Il ne
parle ni au backend ni à la base : mille connexions ne coûtent rien à l'API.

## Connexion

1. Le front demande un ticket à l'API : `POST /v1/realtime/ticket`
   (authentifié). Le ticket vaut **une** connexion, pendant **30 secondes**.
2. Il ouvre `ws(s)://…/ws?ticket=<ticket>`. Le relais retire le ticket de Redis
   (`GETDEL`) : un ticket rejoué ou recopié depuis un log est refusé.
3. Le socket ne fait que recevoir. Ce que le client envoie est ignoré (1 Ko max).

Le relais ferme le socket dans trois cas :

- au bout de `MAX_SESSION_MINUTES` (code `4001`) ;
- quand les droits du joueur changent (code `4000`) : suspension, droits
  d'admin donnés ou retirés ;
- quand le client ne répond plus aux pings.

Dans tous les cas, le front attend puis redemande un ticket. C'est l'API qui
revérifie le compte à ce moment-là : un joueur suspendu n'en obtient plus.

## Canaux Redis

Le contrat est défini dans
[`backend/src/realtime/realtime-events.ts`](../backend/src/realtime/realtime-events.ts).

| Canal                    | Reçu par                                    |
| ------------------------ | ------------------------------------------- |
| `realtime:everyone`      | tous les sockets                            |
| `realtime:admins`        | les sockets ouverts par un admin            |
| `realtime:user:<userId>` | les sockets de ce joueur                    |
| `realtime:control`       | le relais lui-même (`disconnect`), jamais transmis |

Les tickets sont stockés sous `realtime:ticket:<ticket>` : `{ userId, admin }`.

Chaque message reçu par un socket a la forme `{ type, data, at }`. Le relais en
émet un lui-même, `realtime.resync`, quand son abonnement Redis revient après
une coupure : le pub/sub ne garde rien, donc les fronts rechargent.

## Variables

| Variable                     | Défaut                                        |
| ---------------------------- | --------------------------------------------- |
| `PORT`                       | `3006` (3000 dans Docker)                     |
| `REDIS_URL`                  | `redis://localhost:6380`                      |
| `REDIS_PASSWORD`             | vide                                          |
| `ALLOWED_HOSTS`              | vide = tous (mêmes règles que `BACKEND_ALLOWED_HOSTS`) |
| `ALLOWED_ORIGINS`            | `http://localhost:5173,http://localhost:5174` |
| `MAX_CONNECTIONS_PER_USER`   | `10`                                          |
| `MAX_SESSION_MINUTES`        | `60`                                          |
| `HEARTBEAT_INTERVAL_SECONDS` | `30`                                          |

`GET /health` répond 503 tant que Redis est injoignable.

## En local

```bash
docker compose up -d redis      # Redis sur 127.0.0.1:6380
cd websocket-relay
npm install
REDIS_PASSWORD=… npm run dev    # ws://localhost:3006/ws
npm test
```
