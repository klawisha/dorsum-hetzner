import { useEffect, useState } from "react"
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  HeartPulse,
  MapPin,
  Menu,
  LogOut,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react"
import { useNavigate } from "react-router-dom"

import { appointmentApi } from "../features/appointments/appointment.api"
import { useAuthStore } from "../store/auth.store"
import { formatSpecializations } from "../utils/specialistLabels"
import MovementLabCarousel from "../components/MovementLabCarousel"
import "./ClientHome.css"
import PlatformFooter from "../components/PlatformFooter"

const CENTER_PHONE_DISPLAY = "+38 066 114 14 53"
const CENTER_PHONE_HREF = "+380661141453"
const CENTER_ADDRESS = "г. Павлоград, ТЦ 'ЦУМ', ул. Шевченка 118 (3 этаж)"


const serviceDirections = [
  {
    title: "Кинезитерапия и реабилитация",
    description: "Индивидуальная работа над движением, силой и контролем тела.",
    image: "/service-images/kinesiotherapy.jpg",
    tag: "ДВИЖЕНИЕ",
  },
  {
    title: "Спортивный массаж",
    description: "Восстановление после нагрузок, работа с напряжением и подвижностью.",
    image: "/service-images/sport-massage.jpg",
    tag: "ВОССТАНОВЛЕНИЕ",
  },
  {
    title: "Силовой фитнес",
    description: "Разовая силовая тренировка с реабилитологом и контролем техники.",
    image: "/service-images/strength-fitness.jpg",
    tag: "СИЛА",
  },
  {
    title: "УХТ",
    description: "Ударно-волновая терапия как часть индивидуального плана восстановления.",
    image: "/service-images/shockwave.jpg",
    tag: "ТЕРАПИЯ",
  },
  {
    title: "Вакуумная терапия",
    description: "Дополнительная аппаратная работа в программах восстановления.",
    image: "/service-images/vacuum.jpg",
    tag: "ТЕРАПИЯ",
  },
  {
    title: "Стретчинг",
    description: "Групповые занятия для мобильности, контроля и комфортного движения.",
    image: "/service-images/stretching.jpg",
    tag: "МОБИЛЬНОСТЬ",
  },
]

const principles = [
  {
    index: "01",
    title: "Понять задачу",
    text: "Сначала определяем ограничения, цель и исходную точку, а не работаем вслепую с одним симптомом.",
  },
  {
    index: "02",
    title: "Построить план",
    text: "Комбинируем движение, нагрузку, восстановительные техники и подходящий формат занятий.",
  },
  {
    index: "03",
    title: "Вернуть контроль",
    text: "Цель — не просто временно убрать дискомфорт, а помочь человеку увереннее управлять своим телом.",
  },
]

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "D"
}

