# Dorsum stable 2.0.8

## Shared family phone (ADMIN-only)
- Public registration still rejects any phone already used by an active client profile.
- ADMIN can explicitly create an additional client profile on an existing family phone.
- The additional profile has no User/login credential (`userId = null`, `managedOnly = true`).
- Both profiles remain independently visible/selectable for ADMIN.
- If more than one active client profile uses a CLIENT account phone, login and refresh for that client account are blocked as ambiguous.
- Historical appointments/courses stay attached to each ClientProfile, never to the shared phone string.

Migration:
`20260821014500_shared_client_phone_profiles`

## Course is source of truth when creating an appointment
- Selecting a course removes the need to choose a second service.
- Frontend sends no separate serviceId for a course booking.
- Backend resolves Service strictly from `Course.serviceId`.
- Appointment stores that resolved service for relations/reporting.
- Calendar/details show the course title prominently and the underlying service readably.
- Course stores `specialistPayPerSession` snapshot at sale/import time.
- Course appointment copies specialist pay from that Course snapshot.

Migration:
`20260821015500_course_specialist_pay_snapshot`

The migration also repairs historical course appointments from the old UI:
- if Appointment.serviceId differs from Course.serviceId, it is corrected;
- Appointment.specialistPay is synchronized to the course payroll snapshot.

## Editing future scheduled appointments
ADMIN can edit:
- date;
- time;
- specialist;
- duration (30/60/90/120 min).

The specialist selector is recalculated for the edited date/time/duration and shows only specialists who are actually available for that slot.

Backend re-validates transactionally:
- appointment is future + SCHEDULED;
- client remains active;
- target specialist is active;
- client has no overlapping appointment;
- specialist has no overlapping appointment;
- specialist has no unavailable block;
- group session compatibility/capacity.

Existing drag/drop remains supported.
