import AppointmentCalendar
from "../features/appointments/AppointmentCalendar"

export default function Dashboard() {

  return (
    <div className="admin-page">
        <AppointmentCalendar />
    </div>
  )
}
/*import { useAuthStore } from "../store/auth.store"
import AppointmentCalendar from "../features/appointments/AppointmentCalendar"

export default function Dashboard() {

  return (
    <div>
      <AppointmentCalendar />
    </div>
  )
}
*/

/*export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  
  return (
    <div>
      <h1>Dashboard</h1>
      <p>System is working </p>
      <pre>{JSON.stringify(user, null, 2)}</pre>

    </div>
  )
}*/