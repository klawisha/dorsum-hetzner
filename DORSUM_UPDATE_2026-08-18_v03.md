# Dorsum v0.3

- Fixed timezone/date-click bug after 17:00: calendar now passes local Date and appointment modal formats the local calendar date without UTC conversion.
- Added dedicated Admin -> Финансы page with month selector, cash totals, payroll per specialist, service breakdown, and payment history.
- Calendar states: COMPLETED gray, CANCELLED white, NOT_COMPLETED dark red, scheduled keeps specialist color; paid appointments show a small $ badge.
- Registration and normal login are phone-first; new accounts do not require email. Legacy email login is still accepted by the API for migration safety.
- Added migration 20260818050000_phone_auth.
- Included repaired 20260818033000 pricing migration so a clean database can be built from Git.
