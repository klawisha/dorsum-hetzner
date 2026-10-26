# Dorsum v0.7.1 — corrected massage tiers + configurable fixed floor

- Corrected 0–99 / 90-minute massage pay: 350 грн.
- 60-minute back massage now uses:
  `max(current tier 60-minute rate, Appointment.specialistPay)`.
- Added configurable Service flag:
  `massageUseHigherOfTierAndFixed`.
- The back 60-minute massage has this flag enabled by migration/catalog metadata.
- The rule is no longer tied to finance code by service title.
- Finance breakdown marks these services as `не ниже specialistPay`.
- Added follow-up migration `20260820123000_fix_massage_payroll_floor`.
- Original v0.7.0 migration was also corrected for clean installations.
