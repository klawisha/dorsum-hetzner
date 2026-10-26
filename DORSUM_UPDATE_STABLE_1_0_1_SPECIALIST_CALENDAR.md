# Dorsum stable 1.0.1 — specialist calendar creation disabled

- Empty calendar slot click/tap is disabled in specialist mode.
- `dateClick` is registered only for ADMIN.
- `handleDateClick` also has an ADMIN guard as defense in depth.
- `CreateAppointmentModal` is mounted only for ADMIN.
- Specialists can still click existing appointments and open their details.
- Backend permissions remain unchanged, so ADMIN-only creation is still enforced server-side.
- No Prisma migration required.
