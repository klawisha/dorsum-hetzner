# Dorsum v0.7.3 — safe admin course deletion

- Added ADMIN-only `DELETE /courses/:id`.
- Course can be hard-deleted only when:
  - it has zero linked Appointment rows;
  - `usedLessons` is zero.
- A used/linked course returns HTTP 409 `COURSE_HAS_APPOINTMENTS`.
- No cascade deletion of appointment/history records is allowed.
- Deleting an accidentally created paid course removes it from finance calculations automatically.
- Courses Management now has a guarded delete button and explicit confirmation.
- Used courses show a disabled delete action.
- No Prisma schema change or migration is required.
