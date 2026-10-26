import { useState } from "react"
import { CheckCircle2, ShieldCheck, UserPlus } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { userApi } from "../features/users/user.api"

export default function AdminCreateClient() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [isMilitary, setIsMilitary] = useState(false)
  const [isPensioner, setIsPensioner] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [created, setCreated] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return

    setError("")
    setCreated(null)

    if (!fullName.trim()) return setError("Введите ФИО")
    if (!phone.trim()) return setError("Введите телефон")
    if (password.length < 12) return setError("Пароль для входа должен быть минимум 12 символов")
    if (password !== repeatPassword) return setError("Пароли не совпадают")

    setBusy(true)
    try {
      const response = await userApi.createClient({
        fullName,
        phone,
        password,
        isMilitary,
        isPensioner,
      })

      setCreated(response.data)
      setFullName("")
      setPhone("")
      setPassword("")
      setRepeatPassword("")
      setIsMilitary(false)
      setIsPensioner(false)
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не удалось создать клиента")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-page admin-create-account-page">
      <header className="admin-create-account-header">
        <p className="finance-eyebrow">CLIENT / CREATE</p>
        <h1>Создать клиента</h1>
        <p>Аккаунт и карточка клиента создаются одновременно. Клиент сможет войти по телефону и созданному паролю.</p>
      </header>

      <div className="admin-create-account-grid">
        <form className="admin-create-account-card" onSubmit={submit}>
          <div className="admin-create-account-card-title">
            <UserPlus size={20} />
            <div>
              <h2>Новый клиент</h2>
              <span>Без публичной регистрации</span>
            </div>
          </div>

          {error && <div className="finance-error">{error}</div>}

          {created && (
            <div className="admin-create-success">
              <CheckCircle2 size={18} />
              <div>
                <strong>Клиент создан</strong>
                <span>{created.profile.fullName} · {created.user.phone}</span>
              </div>
            </div>
          )}

          <label>
            <span>ФИО *</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="off"
              placeholder="Например: Иваненко Анна Сергеевна"
              maxLength={160}
            />
          </label>

          <label>
            <span>Телефон *</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              autoComplete="off"
              placeholder="+380 67 123 45 67"
            />
          </label>

          <div className="admin-create-two">
            <label>
              <span>Пароль для входа *</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Минимум 12 символов"
              />
            </label>

            <label>
              <span>Повторите пароль *</span>
              <input
                type="password"
                value={repeatPassword}
                onChange={(event) => setRepeatPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
          </div>

          <div className="admin-create-checks">
            <label>
              <input
                type="checkbox"
                checked={isMilitary}
                onChange={(event) => setIsMilitary(event.target.checked)}
              />
              <span>Военный</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={isPensioner}
                onChange={(event) => setIsPensioner(event.target.checked)}
              />
              <span>Пенсионер</span>
            </label>
          </div>

          <button className="admin-create-primary" type="submit" disabled={busy}>
            <UserPlus size={17} />
            {busy ? "Создаём…" : "Создать клиента"}
          </button>
        </form>

        <aside className="admin-create-account-note">
          <ShieldCheck size={21} />
          <p className="finance-eyebrow">КАК ЭТО РАБОТАЕТ</p>
          <h2>Одна операция</h2>
          <p>
            Система создаёт <strong>User</strong> с ролью CLIENT и связанную
            <strong> ClientProfile</strong> в одной транзакции. Если профиль не создастся,
            аккаунт тоже не останется в базе.
          </p>
          <p>
            Телефон проверяется на уникальность. Льготы сразу сохраняются в карточку и будут
            использоваться при расчёте скидок.
          </p>
          <button type="button" className="admin-create-secondary" onClick={() => navigate("/admin/clients")}>
            Открыть список клиентов
          </button>
        </aside>
      </div>
    </div>
  )
}