export default function ClientHome() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [serviceIndex, setServiceIndex] = useState(0)
  const [specialists, setSpecialists] = useState([])
  const [teamExpanded, setTeamExpanded] = useState(false)
  const [catalog,setCatalog] = useState([])
  const [catalogStatus,setCatalogStatus] = useState('loading')
  const [priceSearch,setPriceSearch] = useState('')
  const [priceKind,setPriceKind] = useState('all')
  const directionCategories = [['KINESIOTHERAPY','WELLNESS_FITNESS'],['MASSAGE'],['STRENGTH_FITNESS'],['SHOCKWAVE'],['VACUUM_THERAPY'],['STRETCHING']]
  const services = serviceDirections.map((direction,index)=>{
    const prices=catalog.filter(item=>!item.isPackage&&directionCategories[index].includes(item.category)).map(item=>Number(item.price))
    return {...direction,price:prices.length?'от '+Math.min(...prices).toLocaleString('ru-RU')+' грн':catalogStatus==='loading'?'Загружаем цену…':'Уточните в центре'}
  })
  const shownPrices=catalog.filter(item=>(!priceSearch||item.title.toLowerCase().includes(priceSearch.toLowerCase()))&&(priceKind==='all'||(priceKind==='courses'&&item.isPackage)||(priceKind==='single'&&!item.isPackage)||(priceKind==='child'&&item.audience==='CHILD')))


  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const logout = useAuthStore((state) => state.logout)
  const isClient = token && user?.role === "CLIENT"


  useEffect(() => {
    let cancelled = false

    async function loadSpecialists() {
      try {
        const response = await appointmentApi.getSpecialists()
        if (!cancelled) setSpecialists(response.data || [])
      } catch {
        if (!cancelled) setSpecialists([])
      }
    }

    loadSpecialists()
    return () => {
      cancelled = true
    }
  }, [])


  useEffect(()=>{
    let active=true
    async function loadPrices(){
      try { const response=await appointmentApi.getServices();if(active){setCatalog(response.data||[]);setCatalogStatus('ready')} }
      catch { if(active)setCatalogStatus('error') }
    }
    const refresh=()=>{if(document.visibilityState==='visible')loadPrices()}
    loadPrices()
    const timer=window.setInterval(refresh,30000)
    window.addEventListener('focus',refresh)
    document.addEventListener('visibilitychange',refresh)
    return ()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)}
  },[])

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    setMenuOpen(false)
  }

  const openCabinet = () => {
    if (isClient) navigate("/client/profile")
    else navigate("/login")
  }

  const signOut = async () => {
    await logout()
    navigate("/")
  }

  return (
    <div className="client-page">
      <header className="client-header">
        <div className="client-header-inner">
          <button className="brand-icon-button menu-trigger" onClick={() => setMenuOpen(true)} aria-label="Открыть меню">
            <Menu size={21} strokeWidth={2.2} />
          </button>

          <button className="client-logo" onClick={() => scrollToSection("top")} aria-label="Dorsum — наверх">
            <span>DORSUM</span>
            <small>CENTRE OF MOVEMENT</small>
          </button>

          <nav className="desktop-nav" aria-label="Навигация">
            <button onClick={() => scrollToSection("about")}>Подход</button>
            <button onClick={() => scrollToSection("services")}>Услуги</button>
            <button onClick={() => scrollToSection("prices")}>Прайс</button>
            <button onClick={() => scrollToSection("team")}>Команда</button>
            <button onClick={() => scrollToSection("contacts")}>Контакты</button>
          </nav>

          <div className="header-actions">
            <a href={`tel:${CENTER_PHONE_HREF}`} className="phone-link">
              <Phone size={15} />
              <span>{CENTER_PHONE_DISPLAY}</span>
            </a>

            {token && (
              <button className="header-logout-action" onClick={signOut} aria-label="Выйти из аккаунта" title="Выйти">
                <LogOut size={18} strokeWidth={2.2} />
                <span>Выйти</span>
              </button>
            )}

            <button className="brand-icon-button profile-link" onClick={openCabinet} aria-label="Личный кабинет">
              <User size={20} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Меню">
          <div className="mobile-menu-top">
            <span>DORSUM</span>
            <button className="brand-icon-button" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню">
              <X size={23} />
            </button>
          </div>
          <div className="mobile-menu-links">
            <button onClick={() => scrollToSection("about")}><span>01</span> Подход</button>
            <button onClick={() => scrollToSection("services")}><span>02</span> Услуги</button>
            <button onClick={() => scrollToSection("prices")}><span>03</span> Прайс</button>
            <button onClick={() => scrollToSection("team")}><span>04</span> Команда</button>
            <button onClick={() => scrollToSection("contacts")}><span>05</span> Контакты</button>
          </div>
          <div className="mobile-menu-footer">
            <a href={`tel:${CENTER_PHONE_HREF}`}>{CENTER_PHONE_DISPLAY}</a>
            <span>{CENTER_ADDRESS}</span>
            <button onClick={openCabinet}>Личный кабинет <ArrowUpRight size={18} /></button>
          </div>
        </div>
      )}

      <main>
        <section id="top" className="hero dorsum-section">
          <div className="hero-copy">
            <div className="eyebrow-row">
              <span className="brand-kicker">ЦЕНТР КИНЕЗИТЕРАПИИ</span>
              <span className="brand-index">ПАВЛОГРАД / UA</span>
            </div>

            <h1>
              ДВИЖЕНИЕ
              <span className="hero-outline">
                <b>БЕЗ</b><b>ЛИШНИХ</b>
              </span>
              <em>ОГРАНИЧЕНИЙ.</em>
            </h1>

            <p className="hero-lead">
              Реабилитация, кинезитерапия, массаж и силовая работа — в одном пространстве, где нагрузка становится инструментом восстановления.
            </p>

            <div className="hero-actions">
              <button className="brand-primary" onClick={openCabinet}>
                {isClient ? "Открыть кабинет" : "Войти в кабинет"}
                <ArrowRight size={19} />
              </button>
              <a className="brand-secondary" href={`tel:${CENTER_PHONE_HREF}`}>
                Связаться с центром
                <Phone size={18} />
              </a>
            </div>

            <div className="hero-proof">
              <div><HeartPulse size={19} /><span>Реабилитация и движение</span></div>
              <div><Dumbbell size={19} /><span>Управляемая нагрузка</span></div>
              <div><ShieldCheck size={19} /><span>Индивидуальный подход</span></div>
            </div>
          </div>

          <div className="hero-visual hero-interactive-visual">
            <MovementLabCarousel />
          </div>
        </section>

        <section id="about" className="brand-manifesto dorsum-section">
          <div className="manifesto-aside">
            <span className="brand-kicker">ПОДХОД DORSUM</span>
            <span className="manifesto-mark">01</span>
          </div>
          <div className="manifesto-copy">
            <h2>Не просто «убрать боль». <span>Вернуть телу работу.</span></h2>
            <p>
              Мы смотрим на движение целиком: что ограничивает человека, как он переносит нагрузку и что нужно изменить, чтобы результат был устойчивым в повседневной жизни.
            </p>
          </div>
        </section>

        <section className="principles dorsum-section" aria-label="Принципы работы">
          {principles.map((principle) => (
            <article className="principle-card" key={principle.index}>
              <span>{principle.index}</span>
              <h3>{principle.title}</h3>
              <p>{principle.text}</p>
            </article>
          ))}
        </section>

        <section id="services" className="services-section dorsum-section">
          <div className="section-heading-grid">
            <div>
              <span className="brand-kicker">НАПРАВЛЕНИЯ</span>
              <h2>Услуги <em>в движении.</em></h2>
            </div>
            <div className="section-heading-note">
              <p>Выберите направление.</p>
              <div className="services-controls">
                <button onClick={() => setServiceIndex((serviceIndex - 1 + services.length) % services.length)} aria-label="Предыдущая услуга"><ChevronLeft size={21} /></button>
                <span>{String(serviceIndex + 1).padStart(2, "0")} / {String(services.length).padStart(2, "0")}</span>
                <button onClick={() => setServiceIndex((serviceIndex + 1) % services.length)} aria-label="Следующая услуга"><ChevronRight size={21} /></button>
              </div>
            </div>
          </div>

          <div className="services-carousel-viewport">
            <div
              className="services-carousel-track"
              style={{ transform: `translate3d(calc(${serviceIndex} * (var(--service-card-width) + var(--service-gap)) * -1), 0, 0)` }}
            >
              {services.map((service, index) => (
                <article
                  className={index === serviceIndex ? "service-showcase-card active" : "service-showcase-card"}
                  key={service.title}
                  onClick={() => setServiceIndex(index)}
                >
                  <div className="service-media">
                    <img src={service.image} alt={service.title} onError={(event) => { event.currentTarget.style.display = "none" }} />
                    <span className="service-tag">{service.tag}</span>
                    <span className="service-number">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="service-copy">
                    <div>
                      <h3>{service.title}</h3>
                      <p>{service.description}</p>
                    </div>
                    <strong>{service.price}</strong>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="prices" className="price-editorial dorsum-section">
          <div className="price-intro">
            <span className="brand-kicker">СТОИМОСТЬ</span>
            <h2>Понятно.<br />Без <em>лишнего.</em></h2>
            <p>Актуальные цены центра: разовые услуги, взрослые и детские курсы. Подходящий формат и индивидуальный план можно подобрать с администратором.</p>
            <button className="brand-primary" onClick={openCabinet}>
              Личный кабинет <ArrowRight size={18} />
            </button>
          </div>

          <div className="price-editorial-list">
            <div className="public-price-controls"><input aria-label="Поиск по прайсу" placeholder="Название услуги или курса" value={priceSearch} onChange={e=>setPriceSearch(e.target.value)}/><select aria-label="Тип услуги" value={priceKind} onChange={e=>setPriceKind(e.target.value)}><option value="all">Все услуги</option><option value="single">Разовые</option><option value="courses">Курсы</option><option value="child">Детские</option></select></div>
            {catalogStatus==='loading'&&<p className="public-price-status">Загружаем актуальный прайс…</p>}
            {catalogStatus==='error'&&<p className="public-price-status">Не удалось обновить цены. Уточните стоимость в центре.</p>}
            {shownPrices.map((service,index)=>(
              <button className="price-editorial-row" key={service.id} onClick={openCabinet}>
                <span className="price-row-index">{String(index+1).padStart(2,'0')}</span>
                <span className="price-row-title">{service.title}<small>{service.isPackage?String(service.packageSessions)+' занятий · курс':String(service.durationMinutes)+' мин · разовая'}{service.audience==='CHILD'?' · для детей':''}{service.groupAllowed?' · группа до '+service.maxClients:''}</small></span>
                <strong>{Number(service.price).toLocaleString('ru-RU',{maximumFractionDigits:2})} грн</strong><ArrowUpRight size={20}/>
              </button>
            ))}
            {catalogStatus==='ready'&&!shownPrices.length&&<p className="public-price-status">Услуги по этому запросу не найдены.</p>}
          </div>
        </section>

        <section id="team" className="team-editorial dorsum-section">
          <div className="section-heading-grid">
            <div>
              <span className="brand-kicker">СПЕЦИАЛИСТЫ</span>
              <h2>Команда <em>Dorsum.</em></h2>
            </div>
            <p className="section-heading-note team-note">Специалисты центра кинезиотерапии DORSUM.</p>
          </div>

          <div className="team-content-grid">
            <div className="team-people-column">
              {specialists.length > 0 ? (
                <>
                  <div className={teamExpanded ? "team-grid team-grid-expanded" : "team-grid"}>
                    {specialists.map((specialist, index) => (
                      <article className="team-brand-card" key={specialist.id || `${specialist.fullName}-${index}`}>
                        <div className="team-avatar" style={{ "--specialist-color": specialist.color || "#c79b20" }}>
                          <span>{initials(specialist.fullName)}</span>
                          <Sparkles size={18} />
                        </div>
                        <div className="team-brand-copy">
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <h3>{specialist.fullName}</h3>
                          <p>{formatSpecializations(specialist.specializations)}</p>
                        </div>
                      </article>
                    ))}
                  </div>

                  {specialists.length > 4 && (
                    <button
                      type="button"
                      className="team-mobile-toggle"
                      aria-expanded={teamExpanded}
                      onClick={() => {
                        if (teamExpanded) {
                          setTeamExpanded(false)
                          requestAnimationFrame(() => {
                            document.getElementById("team")?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            })
                          })
                        } else {
                          setTeamExpanded(true)
                        }
                      }}
                    >
                      <span>
                        {teamExpanded
                          ? "Свернуть команду"
                          : `Показать всю команду · +${specialists.length - 4}`}
                      </span>
                      <ChevronRight
                        size={18}
                        className={teamExpanded ? "team-mobile-toggle-icon expanded" : "team-mobile-toggle-icon"}
                      />
                    </button>
                  )}
                </>
              ) : (
                <div className="team-empty">
                  <span>DORSUM TEAM</span>
                  <p>Команда центра будет отображаться здесь после загрузки данных специалистов.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="contacts" className="contact-cta dorsum-section">
          <div className="contact-cta-copy">
            <span className="brand-kicker">КОНТАКТЫ</span>
            <h2>Начать можно <em>с разговора.</em></h2>
            <p>Позвоните в центр или войдите в личный кабинет, если вы уже являетесь клиентом Dorsum.</p>
          </div>
          <div className="contact-cta-actions">
            <a href={`tel:${CENTER_PHONE_HREF}`}>
              <Phone size={22} />
              <span><small>ТЕЛЕФОН</small>{CENTER_PHONE_DISPLAY}</span>
              <ArrowUpRight size={21} />
            </a>
            <div>
              <MapPin size={22} />
              <span><small>АДРЕС</small>{CENTER_ADDRESS}</span>
            </div>
            <button onClick={openCabinet}>
              <User size={22} />
              <span><small>CLIENT AREA</small>Личный кабинет</span>
              <ArrowUpRight size={21} />
            </button>
          </div>
        </section>
      </main>

      <PlatformFooter />
    </div>
  )
}
