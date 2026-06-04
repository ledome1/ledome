# Implementation status

## Working vertical slice

- Dependency-free Node HTTP server with REST endpoints under `/api/v1`
- Responsive PWA shell with offline caching for static assets
- Enterprise dashboard, Insight summary, project inventory, and project detail dashboard
- Demo construction data for financial KPIs, schedule, contracts, inventory, alerts, and activity
- Docker starter for the app, PostgreSQL, Redis, and MinIO
- API smoke tests

## Production backlog

The following items require iterative implementation before production use:

1. Replace in-memory demo data with PostgreSQL persistence and migrations.
2. Add authentication, RBAC enforcement, audit log, and per-project authorization.
3. Implement CRUD workflows for BOQ, schedule, site diary, contracts, acceptance, payment, debt, inventory, cashflow, and approval.
4. Add Excel import/export validation and MinIO upload flows.
5. Implement dependent modules: Work+, CRM, HRM attendance, fleet, Drive, and document registry.
6. Add email jobs, Redis queues, webhook delivery, OpenAPI generation, observability, backup, and restore.
7. Migrate the UI/API runtime to the planned Next.js and NestJS monorepo once package installation is available.
8. Expand tests with domain unit tests, integration tests, authorization tests, and role-based E2E scenarios.
