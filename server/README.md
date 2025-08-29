
# QR Card Backend (Demo)

A minimal Express + SQLite backend to accept and store QR card submissions.

## Run locally

```bash
cd server
npm install
npm run dev
```

The server starts at `http://localhost:3000`.

## Endpoints

- `POST /api/qr-cards` — save a contact, create a public profile, store consent
- `GET /c/:slug` — public profile page with a vCard download button
- `GET /api/contacts/:id.vcf` — served vCard file
- `GET /api/admin/contacts` — list latest contacts (demo, no auth)

> This is a demo: add authentication, CORS origin restriction, and privacy safeguards before production.
