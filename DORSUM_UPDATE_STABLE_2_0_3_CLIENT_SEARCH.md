# Dorsum stable 2.0.3 — client search in appointment creation

The ADMIN appointment creation modal now includes client search.

Search supports:
- partial full name, case-insensitive;
- partial phone number;
- formatted or unformatted phone input (spaces, +, brackets and hyphens are ignored for phone matching).

The search is applied after the existing slot-availability filtering, so busy/unavailable clients are not accidentally reintroduced.

The client select now shows both:
`ФИО · телефон`

No backend/API/database changes and no Prisma migration are required.
