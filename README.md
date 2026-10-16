# design-review

Review service for design-system syncs (Express + Mongoose API, React web UI in `web/`). npm workspaces: `server`, `web`.

## Run

    npm install                   # also downloads a mongod binary (mongodb-memory-server) for the tests
    npm test                      # server tests (uses mongodb-memory-server)
    SEED_ADMIN_EMAIL=a@x.io SEED_ADMIN_PASSWORD=temp-password-1 MONGO_URL=mongodb://... npm -w server run seed

## Local server

    cp server/.env.example server/.env   # fill in MONGO_URL and SESSION_SECRET
    npm run dev:server                   # http://localhost:9300/api/v1
    npm run start:server                 # same, reads the real environment (no .env file)

On Vercel, `api/index.mjs` is the function (`vercel.json` rewrites `/api/v1/*` to it). Browsers may call the API only from `WEB_ORIGIN` and each project's `allowedOrigins` (cached 60 s); other origins get no CORS headers.

## Environment

- `MONGO_URL` MongoDB connection string (database `design_review`)
- `ORG_ID` organisation id, default `blue-silo`
- `SESSION_SECRET` secret for signed session tokens
- `WEB_ORIGIN` allowed origin of the web UI
- `PORT` server port, default `9300`
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` first admin, used by the seed script (created with `mustChangePassword`)

## Deploy to Vercel + Atlas

1. Atlas: create a cluster and a database user with `readWrite` on `design_review`. Network Access: allow `0.0.0.0/0` (Vercel has no fixed IPs).
2. Vercel: import the repo and set the environment variables
   - `MONGO_URL` the Atlas connection string
   - `SESSION_SECRET` a long random secret (`openssl rand -base64 48`)
   - `ORG_ID` for example `blue-silo`
   - `WEB_ORIGIN` the origin of the web UI, for example `https://<service>.vercel.app`
   - `MONGOMS_DISABLE_POSTINSTALL=1` so `npm install` on Vercel does not try to download a mongod binary (only the tests need it)
3. Seed the first admin from a dev machine, once:

       MONGO_URL=... SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... node server/scripts/seed.mjs

4. Verify that the rewrite reaches the function:

       curl -s <service>/api/v1/me     # 401 {"error":"Log in first."}
