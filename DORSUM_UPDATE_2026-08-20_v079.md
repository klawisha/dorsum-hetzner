# Dorsum v0.7.9 — specialist calendar colors + status integrity

## Root cause fixed
The server previously derived clinical/operational status from payment and time:
- past + PAID -> COMPLETED
- past + PENDING -> NOT_COMPLETED

This was incorrect because payment status and appointment completion are independent.

`getAll()` and `getMyAppointments()` no longer call that automatic mutation.
`syncPastStatuses()` is retained as a no-op for backwards compatibility.

## Calendar colors
- SCHEDULED: specialist color
- NOT_COMPLETED: specialist color + red left status rail + `!` badge
- COMPLETED: gray
- CANCELLED: light/white
- PAID: `$` badge only

This also makes already auto-converted legacy NOT_COMPLETED appointments stop appearing
as solid red cards without rewriting their database history.

No Prisma migration is required.
