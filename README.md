# ConstructFlow

Clean-room construction operations platform starter. The current vertical slice is dependency-free so it can run in the bundled Node runtime while the production Next.js/NestJS migration is prepared.

## Run

```powershell
& 'C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' server.js
```

Open `http://localhost:3000`.

Runtime data defaults to `data/` and backups default to `backups/`. For production,
set `DATA_DIR`, `BACKUP_DIR`, `UPLOAD_MAX_BYTES`, and `SESSION_TTL_HOURS` in the
process environment.

## Test

```powershell
& 'C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/*.test.js
```

## Included

- Responsive PWA shell
- Dashboard, Insight, project list, and construction project detail
- REST endpoints under `/api/v1`
- Navigation placeholders for dependent modules
- Docker starter with PostgreSQL, Redis, and MinIO services

## Deploy

See [`docs/DEPLOY_WINDOWS.md`](docs/DEPLOY_WINDOWS.md) for the Windows server,
Caddy, NSSM, `app.ledome.vn`, runtime data, and backup deployment checklist.

## Delivery status

This repository is the first working vertical slice, not the completed ERP. See
[`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) for the production backlog.
