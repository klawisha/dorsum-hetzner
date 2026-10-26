import { useEffect, useState } from "react"
import { userApi } from "../features/users/user.api"
import { SPECIALIZATION_LABELS } from "../utils/specialistLabels"
import { CheckCircle2, Pencil, Plus, Trash2, UserRoundPlus, X } from "lucide-react"

export default function UsersManagement() {
  const [users, setUsers] = useState([])
  const [draftRoles, setDraftRoles] = useState({})
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [draftSpecializations, setDraftSpecializations] = useState({})
  const [draftColors, setDraftColors] = useState({})
  const [createOpen, setCreateOpen] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState("")
  const [createSuccess, setCreateSuccess] = useState("")
  const [archivingUserId, setArchivingUserId] = useState("")
  const [editingUserId, setEditingUserId] = useState("")
  const [newSpecialist, setNewSpecialist] = useState({
    fullName: "",
    phone: "",
    password: "",
    repeatPassword: "",
    color: "#0b8560",
    specializations: ["REHABILITATION_SPECIALIST"],
  })

const loadUsers = async () => {
  try {
    const res = await userApi.getAll(search)

    setUsers(res.data)

    const roles = {}
    const specs = {}
    const colors = {}

    res.data.forEach((user) => {
      roles[user.id] = user.role

      specs[user.id] =
        user.specialistProfile?.specializations || []

      colors[user.id] =
        user.specialistProfile?.color || "#3b82f6"
    })

    setDraftRoles(roles)
    setDraftSpecializations(specs)
    setDraftColors(colors)

  } catch {
    setError("Ошибка загрузки пользователей")
  }
}

  useEffect(() => {
    loadUsers()
  }, [])

  const saveRole = async (userId) => {
    try {
      await userApi.updateRole(userId, draftRoles[userId])
      await loadUsers()
    } catch (err) {
      alert(err.response?.data?.message || "Ошибка изменения роли")
    }
  }

const getFullName = (user) => {
  return (
    user.clientProfile?.fullName ||
    user.specialistProfile?.fullName ||
    "-"
  )
}

const specializationOptions = Object.entries(SPECIALIZATION_LABELS).map(([value, label]) => ({
  value,
  label,
}))


const toggleSpecialization = (userId, value) => {
  const current = draftSpecializations[userId] || []

  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]

  setDraftSpecializations({
    ...draftSpecializations,
    [userId]: next
  })
}

const saveSpecializations = async (userId) => {
  try {
    await userApi.updateSpecializations(
      userId,
      draftSpecializations[userId] || []
    )

    await loadUsers()
  } catch (err) {
    alert(
      err.response?.data?.message ||
      "Ошибка изменения специальностей"
    )
  }
}

const saveSpecialistColor = async (userId) => {
  try {
    await userApi.updateSpecialistColor(
      userId,
      draftColors[userId]
    )

    await loadUsers()
  } catch (err) {
    alert(
      err.response?.data?.message ||
      "Ошибка изменения цвета специалиста"
    )
  }
}


const toggleNewSpecialization = (value) => {
  const current = newSpecialist.specializations
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]

  setNewSpecialist({ ...newSpecialist, specializations: next })
}

const createSpecialist = async (event) => {
  event.preventDefault()
  if (createBusy) return

  setCreateError("")
  setCreateSuccess("")

  if (!newSpecialist.fullName.trim()) return setCreateError("Введите ФИО специалиста")
  if (!newSpecialist.phone.trim()) return setCreateError("Введите телефон")
  if (newSpecialist.password.length < 12) return setCreateError("Пароль для входа должен быть минимум 12 символов")
  if (newSpecialist.password !== newSpecialist.repeatPassword) return setCreateError("Пароли не совпадают")
  if (!newSpecialist.specializations.length) return setCreateError("Выберите хотя бы одну специализацию")

  setCreateBusy(true)
  try {
    const response = await userApi.createSpecialist({
      fullName: newSpecialist.fullName,
      phone: newSpecialist.phone,
      password: newSpecialist.password,
      color: newSpecialist.color,
      specializations: newSpecialist.specializations,
    })

    setCreateSuccess(`${response.data.profile.fullName} создан`)
    setNewSpecialist({
      fullName: "",
      phone: "",
      password: "",
      repeatPassword: "",
      color: "#0b8560",
      specializations: ["REHABILITATION_SPECIALIST"],
    })
    await loadUsers()
  } catch (err) {
    setCreateError(err.response?.data?.message || "Не удалось создать специалиста")
  } finally {
    setCreateBusy(false)
  }
}


