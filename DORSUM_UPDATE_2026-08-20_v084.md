# Dorsum v0.8.4 — compact Staff header + appointment specialist reassignment

## Staff / Roles
Desktop/laptop table header is forced back to a compact 44px row.
Column widths were adjusted for the new Actions column.
Mobile card-table behaviour is untouched.

## Change specialist on a scheduled appointment
ADMIN can change the specialist directly from Appointment Details when:
- appointment status is SCHEDULED;
- appointment start time is still in the future.

Backend validates the target specialist:
- account must be active;
- specialist block must not overlap;
- individual appointment cannot overlap another active appointment;
- group appointment may join only the exact same group service/time;
- group capacity must not be exceeded.

The operation is serialized with the same PostgreSQL advisory-lock pattern used by booking creation.

Changing specialist preserves:
- client;
- service;
- start/end time;
- course;
- payment state;
- price;
- historical appointment ID.

Completed, cancelled, missed or already-started appointments cannot be reassigned.

No new Prisma migration is required beyond migrations already present in v0.8.3.
