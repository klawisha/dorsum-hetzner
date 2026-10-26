# Dorsum stable 2.0.10 — appointment edit/drag actually activated

Root cause:
`editScheduled` and `moveScheduled` existed in appointment.service.js but were accidentally located inside an old block comment.
The routes/controllers/frontend existed, but the service methods were not live at runtime.

Fixed:
- activated `editScheduled` backend method;
- activated `moveScheduled` backend method;
- retained ADMIN-only routes;
- moved the appointment editing panel to the top of Appointment Details so it is immediately visible;
- future SCHEDULED appointments show an explicit drag handle `⋮⋮`;
- ADMIN calendar displays a short drag/drop hint;
- FullCalendar interaction plugin remains enabled;
- desktop drag threshold tuned;
- mobile long-press drag delay reduced to 350ms;
- drag conflict still reverts the event automatically.

Editing allows:
- date
- time
- duration
- only specialists available for the edited slot

Backend rechecks client/specialist conflicts and unavailable blocks before saving.

No new Prisma migration.
