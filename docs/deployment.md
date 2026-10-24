# Local deployment

## Docker Compose

From the repository root:

```powershell
docker compose up --build
```

The web app is available at `http://localhost:3000`, the API at `http://localhost:3001`, and PostgreSQL at `localhost:5432`. The API container applies committed Prisma migrations before starting. Database files are held in the `db_data` volume.

To stop the services without deleting database data:

```powershell
docker compose down
```

Do not add `-v` unless you intentionally want to delete the local database volume.

## Development outside Docker

Start PostgreSQL, then open separate terminals:

```powershell
cd apps/api
Copy-Item .env.example .env
npm install
npm run prisma:deploy
$env:PORT=3001; npm run start:dev
```

```powershell
cd apps/web
npm install
npm run dev
```

Set `DATABASE_URL` and `JWT_SECRET` in `apps/api/.env` as needed. By default, the web app sends API requests through a same-origin Next.js proxy to `http://localhost:3001` during local development. Docker Compose configures the proxy target as `http://backend:3001`. Set `NEXT_PUBLIC_API_URL` only when the browser should call a separate, directly accessible API URL.

For SePay QR payments, set `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_NUMBER`,
`SEPAY_ACCOUNT_NAME`, and `SEPAY_API_KEY` in the root `.env` used by Docker
Compose. Configure SePay to send `Authorization: Apikey <SEPAY_API_KEY>` to
`https://<public-api-host>/payments/sepay/webhook`. The API must be reachable
over HTTPS by SePay. Use a dedicated test bank account for testing: QR transfers
can move real money even when the application is being tested.

This same-origin proxy also lets the frontend and API share one public ngrok URL. `NEXT_PUBLIC_API_URL` and `API_PROXY_TARGET` are applied at build time, so rebuild the frontend after changing either value.
