# Dorsum stable 2.0.4 — importing previously purchased courses

ADMIN can mark a newly-created course as `Курс был куплен ранее`.

For imported courses:
- `legacyImported = true`
- catalogue/base price is preserved in `basePrice`
- current Dorsum revenue is `price = 0`
- `isPaid = true`
- `paidAt = null`, so no fake payment appears in day/month finance ledgers
- ADMIN sets the initial `usedLessons`
- server validates `0 <= usedLessons <= totalLessons`

Example:
12-session package, 5 sessions completed before migration:
- totalLessons = 12
- usedLessons = 5
- remaining = 7
- price/current revenue = 0

Future appointments can use the same course normally and increase progress from the imported value.

Migration:
`20260821010000_course_legacy_import`