const editSpecialist = async (user) => {
  if (user.role !== "SPECIALIST") return

  const fullName = window.prompt("ФИО специалиста", getFullName(user))
  if (fullName === null) return

  const phone = window.prompt("Телефон специалиста", user.phone || "")
  if (phone === null) return

  setEditingUserId(user.id)
  setError("")
  try {
    await userApi.updateIdentity(user.id, { fullName, phone })
    await loadUsers()
  } catch (err) {
    setError(err.response?.data?.message || "Не удалось изменить данные специалиста")
  } finally {
    setEditingUserId("")
  }
}

const archiveSpecialist = async (user) => {
  if (user.role !== "SPECIALIST") return

  const fullName = getFullName(user)
  const confirmed = window.confirm(
    `Удалить специалиста из активной базы?\n\n${fullName}\n${user.phone || ""}\n\nПрошлые занятия и финансовая история останутся. Специалист больше не сможет войти и исчезнет из выбора для новых записей.`
  )

  if (!confirmed) return

  setArchivingUserId(user.id)
  setError("")

  try {
    await userApi.archive(user.id, "Специалист удалён из активной базы администратором")
    await loadUsers()
  } catch (err) {
    const code = err.response?.data?.message
    if (code === "HAS_FUTURE_APPOINTMENTS") {
      const raw = err.response?.data?.nextAppointmentAt
      const when = raw ? new Date(raw).toLocaleString("ru-RU") : ""
      setError(`У специалиста есть будущее запланированное занятие${when ? ` (${when})` : ""}. Сначала отмените или перенесите его.`)
    } else {
      setError(code || "Не удалось удалить специалиста из активной базы")
    }
  } finally {
    setArchivingUserId("")
  }
}

  return (
<div className="admin-page users-management-page">
      <div className="users-management-header">
        <div>
          <p className="finance-eyebrow">STAFF / ACCESS</p>
          <h1>Специалисты</h1>
          <p className="users-management-subtitle">Аккаунты, роли, специализации и цвета расписания.</p>
        </div>
        <button className="users-add-specialist-button" onClick={() => setCreateOpen((value) => !value)}>
          {createOpen ? <X size={17} /> : <UserRoundPlus size={17} />}
          {createOpen ? "Закрыть" : "Добавить специалиста"}
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {createOpen && (
        <form className="specialist-create-panel" onSubmit={createSpecialist}>
          <div className="specialist-create-heading">
            <div>
              <p className="finance-eyebrow">NEW SPECIALIST</p>
              <h2>Новый специалист</h2>
              <span>Аккаунт и профиль специалиста создаются одновременно.</span>
            </div>
          </div>

          {createError && <div className="finance-error">{createError}</div>}
          {createSuccess && (
            <div className="admin-create-success">
              <CheckCircle2 size={17} />
              <strong>{createSuccess}</strong>
            </div>
          )}

          <div className="specialist-create-grid">
            <label>
              <span>ФИО *</span>
              <input
                value={newSpecialist.fullName}
                onChange={(e) => setNewSpecialist({ ...newSpecialist, fullName: e.target.value })}
                placeholder="ФИО специалиста"
                maxLength={160}
              />
            </label>

            <label>
              <span>Телефон *</span>
              <input
                value={newSpecialist.phone}
                onChange={(e) => setNewSpecialist({ ...newSpecialist, phone: e.target.value })}
                inputMode="tel"
                placeholder="+380 67 123 45 67"
              />
            </label>

            <label>
              <span>Пароль для входа *</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newSpecialist.password}
                onChange={(e) => setNewSpecialist({ ...newSpecialist, password: e.target.value })}
                placeholder="Минимум 12 символов"
              />
            </label>

            <label>
              <span>Повторите пароль *</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newSpecialist.repeatPassword}
                onChange={(e) => setNewSpecialist({ ...newSpecialist, repeatPassword: e.target.value })}
              />
            </label>
          </div>

          <div className="specialist-create-options">
            <div>
              <span className="specialist-create-label">Специализации *</span>
              <div className="specialist-create-specs">
                {specializationOptions.map((item) => (
                  <label key={item.value}>
                    <input
                      type="checkbox"
                      checked={newSpecialist.specializations.includes(item.value)}
                      onChange={() => toggleNewSpecialization(item.value)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="specialist-create-color">
              <span>Цвет в расписании</span>
              <div>
                <input
                  type="color"
                  value={newSpecialist.color}
                  onChange={(e) => setNewSpecialist({ ...newSpecialist, color: e.target.value })}
                />
                <code>{newSpecialist.color}</code>
              </div>
            </label>
          </div>

          <button className="admin-create-primary specialist-create-submit" type="submit" disabled={createBusy}>
            <Plus size={17} />
            {createBusy ? "Создаём…" : "Создать специалиста"}
          </button>
        </form>
      )}

<div className="users-toolbar" style={{ marginBottom: 16 }}>
  <input
    className="admin-search-input"
    placeholder="Поиск по ФИО или телефону"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    style={{
      padding: 10,
      width: 300,
      marginRight: 10
    }}
  />

  <button className="compact-action-button users-search-button" onClick={loadUsers}>
    Search
  </button>
</div>

      <div className="admin-table-shell users-table-shell">
      <table className="responsive-table users-table" border="1" cellPadding="10" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Телефон</th>
            <th>Current role</th>
            <th>New role</th>
            <th>Specializations</th>
            <th>Color</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td data-label="ФИО">{getFullName(user)}</td>

              <td data-label="Телефон">{user.phone || user.email || "—"}</td>

              <td data-label="Текущая роль">{user.role}</td>

              <td data-label="Новая роль">
                <select
                  value={draftRoles[user.id] || user.role}
                  onChange={(e) =>
                    setDraftRoles({
                      ...draftRoles,
                      [user.id]: e.target.value
                    })
                  }
                >
                  <option value="CLIENT">CLIENT</option>
                  <option value="SPECIALIST">SPECIALIST</option>
                  <option value="ADMIN">ADMIN</option>
                </select>

                <br />

                <button
                  className="compact-action-button"
                  onClick={() => saveRole(user.id)}
                  style={{
                    marginTop: 8
                  }}
                >
                  Save role
                </button>
              </td>

              <td data-label="Специализации">
                {user.role === "SPECIALIST" ? (
                  <div>
                    {specializationOptions.map((item) => (
                      <label
                        key={item.value}
                        style={{
                          display: "block",
                          marginBottom: 4
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            draftSpecializations[user.id]?.includes(item.value) || false
                          }
                          onChange={() =>
                            toggleSpecialization(user.id, item.value)
                          }
                        />

                        {" "}
                        {item.label}
                      </label>
                    ))}

                    <button
                      className="compact-action-button"
                      onClick={() => saveSpecializations(user.id)}
                      style={{ marginTop: 8 }}
                    >
                      Save specializations
                    </button>
                  </div>
                ) : (
                  "-"
                )}
              </td>

              <td data-label="Цвет">
              {user.role === "SPECIALIST" ? (
                <div>
                  <input
                    type="color"
                    value={draftColors[user.id] || "#3b82f6"}
                    onChange={(e) =>
                      setDraftColors({
                        ...draftColors,
                        [user.id]: e.target.value
                      })
                    }
                  />

                  <div
                    style={{
                      width: 40,
                      height: 20,
                      background: draftColors[user.id] || "#3b82f6",
                      borderRadius: 6,
                      border: "1px solid #ddd",
                      marginTop: 6
                    }}
                  />

                  <button
                    className="compact-action-button"
                    onClick={() => saveSpecialistColor(user.id)}
                    style={{ marginTop: 8 }}
                  >
                    Save color
                  </button>
                </div>
              ) : (
                "-"
              )}
            </td>

            <td data-label="Действия">
              {user.role === "SPECIALIST" ? (
                <div className="user-row-actions">
                  <button
                    type="button"
                    className="user-edit-button"
                    disabled={editingUserId === user.id}
                    onClick={() => editSpecialist(user)}
                    title="Изменить ФИО или телефон"
                  >
                    <Pencil size={14} />
                    <span>{editingUserId === user.id ? "Сохраняем…" : "Изменить"}</span>
                  </button>
                  <button
                    type="button"
                    className="user-archive-button"
                    disabled={archivingUserId === user.id}
                    onClick={() => archiveSpecialist(user)}
                    title="Удалить специалиста из активной базы"
                  >
                    <Trash2 size={14} />
                    <span>{archivingUserId === user.id ? "Удаляем…" : "Удалить"}</span>
                  </button>
                </div>
              ) : (
                "—"
              )}
            </td>
        </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}