# Chattrn Commerce

A full-stack storefront and ERP built with React, Vinext, Cloudflare Workers, and D1.

## Features
- Owner-private admin workspace with overview, products, stock, orders, customers, and settings.
- Responsive storefront, product details, search/category filters, cart, server-calculated quotes, and COD checkout.
- Durable catalog, inventory, drafts, orders, and customer records.
- Atomic order completion and stock decrement; idempotent draft completion and cancellation.
- Shipment carrier/tracking updates and cancellation with restocking.
- Optional sample catalog added explicitly from the admin workspace.

## API
The supplied `openapi.yaml` is retained unchanged. External routes are under `/chattrn/api/2026-10` and require `X-Chattrn-Access-Token`. Set the server secret `CHATTRN_ACCESS_TOKEN` using Sites environment variables. Unconfigured external access is denied. The private site's service access header is also required for machine callers while owner-private hosting is enabled.

Browser requests use `/api` and a server-verified ChatGPT session. Private hosting is the admin authorization boundary. Do not change site visibility until explicit admin roles and customer-specific order authorization are implemented. Public commerce launch requires those access controls.

Money uses decimal strings in BDT. Product status values, resource wrappers, draft completion, and errors follow the supplied contract. Read endpoints are synchronous; draft creation completes synchronously (no 202 polling required). Only one Dhaka delivery location is currently configured. Delivery is BDT 80, 1–3 days, COD. Card payments, configurable taxes/discounts and multi-location administration are not implemented.

Admin extensions, separate from the supplied contract:
- `POST /api/admin/products` / `PUT /api/admin/products`
- `PUT /api/admin/inventory`
- `POST /api/admin/fulfill`
- `POST /api/admin/seed`

The product editor manages one variant's editable fields and preserves other existing variants. The API accepts variant arrays. New variants start with zero stock. Inventory policy is deny for admin-created variants. Product images use HTTPS URL references; image uploads are not implemented. Sample images use Unsplash URLs.

## Development
Run `npm run dev`. The portable development server simulates sign-in at `/signin-with-chatgpt?return_to=/`.
Generate schema migrations using `npm run db:generate`; apply local migrations following the Sites starter documentation. The `.openai/hosting.json` manifest binds D1 as `DB`.
