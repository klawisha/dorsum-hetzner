# Dorsum v0.8.1 — ADMIN create client / specialist

## Create client
New ADMIN menu item: `Создать клиента`.

Creates in one Prisma transaction:
- User(role=CLIENT)
- ClientProfile

Fields:
- full name
- phone
- login password
- military flag
- pensioner flag

The phone is normalized with the same function as registration/login and checked for uniqueness.

## Create specialist
`Staff / Roles` now contains `Добавить специалиста`.

Creates in one Prisma transaction:
- User(role=SPECIALIST)
- SpecialistProfile

Fields:
- full name
- phone
- login password
- one or more specializations
- calendar color

Allowed specializations are validated server-side:
- REHABILITATION_SPECIALIST
- MASSAGE_THERAPIST
- TRAINER
- DOCTOR

## Safety
- Both endpoints are ADMIN-only.
- Password is bcrypt-hashed with cost 12.
- User and profile creation are atomic.
- Duplicate phones return HTTP 409.
- Invalid phone/name/password/specialization/color are rejected server-side.
- No Prisma migration is required.
