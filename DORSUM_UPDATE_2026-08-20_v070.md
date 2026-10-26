# Dorsum v0.7.0 — massage half-hour payroll + inventory sales

## Massage payroll
- Every completed massage can contribute half-hour workload units (`ceil(duration / 30)`).
- One-off and course-linked appointments are treated identically.
- `MASSAGE` and `APPARATUS_MASSAGE` services are seeded as workload-tracked.
- 60-minute back massage contributes 2 half-hours but retains fixed pay.
- Other massage services use a versioned monthly tier policy.
- Initial tiers:
  - 0–99: 30=150, 60=250, 90=90
  - 100–149: 30=150, 60=270, 90=390
  - 150+: 30=150, 60=290, 90=430
- Tier is selected from the specialist's total completed massage half-hours for the month,
  then applied to all dynamic massage appointments in that month's payroll report.
- Policy can be disabled without deleting data; fixed appointment snapshots remain as fallback.
- Policy and tiers are normalized DB rows and can be versioned with `effectiveFrom/effectiveTo`.
- Finance UI shows half-hour count, selected tier and dynamic services.

## Inventory sales
- New ADMIN tab: `Продажи инвентаря`.
- Initial catalogue: sphere, small roller, medium roller, green Dorsum roller, tape, coloured tape.
- Prices start at 0 because no retail prices were supplied; admin sets them in UI.
- New sale records quantity, actual unit price, optional client and note.
- Sale prices are snapshots, so changing catalogue price never rewrites history.
- Incorrect sales are voided rather than hard-deleted.
- Non-void inventory sales are included in Finance cash, payment history and after-payroll amount.

## Migration
- `20260820113000_massage_payroll_inventory_sales`
