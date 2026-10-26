# Dorsum v0.6.7 — Finance Spine Transparent Stage

- Исправлен жёлтый фон интерактивного позвоночника на странице «Финансы».
- Причина: общий стиль `.admin-page button` имел более высокую CSS-специфичность и перекрывал `background: transparent` у Spine Pull-to-Refresh.
- Добавлен локальный override только для `.finance-spine-stage` во всех состояниях (normal / hover / active).
- Физика позвоночника из v0.6.6 сохранена без изменений.
