# Dorsum stable 2.0.6 — Выезд

Added a separate one-time service:
- title: Выезд
- price: 700 грн
- duration: 60 minutes
- category: HOME_VISIT
- package: no
- specialist pay per session: 120 грн
- active: yes

The service is intentionally separate from ordinary kinesitherapy so its sales/payroll history remains distinguishable.

No Prisma schema migration is required. The existing service catalog seeding/ensure logic creates the missing Service row.
