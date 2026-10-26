# Dorsum v0.5.7 — mobile calendar scroll fix

- Исправлен обрезанный timeGrid на мобильных устройствах.
- Причина: `height="auto"` / `contentHeight="auto"` разворачивали сетку 08:00–21:00 целиком,
  а внешний dashboard ограничивал её высоту.
- На телефоне календарь теперь имеет адаптивную высоту `72dvh`.
- FullCalendar создаёт собственный вертикальный `.fc-scroller`.
- Прокручивается только область часов/занятий; toolbar и day header остаются в интерфейсе.
- Добавлены touch momentum scroll, `touch-action: pan-y` и overscroll containment.
- Desktop/tablet поведение не изменено.
