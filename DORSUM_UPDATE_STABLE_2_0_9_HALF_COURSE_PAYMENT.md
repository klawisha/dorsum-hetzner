# Dorsum stable 2.0.9 — half-paid courses

## Payment states
Course now has:
- UNPAID
- HALF_PAID
- PAID

Legacy `isPaid` remains for compatibility and becomes true only after full payment.

## Purchase
ADMIN can choose:
- Full payment
- Half payment

For HALF_PAID:
- only 50% of the discounted course price enters finance today;
- paidAmount stores the cumulative amount paid;
- the course is visibly marked `ОПЛАЧЕНО 1/2`.

## Lesson gate
A half-paid course unlocks only:
`ceil(totalLessons / 2)`

Examples:
- 12 sessions -> 6 available;
- 5 sessions -> 3 available.

Appointment creation is blocked server-side once the paid lesson limit is reached.
The frontend also removes a locked half-paid course from the booking selector.

## Second payment
ADMIN can press `Доплачено?`.
The backend records only the remaining amount as a new CoursePayment event at the current time,
sets Course.paymentState=PAID, and unlocks all remaining sessions.

## Finance
Course revenue now uses an immutable CoursePayment ledger instead of Course.paidAt.
This means:
- first half appears on the day it is actually paid;
- second half appears on the later day it is actually paid;
- historical full-paid courses are backfilled into the ledger;
- imported pre-Dorsum courses create no fake cash event.

Migration:
`20260821023000_course_partial_payments`
