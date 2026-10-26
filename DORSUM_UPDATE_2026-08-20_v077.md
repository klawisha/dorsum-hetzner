# Dorsum v0.7.7 — Finance Month Pulse

- Added real `ПУЛЬС МЕСЯЦА` analytics to the Finance top area.
- Uses already loaded finance summary data; no extra API calls or DB migration.
- Daily revenue line is aggregated from appointment, course and inventory payments.
- Click/tap/focus a day on the graph to inspect that day's revenue.
- Shows peak daily revenue and current selected day.
- Shows revenue composition: appointments / courses / inventory.
- Tablet 821–1100px: pulse fills the former empty left space, spine gets a dedicated right column.
- Narrow tablet: pulse and spine stack without collisions.
- Desktop: pulse remains compact under the finance title, spine continues hanging on the right.
- Phone: compact single-column layout.
