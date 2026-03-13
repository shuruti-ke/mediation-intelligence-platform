# Alembic Migration Plan

This project now supports two schema management modes:

- `runtime` (default): current behavior using startup schema sync in `init_db()`
- `alembic`: disables runtime schema sync and expects schema to be managed by Alembic revisions

Set via:

```env
SCHEMA_MANAGEMENT_MODE=alembic
```

## Recommended rollout path

1. Keep production on `runtime` while preparing baseline revisions.
2. Generate Alembic baseline and incremental migrations from current metadata.
3. Apply migrations in staging using:
   - `alembic upgrade head`
4. Validate startup with:
   - `SCHEMA_MANAGEMENT_MODE=alembic`
5. Switch production to Alembic mode once staging is stable.

## Common commands

From `backend` directory:

```bash
alembic revision -m "baseline schema"
alembic revision --autogenerate -m "add new fields"
alembic upgrade head
alembic downgrade -1
```

## Operational guidance

- Use runtime mode for local bootstrap convenience.
- Use Alembic mode in managed environments where migration history and rollback safety matter.
- Do not combine `alembic` mode with manual startup schema alters.
