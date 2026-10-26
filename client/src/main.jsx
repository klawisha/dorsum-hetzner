import React from "react"
import ReactDOM from "react-dom/client"
import AppRouter from "./app/router"//"./routes/AppRouter"

import "./index.css"
import "./pages/admin.css"

import { initializeSession } from './api/axios'

initializeSession()
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
)
