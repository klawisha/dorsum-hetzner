# Dorsum stable 2.0.15 — tablet appointment editor layout

Fixed overlapping date/time controls in the ADMIN appointment editor.

Changes:
- date/time columns now use `minmax(0, 1fr)`;
- field wrappers explicitly allow shrinking with `min-width: 0`;
- native date/time inputs are forced to `width/max-width: 100%` and `box-sizing: border-box`;
- on tablet widths 561–900px, date/time and specialist/duration stack vertically;
- phone layout is also safely stacked;
- desktop layout remains two-column.

No backend or Prisma changes.
