import { useEffect, useMemo, useState } from "react"
import { BadgeDollarSign, Package, RotateCcw, Save, ShoppingBag } from "lucide-react"
import { inventoryApi } from "../features/inventory.api"
import { clientApi } from "../features/client/client.api"

const money = (value) => `${Number(value || 0).toFixed(2)} грн`
const currentMonth = () => new Date().toISOString().slice(0, 7)

export default function InventorySales() {
  const [month, setMonth] = useState(currentMonth())
  const [items, setItems] = useState([])
  const [sales, setSales] = useState([])
  const [clients, setClients] = useState([])
  const [itemId, setItemId] = useState("")
  const [clientId, setClientId] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState("")
  const [note, setNote] = useState("")
  const [prices, setPrices] = useState({})
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const activeItems = useMemo(() => items.filter((item) => item.active), [items])
  const selectedItem = useMemo(() => items.find((item) => item.id === itemId), [items, itemId])
  const activeSales = useMemo(() => sales.filter((sale) => !sale.voidedAt), [sales])
  const monthTotal = activeSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0)

  async function load() {
    setError("")
    try {
      const [itemsResponse, salesResponse, clientsResponse] = await Promise.all([
        inventoryApi.items(),
        inventoryApi.sales(month),
        clientApi.getList(),
      ])
      setItems(itemsResponse.data)
      setSales(salesResponse.data)
      setClients(clientsResponse.data)
      setPrices(Object.fromEntries(itemsResponse.data.map((item) => [item.id, String(item.price || 0)])))
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не удалось загрузить продажи")
    }
  }

  useEffect(() => {
    load()
  }, [month])

  useEffect(() => {
    if (!selectedItem) return
    setUnitPrice(selectedItem.price > 0 ? String(selectedItem.price) : "")
  }, [selectedItem])

  async function createSale() {
    if (!itemId) {
      setError("Выберите товар")
      return
    }

    setBusy(true)
    setError("")
    try {
      await inventoryApi.createSale({
        itemId,
        clientId: clientId || null,
        quantity: Number(quantity),
        unitPrice: Number(unitPrice),
        note,
      })
      setQuantity(1)
      setClientId("")
      setNote("")
      await load()
    } catch (requestError) {
      const code = requestError.response?.data?.message
      setError(code === "SET_INVENTORY_PRICE"
        ? "Укажите цену товара или цену этой продажи."
        : code || "Не удалось сохранить продажу")
    } finally {
      setBusy(false)
    }
  }

  async function savePrice(item) {
    setError("")
    try {
      await inventoryApi.updateItem(item.id, { price: Number(prices[item.id]) })
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не удалось изменить цену")
    }
  }

  async function voidSale(sale) {
    if (!window.confirm(`Отменить продажу «${sale.item.name}» на ${money(sale.total)}?`)) return
    try {
      await inventoryApi.voidSale(sale.id)
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не удалось отменить продажу")
    }
  }

  return (
    <div className="admin-page inventory-page">
      <header className="inventory-header">
        <div>
          <p className="finance-eyebrow">РОЗНИЦА / ИНВЕНТАРЬ</p>
          <h1>Продажи инвентаря</h1>
          <p>Продажи входят в кассу и финансовый отчёт.</p>
        </div>
        <div className="inventory-month-total">
          <span>Продано за месяц</span>
          <strong>{money(monthTotal)}</strong>
        </div>
      </header>

      {error && <div className="finance-error">{error}</div>}

      <div className="inventory-layout">
        <section className="inventory-sale-panel">
          <div className="inventory-section-title">
            <ShoppingBag size={19} />
            <div><h2>Новая продажа</h2><p>Цена фиксируется в момент продажи.</p></div>
          </div>

          <label>
            <span>Товар</span>
            <select value={itemId} onChange={(event) => setItemId(event.target.value)}>
              <option value="">Выберите товар</option>
              {activeItems.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          <div className="inventory-two-fields">
            <label><span>Количество</span><input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
            <label><span>Цена за единицу</span><input type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="грн" /></label>
          </div>

          <label>
            <span>Клиент — необязательно</span>
            <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="">Розничная продажа</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.fullName}</option>)}
            </select>
          </label>

          <label><span>Комментарий</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Необязательно" /></label>

          <button className="inventory-primary" disabled={busy} onClick={createSale}>
            <BadgeDollarSign size={18} />
            {busy ? "Сохраняем…" : "Зафиксировать продажу"}
          </button>
        </section>

        <section className="inventory-catalog-panel">
          <div className="inventory-section-title">
            <Package size={19} />
            <div><h2>Каталог и цены</h2></div>
          </div>
          <div className="inventory-catalog-list">
            {items.map((item) => (
              <div className="inventory-item-row" key={item.id}>
                <div><strong>{item.name}</strong><span>{item.active ? "Активен" : "Скрыт"}</span></div>
                <div className="inventory-price-edit">
                  <input type="number" min="0" step="0.01" value={prices[item.id] ?? ""} onChange={(e) => setPrices((old) => ({ ...old, [item.id]: e.target.value }))} />
                  <button title="Сохранить цену" onClick={() => savePrice(item)}><Save size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="inventory-history">
        <div className="inventory-history-head">
          <div><h2>Продажи за месяц</h2><span>{activeSales.length} активных продаж</span></div>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>

        <div className="inventory-sales-list">
          {sales.length === 0 && <div className="inventory-empty">В этом месяце продаж пока нет.</div>}
          {sales.map((sale) => (
            <article className={`inventory-sale-row ${sale.voidedAt ? "is-void" : ""}`} key={sale.id}>
              <div>
                <strong>{sale.item.name}</strong>
                <span>{sale.client?.fullName || "Розничная продажа"} · {sale.quantity} × {money(sale.unitPrice)}</span>
                <small>{new Date(sale.soldAt).toLocaleString()}</small>
              </div>
              <b>{money(sale.total)}</b>
              {sale.voidedAt
                ? <span className="inventory-void-label">Отменено</span>
                : <button className="inventory-void-button" onClick={() => voidSale(sale)} title="Отменить продажу"><RotateCcw size={15} /></button>}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
