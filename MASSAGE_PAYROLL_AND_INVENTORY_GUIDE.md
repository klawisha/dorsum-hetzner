# Настройка массажной зарплаты и продаж инвентаря

## Как считается массажная нагрузка

В месячную нагрузку попадают только занятия со статусом `COMPLETED`, у услуги которых:

```text
massageHalfHourTracking = true
```

Количество единиц:

```text
ceil(фактическая длительность занятия / 30 минут)
```

Примеры: 30 мин = 1, 60 мин = 2, 90 мин = 3.

Курсовое или разовое занятие значения не имеет — считается сам проведённый Appointment.

## Какие массажи получают динамическую ставку

Динамический тариф применяется только если:

```text
massageTieredPay = true
```

`Массаж спины (60 минут)` участвует и в количестве получасов, и в тарифной сетке,
но для него включён `massageUseHigherOfTierAndFixed=true`.

Его выплата считается:

```text
max(ставка по текущему tier, Appointment.specialistPay)
```

Например, если tier даёт 270 грн, а `specialistPay=250`, выплата = 270 грн.
Если `specialistPay=300`, выплата = 300 грн.

## Исходная сетка

`MassagePayrollPolicy.id = massage-policy-2026-08`

- 0–99: 30 мин = 150, 60 мин = 250, 90 мин = 350
- 100–149: 30 мин = 150, 60 мин = 270, 90 мин = 390
- 150+: 30 мин = 150, 60 мин = 290, 90 мин = 430

## Быстро выключить систему

```sql
UPDATE "MassagePayrollPolicy"
SET "enabled" = false,
    "updatedAt" = NOW()
WHERE "id" = 'massage-policy-2026-08';
```

После этого зарплата снова берётся из сохранённого в Appointment `specialistPay`
(или из `Service.specialistPayPerSession` как fallback).

## Изменить ставку

Например, сделать 90-минутный массаж в первом диапазоне 350:

```sql
UPDATE "MassagePayrollTier"
SET "pay90" = 350
WHERE "id" = 'massage-tier-0-99';
```

## Правильно изменить правила с нового месяца

Историю лучше не переписывать. Создайте новую `MassagePayrollPolicy` с более поздним
`effectiveFrom` и три новых tier-строки. Finance выбирает самую новую политику,
которая действует в рассматриваемом месяце.

## Исключить конкретную услугу из динамической ставки

Она продолжит давать получасы, но зарплата останется фиксированной:

```sql
UPDATE "Service"
SET "massageTieredPay" = false
WHERE "id" = '<SERVICE_ID>';
```

Полностью исключить услугу и из счётчика получасов:

```sql
UPDATE "Service"
SET "massageHalfHourTracking" = false,
    "massageTieredPay" = false
WHERE "id" = '<SERVICE_ID>';
```

## Инвентарь

Начальные товары создаются миграцией с ценой `0`, потому что цены не были заданы.
Их можно изменить на странице `Продажи инвентаря`.

Продажа хранит собственные `unitPrice` и `total`, поэтому изменение базовой цены товара
не меняет историю старых продаж.

Ошибочная продажа не удаляется физически: она получает `voidedAt`, после чего
перестаёт участвовать в кассе.


## Гарантированный fixed floor для любой массажной услуги

Чтобы для другой услуги тоже использовать большее из `tier` и `specialistPay`:

```sql
UPDATE "Service"
SET "massageTieredPay" = true,
    "massageUseHigherOfTierAndFixed" = true
WHERE "id" = '<SERVICE_ID>';
```

Чтобы вернуть обычную тарифную сетку без fixed floor:

```sql
UPDATE "Service"
SET "massageUseHigherOfTierAndFixed" = false
WHERE "id" = '<SERVICE_ID>';
```
