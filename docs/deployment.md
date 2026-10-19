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

Set `DATABASE_URL` and `JWT_SECRET` in `apps/api/.env` as needed. The web app reads `NEXT_PUBLIC_API_URL` from `apps/web/.env.local` (default API URL: `http://localhost:3001`).
