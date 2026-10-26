# Dorsum v0.7.8 — Expenses

## Admin Expenses
New ADMIN-only `/admin/expenses` section.

Fields:
- purchase title (required)
- amount (required)
- purchase date
- optional note
- optional receipt image (JPEG/PNG/WEBP, max 5 MB)

Security/data integrity:
- all expense endpoints require authenticated ADMIN
- server validates amount, title, date and note length
- receipt MIME type is allowlisted and checked against the actual file signature
- receipt size is limited
- receipts are served `private, no-store` with `nosniff`
- expense records are never hard-deleted from the UI; cancellation sets `voidedAt`
- cancelled expenses remain in history but no longer affect finance totals

## Finance
Finance summary now calculates:
- gross cash = appointments + courses + inventory
- specialist payroll
- administrative expenses
- net = gross cash - specialist payroll - administrative expenses

A separate expense KPI and monthly expense ledger were added.

## Database
Migration:
`20260820213000_admin_expenses`

Apply:
```powershell
cd server
npx prisma generate
npx prisma migrate deploy
```
