# Chattrn Commerce

Responsive storefront and ERP with products, inventory, orders, customers, fulfillment, cash-on-delivery checkout and the supplied Chattrn REST API. Runs on Node.js/Next.js and PostgreSQL.

## Deploy to Render

1. In Render choose **New → Blueprint**, connect `shopnil36/ecom`, and select `main`.
2. Render detects `render.yaml` and provisions a Node web service plus PostgreSQL in Singapore.
3. Enter a strong `ADMIN_PASSWORD` of at least 12 characters. Session/API secrets are generated automatically; the database connection is wired automatically.
4. Review the plans and deploy. This blueprint selects free plans. **Free PostgreSQL expires after 30 days**; upgrade before storing important business data. Free web services also sleep when idle.
5. Open the deployed HTTPS URL. Use **Manage store** to sign in, then add products or explicitly load the sample collection.
6. The API base URL is `https://YOUR-SERVICE.onrender.com/chattrn/api/2026-10`. Copy `CHATTRN_ACCESS_TOKEN` from Render → service → Environment into Chattrn. The old local token is not deployed.

Manual web service settings: Node.js 22.17.0, build `npm ci --include=dev && npm run build`, start `npm start`, health check `/api/health`. Required environment variables are listed in `.env.example`. Use a Render Postgres internal connection string for `DATABASE_URL`. The startup script applies the PostgreSQL schema atomically before starting the web server.

## Security and data

Public visitors can browse active products and place COD orders. Admin product/stock/fulfillment/customer operations require an authenticated owner session. Admin sessions expire after eight hours; sign out is available in the admin sidebar. Customers can access only drafts/orders created in their signed browser session. Cross-origin browser writes are rejected. Login has per-session and global rate limits. ChatGPT identity headers are not trusted on Render.

External integrations require `X-Chattrn-Access-Token`. Treat this token as privileged access to catalog, customers, orders and checkout. Keep it server-side. Do not commit `.env.local` or `.dev.vars`. Rotate the session secret to invalidate all sessions; rotate API/admin credentials separately when needed.

Product, stock, draft, order and customer data persist in PostgreSQL. Atomic database transactions protect stock updates; duplicate completion/cancellation requests do not duplicate orders or restore stock twice. Local sample data and databases are not uploaded.

## Development

- Node.js 22+, PostgreSQL, `npm ci`.
- Copy `.env.example` to `.env.local` and set real local values.
- Apply schema: load those variables and run `node scripts/migrate-postgres.mjs` (or `node --env-file=.env.local scripts/migrate-postgres.mjs`).
- `npm run dev` starts Next.js. `npm run build` builds production. For local production use `node --env-file=.env.local scripts/migrate-postgres.mjs` followed by `next start`; production session cookies require HTTPS.

The supplied `openapi.yaml` is retained. Admin extensions are separate under `/api/admin/products`, `/api/admin/inventory`, `/api/admin/fulfill`, and `/api/admin/seed`.

Current defaults: BDT, one Dhaka delivery zone, BDT 80 delivery, 1–3 days, COD. Card payments, configurable taxes/discounts, image uploads and multi-location administration are not implemented. The product editor edits the first variant and preserves other existing variants; the API supports variant arrays. New variants begin with zero stock.

The repository retains the original Sites/Cloudflare starter support files and SQLite migration as historical scaffolding. Render uses Next.js, `lib/postgres.ts` and `db/postgres.sql`; Cloudflare bindings and sign-in are not used.
