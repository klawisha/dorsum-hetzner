import { MapPin, Phone } from "lucide-react"
import "./PlatformFooter.css"

const CENTER_ADDRESS = "г. Павлоград,ТЦ 'ЦУМ', ул. Шевченка 118 (3 этаж)"
const CENTER_PHONE_DISPLAY = "+38 066 114 14 53"
const CENTER_PHONE_HREF = "+380661141453"

export default function PlatformFooter({ compact = false }) {
  return (
    <footer className={`platform-footer${compact ? " is-compact" : ""}`}>
      <div className="platform-footer-brand">
        <strong>DORSUM</strong>
        <span>Kinesiotherapy Center</span>
      </div>

      <div className="platform-footer-contact">
        <MapPin size={15} />
        <span>{CENTER_ADDRESS}</span>
      </div>

      <a className="platform-footer-contact" href={`tel:${CENTER_PHONE_HREF}`}>
        <Phone size={15} />
        <span>{CENTER_PHONE_DISPLAY}</span>
      </a>

      <div className="platform-footer-credit">
        <span>DIGITAL PLATFORM</span>
        <strong>Designed &amp; Developed by Vladyslav Kosianenko</strong>
        <small>Vladyslav Kosianenko | Full-Cycle Engineer (Design, Dev &amp; Ops)</small>
      </div>
    </footer>
  )
}
