# Dorsum stable 2.0.16 — actual tablet modal fix

The prior fix was attached to AppointmentCalendar.css. The appointment details
modal is not guaranteed to receive that stylesheet. The responsive rules are now
in pages/admin.css, which is loaded for the admin UI.

Tablet 600–1180 px:
- Date and Time stack vertically.
- Specialist and Duration stack vertically.
- native date/time/select controls are constrained to the modal width.

Phone:
- all editor grids stack.

Desktop above 1180 px:
- compact two-column layout remains.

No backend or Prisma changes.
