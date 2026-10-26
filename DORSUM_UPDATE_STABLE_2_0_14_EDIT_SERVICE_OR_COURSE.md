# Dorsum stable 2.0.14 — edit scheduled appointment service/course

ADMIN can now change a SCHEDULED appointment between:
- one-off service;
- client's purchased course;
- another one-off service;
- another client course.

Course is authoritative:
- when a course is selected, its Service is used automatically;
- specialistPay comes from Course.specialistPayPerSession;
- appointment price becomes 0;
- appointment paymentStatus becomes PAID because the course covers the visit;
- Course.usedLessons increments by one.

When an appointment is removed from a course:
- the old course gets one lesson back;
- the appointment becomes a one-off;
- paymentStatus becomes PENDING;
- one-off price/discount/pay are recalculated from the selected Service.

Switching course A -> course B is transactional:
- one lesson is returned to A;
- B is validated (client owner, payment state, half-payment limit, expiry, remaining lessons);
- one lesson is consumed from B.

Finance guard:
- an already PAID one-off appointment cannot silently change service or become a course appointment.
- ADMIN must first correct it to PENDING and save, then change service/course.
This prevents previously recorded one-off cash from disappearing silently.

The same edit form still supports date, time, duration and available specialist.

Overdue SCHEDULED appointment:
- service/course may be corrected in place at its original time;
- changing its time to another past time remains forbidden.

No Prisma migration required.
