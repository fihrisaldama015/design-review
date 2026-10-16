# design-review

Review service for design-system syncs (Express + Mongoose, React web UI later). npm workspaces: `server`, `web`.

## Run

    npm install
    npm test                      # server tests (uses mongodb-memory-server)
    SEED_ADMIN_EMAIL=a@x.io SEED_ADMIN_PASSWORD=temp-password-1 MONGO_URL=mongodb://... npm -w server run seed

## Environment

- `MONGO_URL` MongoDB connection string (database `design_review`)
- `ORG_ID` organisation id, default `blue-silo`
- `SESSION_SECRET` secret for signed session tokens
- `WEB_ORIGIN` allowed origin of the web UI
- `PORT` server port
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` first admin, used by the seed script (created with `mustChangePassword`)
