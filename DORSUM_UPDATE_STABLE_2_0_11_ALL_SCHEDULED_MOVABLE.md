# Dorsum stable 2.0.11 — every SCHEDULED appointment can be moved

Rule:
`Appointment.status === SCHEDULED` is the source of truth.

ADMIN can drag/drop or edit any SCHEDULED appointment even when:
- it is later today;
- it starts in one hour;
- it starts in 30 minutes;
- its original start time has already passed;
- it is an overdue SCHEDULED record that was never marked completed/cancelled.

Still prohibited:
- moving COMPLETED / CANCELLED / NOT_COMPLETED appointments;
- choosing a target date/time in the past.

Backend and frontend enforce the same rule.
No Prisma migration required.
