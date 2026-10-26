# Dorsum v0.6.5 — Finance Spine Refresh + Dorsum Loader

- Добавлен интерактивный Spine Pull-to-Refresh на странице Finance.
- Позвоночник собран векторно из отдельных позвонков; референсные изображения не используются как runtime-ассеты.
- Физика: Verlet integration + constraint relaxation, закреплённый верх, gravity/damping, drag нижней части, inertial sway.
- При растяжении выше threshold отображается `ОТПУСТИТЕ — ОБНОВИТЬ`; отпускание вызывает реальный `financeApi.summary` через существующий `load()`.
- Есть keyboard fallback Enter/Space и aria-label.
- На desktop позвоночник живёт в отдельной правой зоне; на tablet уменьшается; на mobile становится отдельным компактным блоком, не перекрывающим данные.
- Добавлен DorsumLoader: тёмная фирменная сетка, центральный векторный позвоночник, вращение вокруг Y, волновое искривление → выпрямление, progress-line.
- Loader используется при первом запуске приложения и при первой загрузке финансов.
- Повторное обновление финансов не блокирует страницу fullscreen overlay: показывается компактный статус.
- `prefers-reduced-motion` отключает активные motion-анимации.
- Новых npm dependencies, backend migrations и изменений БД нет.
