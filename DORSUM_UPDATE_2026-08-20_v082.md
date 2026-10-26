# Dorsum v0.8.2 — client creation moved into Clients

- Removed separate sidebar item `Создать клиента`.
- Removed standalone `/admin/clients/create` route/page.
- `Clients` now contains an `Добавить клиента` button.
- The form expands inline, matching the `Добавить специалиста` UX in Staff / Roles.
- After creation, the client list refreshes immediately.
- Existing secure ADMIN-only backend transaction from v0.8.1 is reused.
- No Prisma migration required.
