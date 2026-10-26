# Dorsum stable 2.0.7 — drag/drop appointment rescheduling

ADMIN calendar:
- future SCHEDULED appointments can be dragged to another calendar cell;
- drop snaps to 30-minute cells;
- duration is preserved;
- appointment ID is preserved;
- client, specialist, service, course, payment, price and specialist-pay snapshot are preserved.

Before saving, backend checks:
- appointment is still future + SCHEDULED;
- client account is active;
- specialist account is active;
- client has no overlapping non-cancelled appointment;
- specialist has no overlapping unavailable block;
- specialist has no conflicting appointment;
- group moves are allowed only into the exact same group service/time with capacity remaining.

On conflict:
- API returns a specific error;
- FullCalendar calls revert();
- the card returns to its original date/time;
- ADMIN sees a readable message.

Concurrency:
- client + specialist advisory locks are acquired in deterministic order for both
  appointment creation and drag/drop move operations.

Permissions:
- POST /appointments is now explicitly ADMIN-only on the backend.
- PATCH /appointments/:id/move is ADMIN-only.
- specialist calendar remains non-editable.

No Prisma migration is required.
