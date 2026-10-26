# Dorsum v0.8.3 — safe client/specialist removal

The UI says "Удалить", but the operation is a soft archive.

## Database
User now has:
- active
- deactivatedAt
- deactivatedReason

Migration:
`20260820224500_soft_archive_users`

## Behaviour
When a CLIENT or SPECIALIST is archived:
- User row is preserved.
- ClientProfile / SpecialistProfile is preserved.
- Appointment history is preserved.
- Courses are preserved.
- Finance/payroll history is preserved.
- Login and refresh tokens stop working for the archived account.
- The person disappears from active Clients/Staff lists.
- The person disappears from appointment client/specialist selectors and availability.
- Direct crafted appointment creation with an archived profile is rejected.

## Safety guard
Archiving is blocked when the person has a future `SCHEDULED` appointment.
The admin must cancel/delete/reassign the future appointment first.

ADMIN accounts cannot be archived through this endpoint.
The currently logged-in administrator cannot archive themselves.

No hard DELETE or cascading deletion is used.
