# Dorsum v0.7.5 — tablet finance spine collision fix

- Spine component moved after finance header in DOM.
- Desktop >=1101px keeps the hanging absolute rail.
- Tablet 761–1100px uses a dedicated normal-flow spine row below the month selector.
- Portrait tablet <=860px stacks the month selector and spine safely.
- Old tablet KPI/right-rail reservations are neutralized in this range.
- Mobile behavior remains unchanged.
- Pull-to-refresh physics and finance data logic are unchanged.
