# Dorsum stable 2.0.13 — legacy course may be half-paid

When ADMIN checks `Курс был куплен ранее`, payment choice remains available:
- Полностью
- Половина

Imported FULL:
- paymentState = PAID
- historical paidAmount is stored for reference
- paidAt = null
- no CoursePayment entry
- current Dorsum revenue = 0

Imported HALF:
- paymentState = HALF_PAID
- historical paidAmount = 50% of course value
- paidAt = null
- no historical CoursePayment entry
- current Dorsum revenue = 0
- booking is allowed only through the first half of lessons

If the second half is paid after migration:
- ADMIN presses `Доплачено?`
- only the remaining half is recorded as a new CoursePayment at the current date
- that real post-migration payment enters Dorsum finance
- remaining lessons unlock

No Prisma migration required.
