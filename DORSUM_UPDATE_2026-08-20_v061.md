# Dorsum v0.6.1 — emergency calendar rollback + safe axis fix

- Полностью отменена экспериментальная timezone-логика v0.6.0.
- События снова передаются FullCalendar напрямую как `appointment.startTime/endTime`, как в стабильной v0.5.9.
- Создание записи снова использует существующую локальную Date -> API схему проекта.
- Никаких преобразований Europe/Kyiv на frontend больше не добавляется.
- Рабочий диапазон: 07:00–20:00 включительно (`slotMaxTime=20:30`, т.к. FullCalendar max exclusive).
- Левая временная ось исправлена только CSS-ом, без влияния на appointment Date.
- Ширина axis: desktop 70px, mobile 62px, narrow mobile 60px.
- Значок оплаты получает отдельную зарезервированную область и не может перекрывать текст.
