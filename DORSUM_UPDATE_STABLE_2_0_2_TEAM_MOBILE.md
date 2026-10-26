# Dorsum stable 2.0.2 — mobile team disclosure

Desktop/tablet:
- all specialists stay visible in the responsive grid.

Phone (<=760px):
- first 4 specialists are visible by default;
- remaining specialists stay in the DOM but are visually collapsed;
- `Показать всю команду · +N` expands the full list;
- `Свернуть команду` collapses it again and scrolls smoothly to the Team section;
- cards are slightly shorter on mobile to reduce page length.

No backend, API or database changes.
