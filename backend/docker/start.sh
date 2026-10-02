#!/bin/sh
# Container entry point: applies pending migrations, then starts the API.
set -e

# Built from the POSTGRES_* parts when not given whole: the password is
# percent-encoded, so a generated one (with / + = ...) does not break the URL.
if [ -z "$DATABASE_URL" ]; then
  : "${POSTGRES_USER:?POSTGRES_USER is required in .env (see example.env)}"
  : "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required in .env (see example.env)}"
  : "${POSTGRES_DB:?POSTGRES_DB is required in .env (see example.env)}"
  DATABASE_URL=$(node -e '
    const e = encodeURIComponent, v = process.env;
    process.stdout.write(
      `postgresql://${e(v.POSTGRES_USER)}:${e(v.POSTGRES_PASSWORD)}@${v.POSTGRES_HOST}:5432/${e(v.POSTGRES_DB)}`,
    );
  ')
  export DATABASE_URL
fi

npm run prisma:migrate:deploy
exec npm run start:prod
