# design-review

Review service for design-system syncs (Express + Mongoose, React web UI later). npm workspaces: `server`, `web`.

## Run

    npm install
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
