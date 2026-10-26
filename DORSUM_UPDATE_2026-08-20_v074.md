# Dorsum v0.7.4 — shared platform footer fix

- Fixed broken `PlatFooter.jsx` / `PlatformFooter` import mismatch.
- `PlatformFooter` is now self-contained and imports its own CSS.
- DashboardLayout renders footer after a flexible content body.
- ClientProfile imports the component correctly.
- ClientHome old duplicated custom footer is replaced by the shared component.
- Login and Register use the same footer through an auth shell.
- Footer is responsive and never fixed/overlayed.
- No backend or Prisma changes.
