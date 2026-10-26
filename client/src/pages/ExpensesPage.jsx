import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, FileImage, ReceiptText, RotateCcw, X } from 'lucide-react'
import { expensesApi } from '../features/expenses.api'
import DorsumLoader from '../components/DorsumLoader'

const money = (value) => `${Number(value || 0).toFixed(2)} грн`
const monthValue = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const todayValue = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ExpensesPage() {
  const [month, setMonth] = useState(monthValue())
  const [items, setItems] = useState([])
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [purchasedAt, setPurchasedAt] = useState(todayValue())
  const [note, setNote] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [receiptPreview, setReceiptPreview] = useState(null)
  const fileRef = useRef(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await expensesApi.list(month)
      setItems(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Не удалось загрузить расходы')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [month])

  const activeTotal = useMemo(
    () => items.filter((item) => !item.voidedAt).reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [items],
  )

  const chooseReceipt = (file) => {
    setError('')
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Чек: только JPG, PNG или WEBP')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Фото чека должно быть не больше 5 МБ')
      return
    }
    setReceipt(file)
  }

  const create = async (event) => {
    event.preventDefault()
    const cleanTitle = title.trim()
    const numericAmount = Number(amount)

    if (!cleanTitle) return setError('Укажите, что купили')
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError('Укажите корректную сумму')

    setBusy(true)
    setError('')
    try {
      const response = await expensesApi.create({
        title: cleanTitle,
        amount: numericAmount,
        purchasedAt: purchasedAt ? `${purchasedAt}T12:00:00` : undefined,
        note: note.trim() || undefined,
      })

      if (receipt) {
        const dataBase64 = await fileToDataUrl(receipt)
        try {
          await expensesApi.uploadReceipt(response.data.id, {
            dataBase64,
            mimeType: receipt.type,
            fileName: receipt.name,
          })
        } catch {
          setError('Расход сохранён, но фото чека не загрузилось. Его можно добавить позже.')
        }
      }

      setTitle('')
      setAmount('')
      setNote('')
      setReceipt(null)
      if (fileRef.current) fileRef.current.value = ''
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Не удалось сохранить расход')
    } finally {
      setBusy(false)
    }
  }

  const voidExpense = async (item) => {
    if (item.voidedAt) return
    if (!window.confirm(`Отменить списание?\n\n${item.title}\n${money(item.amount)}\n\nЗапись останется в истории, но перестанет влиять на финансы.`)) return

    setBusy(true)
    setError('')
    try {
      await expensesApi.void(item.id, 'Отменено администратором')
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Не удалось отменить расход')
    } finally {
      setBusy(false)
    }
  }

  const openReceipt = async (item) => {
    try {
      const response = await expensesApi.receipt(item.id)
      const url = URL.createObjectURL(response.data)
      setReceiptPreview({ url, title: item.title })
    } catch {
      setError('Не удалось открыть чек')
    }
  }

  const closeReceipt = () => {
    if (receiptPreview?.url) URL.revokeObjectURL(receiptPreview.url)
    setReceiptPreview(null)
  }

  return (
    <div className="admin-page expenses-page">
      <DorsumLoader active={loading && !items.length} fullscreen={false} label="Загружаем расходы" />

      <header className="expenses-header">
        <div>
          <p className="finance-eyebrow">EXPENSES / OUTFLOW</p>
          <h1>Расходы</h1>
          <p>Покупки центра, чеки и фактическое списание из финансов.</p>
        </div>
        <div className="expenses-month-box">
          <span>Списано за месяц</span>
          <strong>−{money(activeTotal)}</strong>
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </div>
      </header>

      {error && <div className="finance-error">{error}</div>}

      <div className="expenses-layout">
        <form className="expense-entry-card" onSubmit={create}>
          <div className="expenses-section-title">
            <div><h2>Новая покупка</h2><p>Сумма попадёт в расходы после сохранения.</p></div>
          </div>

          <label>
            <span>Что купили *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={180} placeholder="Например: бумага А4, вода, крем для массажа" />
          </label>

          <div className="expense-two-fields">
            <label>
              <span>Цена, грн *</span>
              <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </label>
            <label>
              <span>Дата покупки</span>
              <input type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} />
            </label>
          </div>

          <label>
            <span>Комментарий</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} placeholder="Необязательно" />
          </label>

          <div className={`expense-receipt-picker ${receipt ? 'has-file' : ''}`}>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => chooseReceipt(e.target.files?.[0])}
            />
            <Camera size={20} />
            <div>
              <strong>{receipt ? receipt.name : 'Фото чека'}</strong>
              <span>{receipt ? `${(receipt.size / 1024 / 1024).toFixed(2)} МБ` : 'Необязательно · JPG / PNG / WEBP · до 5 МБ'}</span>
            </div>
            {receipt && (
              <button type="button" onClick={(event) => {
                event.preventDefault()
                setReceipt(null)
                if (fileRef.current) fileRef.current.value = ''
              }} aria-label="Убрать чек"><X size={15} /></button>
            )}
          </div>

          <button className="inventory-primary" type="submit" disabled={busy}>
            <ReceiptText size={16} /> {busy ? 'Сохраняем…' : 'Записать расход'}
          </button>
        </form>

        <section className="expenses-ledger-card">
          <div className="expenses-section-title">
            <ReceiptText size={18} />
            <div><h2>История расходов</h2><p>{items.length} записей за выбранный месяц</p></div>
          </div>

          <div className="expense-ledger">
            {!loading && !items.length && <div className="inventory-empty">В этом месяце расходов пока нет.</div>}
            {items.map((item) => (
              <article className={`expense-row ${item.voidedAt ? 'is-void' : ''}`} key={item.id}>
                <div className="expense-row-main">
                  <strong>{item.title}</strong>
                  <span>{new Date(item.purchasedAt).toLocaleDateString('ru-RU')} {item.note ? `· ${item.note}` : ''}</span>
                  {item.voidedAt && <small>Списание отменено · в финансах не учитывается</small>}
                </div>
                <b>−{money(item.amount)}</b>
                <div className="expense-row-actions">
                  {item.receipt && (
                    <button type="button" onClick={() => openReceipt(item)} title="Открыть чек"><FileImage size={15} /></button>
                  )}
                  {!item.voidedAt && (
                    <button type="button" onClick={() => voidExpense(item)} title="Отменить списание"><RotateCcw size={15} /></button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {receiptPreview && (
        <div className="expense-receipt-modal" role="dialog" aria-modal="true" onClick={closeReceipt}>
          <div className="expense-receipt-modal-card" onClick={(e) => e.stopPropagation()}>
            <div><strong>{receiptPreview.title}</strong><button onClick={closeReceipt}><X size={18} /></button></div>
            <img src={receiptPreview.url} alt={`Чек: ${receiptPreview.title}`} />
          </div>
        </div>
      )}
    </div>
  )
}
