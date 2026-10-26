# Dorsum stable 2.0.5 — client search in course sales

ADMIN can search clients before selling/importing a course.

Search supports:
- partial full name, case-insensitive;
- partial phone number;
- formatted/unformatted phone input (spaces, +, hyphens and brackets are ignored).

The client dropdown displays:
`ФИО · телефон`

Existing military/pensioner labels remain visible.

Search is local over the client list already received from the authenticated API.
No direct database access, backend change or Prisma migration is required.
