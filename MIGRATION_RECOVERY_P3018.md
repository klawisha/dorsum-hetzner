# Recovery from P3018 on 20260820113000_massage_payroll_inventory_sales

Do NOT reset the database.

From `server`:

```powershell
npx prisma migrate resolve --rolled-back 20260820113000_massage_payroll_inventory_sales
npx prisma migrate deploy
npx prisma generate
```

Why this is safe in v0.7.2:
- The failed migration was rewritten to be idempotent.
- Columns use `ADD COLUMN IF NOT EXISTS`.
- Tables/indexes use `IF NOT EXISTS`.
- Foreign keys are guarded with `pg_constraint`.
- Seed rows use `ON CONFLICT`.
- Therefore objects left by the failed first run are reused instead of causing another failure.

After deploy:

```powershell
npx prisma migrate status
```

The migrations should be applied:
- 20260820113000_massage_payroll_inventory_sales
- 20260820123000_fix_massage_payroll_floor
