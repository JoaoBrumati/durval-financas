import { useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, ArrowUpRight, Banknote, Bell, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, FileUp, LayoutDashboard, Paperclip, Search, UserRoundPlus, UsersRound, X } from 'lucide-react'
import './App.css'

type Page = 'dashboard' | 'cadastro' | 'consulta'
type InstallmentStatus = 'paid' | 'open'
interface Installment { id: string; number: number; amount: number; dueDate: string; status: InstallmentStatus; paidAt?: string; receiptName?: string; receiptData?: string }
interface Client { id: string; name: string; cpf: string; address: string; phone: string; principal: number; interest: number; installmentCount: number; createdAt: string; installments: Installment[] }

const STORAGE_KEY = 'fluxo-clients-v2'
const LEGACY_STORAGE_KEY = 'fluxo-clients-v1'
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const currentDate = new Date()

function iso(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function fromISO(value: string) { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day, 12) }
function shiftMonth(date: Date, offset: number) { const next = new Date(date); const day = next.getDate(); next.setDate(1); next.setMonth(next.getMonth() + offset); next.setDate(Math.min(day, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())); return next }
function fmtDate(value?: string) { return value ? new Intl.DateTimeFormat('pt-BR').format(fromISO(value)) : '—' }
function makeInstallments(total: number, count: number, firstDueDate: string, paid = 0): Installment[] {
  let allocated = 0
  const regular = Math.floor((total / count) * 100) / 100
  return Array.from({ length: count }, (_, index) => {
    const amount = index === count - 1 ? Math.round((total - allocated) * 100) / 100 : regular
    allocated += amount
    const dueDate = iso(shiftMonth(fromISO(firstDueDate), index))
    return { id: crypto.randomUUID(), number: index + 1, amount, dueDate, status: index < paid ? 'paid' : 'open', ...(index < paid ? { paidAt: dueDate } : {}) }
  })
}

function loadClients(): Client[] {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) as Client[] : []
  } catch {
    return []
  }
}

function installmentState(item: Installment): 'paid' | 'open' | 'late' { return item.status === 'paid' ? 'paid' : item.dueDate < iso(currentDate) ? 'late' : 'open' }
function paidCount(client: Client) { return client.installments.filter((item) => item.status === 'paid').length }
function cpfMask(value: string) { return value.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2') }

function App() {
  const [clients, setClients] = useState<Client[]>(loadClients)
  const [page, setPage] = useState<Page>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [form, setForm] = useState({ name: '', cpf: '', address: '', phone: '', principal: '', interest: '', count: '10', firstDue: '' })
  const today = iso(currentDate)
  const selectedMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
  const metrics = useMemo(() => {
    const monthly = clients.filter((client) => client.createdAt.startsWith(selectedMonthKey))
    const allItems = clients.flatMap((client) => client.installments)
    return {
      lent: monthly.reduce((sum, client) => sum + client.principal, 0),
      profit: monthly.reduce((sum, client) => sum + client.interest, 0),
      active: clients.filter((client) => client.installments.some((item) => item.status !== 'paid')).length,
      receivable: allItems.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + item.amount, 0),
      overdue: allItems.filter((item) => installmentState(item) === 'late').length,
      monthlyCount: monthly.length,
    }
  }, [clients, selectedMonthKey])
  const upcoming = clients.flatMap((client) => client.installments.filter((item) => item.dueDate.startsWith(selectedMonthKey) && item.status !== 'paid').map((item) => ({ client, item, state: installmentState(item) }))).sort((a, b) => a.item.dueDate.localeCompare(b.item.dueDate)).slice(0, 5)
  const matches = clients.filter((client) => client.name.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')) || client.cpf.includes(query.trim()))

  function saveClients(next: Client[]) { setClients(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) }
  function notify(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 3200) }
  function saveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const principal = Number(form.principal); const interest = Number(form.interest); const count = Number(form.count)
    if (form.cpf.replace(/\D/g, '').length !== 11) return notify('Confira o CPF: ele precisa ter 11 dígitos.')
    if (!principal || interest < 0 || count < 1 || !form.firstDue) return notify('Preencha os valores e a primeira data de vencimento.')
    const client: Client = { id: crypto.randomUUID(), name: form.name.trim(), cpf: form.cpf, address: form.address.trim(), phone: form.phone.trim(), principal, interest, installmentCount: count, createdAt: today, installments: makeInstallments(principal + interest, count, form.firstDue) }
    saveClients([client, ...clients]); setSelectedId(client.id); setPage('consulta')
    setForm({ name: '', cpf: '', address: '', phone: '', principal: '', interest: '', count: '10', firstDue: '' })
    notify('Cadastro criado. As parcelas já estão disponíveis na consulta.')
  }
  function markPaid(clientId: string, installmentId: string) {
    saveClients(clients.map((client) => client.id !== clientId ? client : { ...client, installments: client.installments.map((item) => item.id === installmentId ? { ...item, status: 'paid', paidAt: today } : item) }))
    notify('Parcela baixada como paga.')
  }
  function attachReceipt(clientId: string, installmentId: string, file?: File) {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return notify('O comprovante precisa ter até 2 MB.')
    const reader = new FileReader()
    reader.onload = () => {
      saveClients(clients.map((client) => client.id !== clientId ? client : { ...client, installments: client.installments.map((item) => item.id === installmentId ? { ...item, receiptName: file.name, receiptData: String(reader.result) } : item) }))
      notify('Comprovante anexado à parcela.')
    }
    reader.readAsDataURL(file)
  }

  const title = page === 'dashboard' ? 'Visão geral' : page === 'cadastro' ? 'Novo empréstimo' : 'Clientes e parcelas'
  const nav: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }, { id: 'cadastro', label: 'Cadastro', icon: UserRoundPlus }, { id: 'consulta', label: 'Consulta', icon: Search }]

  return <div className={`app-shell ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
    <aside className="sidebar">
      <a className="brand" href="#dashboard" onClick={(event) => { event.preventDefault(); setPage('dashboard') }}><span className="brand-mark"><CircleDollarSign size={22} /></span><span><strong>fluxo</strong><small>gestão de crédito</small></span></a>
      <div className="side-label">MENU PRINCIPAL</div>
      <nav className="side-nav" aria-label="Navegação principal">{nav.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`nav-item ${page === id ? 'is-active' : ''}`} onClick={() => { setPage(id); if (id !== 'consulta') setSelectedId(null) }}><Icon size={18} /><span>{label}</span>{id === 'consulta' && metrics.overdue > 0 && <span className="nav-count">{metrics.overdue}</span>}</button>)}</nav>
      <button className="sidebar-toggle" type="button" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'} aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}>{sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}<span>{sidebarCollapsed ? 'Expandir' : 'Recolher'}</span></button>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>Fluxo</span><ChevronRight size={14} /><span>{title}</span></div><div className="topbar-actions"><span className="today-label"><CalendarDays size={15} />{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(currentDate)}</span><button className="icon-button notification-button" type="button" title="Ver parcelas em atraso" aria-label={`${metrics.overdue} parcelas em atraso`} onClick={() => setPage('consulta')}><Bell size={18} /><span className="notification-dot" /></button><span className="user-avatar">FC</span></div></header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">{page === 'dashboard' ? 'PAINEL FINANCEIRO' : page === 'cadastro' ? 'CARTEIRA / CADASTRO' : 'CARTEIRA / CONSULTA'}</div><h1>{title}</h1></div></div>
        {page === 'dashboard' && <Dashboard metrics={metrics} upcoming={upcoming} clients={clients} seeAll={() => setPage('consulta')} select={(id) => { setSelectedId(id); setPage('consulta') }} create={() => setPage('cadastro')} selectedMonth={selectedMonth} selectedYear={selectedYear} onMonthChange={setSelectedMonth} onYearChange={setSelectedYear} />}
        {page === 'cadastro' && <section className="form-layout">
          <form className="surface loan-form" onSubmit={saveClient}>
            <div className="section-heading"><div><span className="section-kicker">DADOS DO CONTRATO</span><h2>Informações do cliente</h2></div><span className="required-note">* Campos obrigatórios</span></div>
            <div className="form-grid">
              <label className="field field-wide"><span>Nome completo <b>*</b></span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Maria da Silva" /></label>
              <label className="field"><span>CPF <b>*</b></span><input required inputMode="numeric" value={form.cpf} onChange={(event) => setForm({ ...form, cpf: cpfMask(event.target.value) })} placeholder="000.000.000-00" /></label>
              <label className="field"><span>Telefone</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="(00) 00000-0000" /></label>
              <label className="field field-wide"><span>Endereço</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Rua, número, bairro e cidade" /></label>
            </div>
            <div className="form-divider" /><div className="section-heading contract-heading"><div><span className="section-kicker">CONDIÇÕES DO EMPRÉSTIMO</span><h2>Valores e pagamento</h2></div></div>
            <div className="form-grid finance-grid">
              <label className="field"><span>Valor emprestado <b>*</b></span><div className="input-prefix"><span>R$</span><input required type="number" min="0.01" step="0.01" value={form.principal} onChange={(event) => setForm({ ...form, principal: event.target.value })} placeholder="0,00" /></div></label>
              <label className="field"><span>Juros totais <b>*</b></span><div className="input-prefix"><span>R$</span><input required type="number" min="0" step="0.01" value={form.interest} onChange={(event) => setForm({ ...form, interest: event.target.value })} placeholder="0,00" /></div></label>
              <label className="field"><span>Quantidade de parcelas <b>*</b></span><select value={form.count} onChange={(event) => setForm({ ...form, count: event.target.value })}>{[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 24].map((count) => <option key={count} value={count}>{count}x</option>)}</select></label>
              <label className="field"><span>1º vencimento <b>*</b></span><input required type="date" value={form.firstDue} onChange={(event) => setForm({ ...form, firstDue: event.target.value })} /></label>
            </div>
            <div className="form-summary"><div><span>Total a receber</span><strong>{currency.format((Number(form.principal) || 0) + (Number(form.interest) || 0))}</strong></div><div><span>Valor por parcela</span><strong>{currency.format(((Number(form.principal) || 0) + (Number(form.interest) || 0)) / (Number(form.count) || 1))}</strong></div><div><span>Lucro em juros</span><strong className="profit-value">{currency.format(Number(form.interest) || 0)}</strong></div></div>
            <div className="form-footer"><span><CheckCircle2 size={15} />Confira os dados antes de salvar.</span><button className="primary-button" type="submit"><Check size={17} />Salvar cadastro</button></div>
          </form>
          <aside className="form-aside"><div className="aside-number">01 <span>/ 01</span></div><h3>Um contrato claro começa com os dados certos.</h3><p>O total do contrato soma o valor emprestado aos juros. As parcelas são calculadas automaticamente e organizadas por vencimento.</p><div className="aside-rule" /><div className="aside-example"><span>SIMULAÇÃO</span><div><strong>R$ 1.000,00</strong><small>Valor emprestado</small></div><ArrowRight size={16} /><div><strong>+ R$ 300,00</strong><small>Juros totais</small></div><div className="aside-total"><span>Total do contrato</span><strong>R$ 1.300,00</strong></div></div></aside>
        </section>}
        {page === 'consulta' && <Consultation clients={matches} query={query} setQuery={setQuery} selectedId={selectedId} select={(id) => setSelectedId(selectedId === id ? null : id)} markPaid={markPaid} attach={attachReceipt} />}
      </div>
    </main>
    {notice && <div className="toast" role="status"><CheckCircle2 size={18} />{notice}<button type="button" onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={15} /></button></div>}
  </div>
}

type Metrics = { lent: number; profit: number; active: number; receivable: number; overdue: number; monthlyCount: number }
type DueItem = { client: Client; item: Installment; state: 'paid' | 'open' | 'late' }

function Dashboard({ metrics, upcoming, clients, seeAll, select, create, selectedMonth, selectedYear, onMonthChange, onYearChange }: { metrics: Metrics; upcoming: DueItem[]; clients: Client[]; seeAll: () => void; select: (id: string) => void; create: () => void; selectedMonth: number; selectedYear: number; onMonthChange: (value: number) => void; onYearChange: (value: number) => void }) {
  const allItems = clients.flatMap((client) => client.installments)
  const paid = allItems.filter((item) => item.status === 'paid').length
  const count = clients.reduce((sum, client) => sum + client.installmentCount, 0)
  const progress = count ? Math.round((paid / count) * 100) : 0
  const period = monthLabel.format(new Date(selectedYear, selectedMonth - 1, 1))
  const monthLabelOptions = Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2024, index, 1)).replace(/^[a-zà-ú]/, (letter) => letter.toUpperCase()) }))
  const yearOptions = Array.from(new Set([selectedYear, ...clients.map((client) => Number(client.createdAt.slice(0, 4))), currentDate.getFullYear()])).sort((a, b) => a - b)
  return <>
    <div className="dashboard-intro"><p>Acompanhe sua carteira de empréstimos e recebimentos.</p><div className="period-chip period-selector"><CalendarDays size={15} /><select value={selectedMonth} onChange={(event) => onMonthChange(Number(event.target.value))} aria-label="Selecionar mês">{monthLabelOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select><select value={selectedYear} onChange={(event) => onYearChange(Number(event.target.value))} aria-label="Selecionar ano">{yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}</select></div></div>
    <section className="metric-grid" aria-label="Resumo do mês">
      <article className="metric-card metric-primary"><div className="metric-top"><span>Emprestado no mês</span><span className="metric-icon"><Banknote size={19} /></span></div><strong>{currency.format(metrics.lent)}</strong><div className="metric-bottom"><span className="metric-trend"><ArrowUpRight size={14} />{metrics.monthlyCount} {metrics.monthlyCount === 1 ? 'novo contrato' : 'novos contratos'}</span><span>principal</span></div></article>
      <article className="metric-card"><div className="metric-top"><span>Lucro em juros</span><span className="metric-icon profit-icon"><CircleDollarSign size={19} /></span></div><strong className="metric-profit">{currency.format(metrics.profit)}</strong><div className="metric-bottom"><span>Retorno previsto</span><span className="metric-trend positive"><ArrowUpRight size={14} />este mês</span></div></article>
      <article className="metric-card"><div className="metric-top"><span>Pessoas ativas</span><span className="metric-icon people-icon"><UsersRound size={19} /></span></div><strong>{String(metrics.active).padStart(2, '0')}</strong><div className="metric-bottom"><span>Com saldo em aberto</span><button className="text-action" type="button" onClick={seeAll}>Ver lista <ArrowRight size={13} /></button></div></article>
      <article className="metric-card receivable-card"><div className="metric-top"><span>Falta receber</span><span className="metric-icon due-icon"><Clock3 size={19} /></span></div><strong>{currency.format(metrics.receivable)}</strong><div className="metric-bottom"><span>{metrics.overdue ? `${metrics.overdue} ${metrics.overdue === 1 ? 'parcela vencida' : 'parcelas vencidas'}` : 'Nenhuma parcela vencida'}</span><i className={`due-indicator ${metrics.overdue ? 'has-overdue' : ''}`} /></div></article>
    </section>
    <section className="overview-grid">
      <article className="surface portfolio-panel"><div className="panel-heading"><div><span className="section-kicker">VISÃO DA CARTEIRA</span><h2>Empréstimos e juros</h2></div><span className="select-like">Este mês <ChevronDown size={14} /></span></div>
        <div className="chart-summary"><div><span>Valor emprestado</span><strong>{currency.format(metrics.lent)}</strong></div><div><span>Juros previstos</span><strong className="profit-value">{currency.format(metrics.profit)}</strong></div><span className="chart-legend"><i className="legend-principal" />Principal <i className="legend-interest" />Juros</span></div>
        <div className="chart-wrap" role="img" aria-label={metrics.monthlyCount ? 'Comparativo de valor emprestado e juros no mês' : 'Sem empréstimos cadastrados neste mês'}><div className="chart-y-labels"><span>R$ 4 mil</span><span>R$ 3 mil</span><span>R$ 2 mil</span><span>R$ 1 mil</span><span>R$ 0</span></div><div className={`chart-plot ${metrics.monthlyCount ? '' : 'is-empty'}`}><div className="chart-gridlines"><i /><i /><i /><i /><i /></div><svg viewBox="0 0 660 182" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#386c58" stopOpacity=".18" /><stop offset="100%" stopColor="#386c58" stopOpacity="0" /></linearGradient></defs><path className="chart-area" d="M0 135 C46 133 52 113 110 117 S180 127 220 104 S292 92 330 101 S397 63 440 70 S512 42 550 51 S621 24 660 22 L660 182 L0 182 Z" /><path className="chart-line principal-line" d="M0 135 C46 133 52 113 110 117 S180 127 220 104 S292 92 330 101 S397 63 440 70 S512 42 550 51 S621 24 660 22" /><path className="chart-line interest-line" d="M0 164 C46 160 63 154 110 157 S179 146 220 151 S289 139 330 143 S395 126 440 133 S507 113 550 118 S616 98 660 105" /><circle cx="660" cy="22" r="4" className="chart-dot" /><circle cx="660" cy="105" r="4" className="chart-dot chart-dot-interest" /></svg><div className="chart-x-labels"><span>01</span><span>05</span><span>10</span><span>15</span><span>20</span><span>25</span><span>31</span></div></div></div>
        <div className="chart-footnote"><span><i />Dados referentes a {period}</span><span>Atualizado agora</span></div>
      </article>
      <article className="surface collection-panel"><div className="panel-heading"><div><span className="section-kicker">ACOMPANHAMENTO</span><h2>Parcelas recebidas</h2></div><span className="collection-icon"><CheckCircle2 size={18} /></span></div><div className="collection-total"><strong>{progress}%</strong><span>do total de parcelas</span></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><div className="collection-stats"><span><i className="status-dot dot-paid" />Pagas<strong>{paid}</strong></span><span><i className="status-dot dot-open" />Em aberto<strong>{count - paid}</strong></span></div><div className="collection-divider" /><button className="collection-link" type="button" onClick={seeAll}>Acompanhar parcelas <ArrowRight size={15} /></button></article>
    </section>
    <section className="surface due-panel"><div className="panel-heading due-heading"><div><span className="section-kicker">PRÓXIMOS RECEBIMENTOS</span><h2>Agenda de parcelas</h2></div><button className="text-action" type="button" onClick={seeAll}>Ver todos <ArrowRight size={14} /></button></div>
      {upcoming.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>CLIENTE</th><th>VENCIMENTO</th><th>PARCELA</th><th>VALOR</th><th>STATUS</th><th /></tr></thead><tbody>{upcoming.map(({ client, item, state }) => <tr key={item.id} onClick={() => select(client.id)}><td><ClientName client={client} /></td><td>{fmtDate(item.dueDate)}</td><td>{String(item.number).padStart(2, '0')}<span className="muted-inline"> / {client.installmentCount}</span></td><td className="amount-cell">{currency.format(item.amount)}</td><td><StatusPill status={state} /></td><td><ChevronRight className="row-chevron" size={16} /></td></tr>)}</tbody></table></div> : <EmptyState title="Tudo em dia" body="Não há parcelas pendentes na carteira." action="Cadastrar empréstimo" onAction={create} />}
    </section>
    <footer className="page-footnote"><span>FLUXO <i /> CONTROLE DE EMPRÉSTIMOS</span><span>Valores atualizados conforme os cadastros e pagamentos.</span></footer>
  </>
}

function ClientName({ client }: { client: Client }) { return <div className="client-cell"><span className="client-initials">{client.name.split(' ').slice(0, 2).map((part) => part[0]).join('')}</span><span><strong>{client.name}</strong><small>{client.cpf}</small></span></div> }
function StatusPill({ status }: { status: 'paid' | 'open' | 'late' }) { return <span className={`status-pill status-${status}`}><i />{status === 'paid' ? 'Paga' : status === 'late' ? 'Atrasada' : 'Em aberto'}</span> }
function EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) { return <div className="empty-state"><div className="empty-icon"><Banknote size={21} /></div><strong>{title}</strong><p>{body}</p>{action && onAction && <button className="text-action" type="button" onClick={onAction}>{action}<ArrowRight size={14} /></button>}</div> }

function Consultation({ clients, query, setQuery, selectedId, select, markPaid, attach }: { clients: Client[]; query: string; setQuery: (value: string) => void; selectedId: string | null; select: (id: string) => void; markPaid: (clientId: string, installmentId: string) => void; attach: (clientId: string, installmentId: string, file?: File) => void }) {
  const [filter, setFilter] = useState('all')
  const visible = clients.filter((client) => filter === 'active' ? client.installments.some((item) => item.status !== 'paid') : filter === 'late' ? client.installments.some((item) => installmentState(item) === 'late') : filter === 'paid' ? client.installments.every((item) => item.status === 'paid') : true)
  return <section className="surface consultation-panel"><div className="consultation-toolbar"><div><span className="section-kicker">CARTEIRA DE CLIENTES</span><h2>Acompanhe cada contrato</h2><p>Abra um cliente para consultar parcelas e registrar pagamentos.</p></div><div className="client-count"><strong>{visible.length}</strong><span>{visible.length === 1 ? 'cliente' : 'clientes'}</span></div></div>
    <div className="list-controls"><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou CPF" aria-label="Buscar por nome ou CPF" /><kbd>⌘ K</kbd></label><div className="filter-tabs">{[['all', 'Todos'], ['active', 'Ativos'], ['late', 'Atrasados'], ['paid', 'Quitados']].map(([value, label]) => <button key={value} type="button" className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
    {!visible.length ? <EmptyState title="Nenhum cliente encontrado" body="Tente buscar por outro nome ou ajuste os filtros." /> : <div className="client-list">{visible.map((client) => {
      const paid = paidCount(client); const outstanding = client.installments.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + item.amount, 0); const late = client.installments.filter((item) => installmentState(item) === 'late').length; const open = selectedId === client.id
      return <article className={`client-record ${open ? 'record-open' : ''}`} key={client.id}><button className="client-record-head" type="button" onClick={() => select(client.id)} aria-expanded={open}><span className="client-initials large-initials">{client.name.split(' ').slice(0, 2).map((part) => part[0]).join('')}</span><span className="record-name"><strong>{client.name}</strong><small>{client.cpf}<i />Desde {fmtDate(client.createdAt)}</small></span><span className="record-progress"><span>Parcelas pagas</span><strong>{paid}<i> / {client.installmentCount}</i></strong><span className="mini-progress"><i style={{ width: `${paid / client.installmentCount * 100}%` }} /></span></span><span className="record-outstanding"><span>Saldo a receber</span><strong>{currency.format(outstanding)}</strong>{late > 0 && <small className="late-note"><i />{late} em atraso</small>}</span><ChevronDown className={`record-chevron ${open ? 'rotated' : ''}`} size={18} /></button>
        {open && <div className="client-details"><div className="detail-strip"><div><span>VALOR EMPRESTADO</span><strong>{currency.format(client.principal)}</strong></div><div><span>JUROS DO CONTRATO</span><strong className="profit-value">{currency.format(client.interest)}</strong></div><div><span>TOTAL DO CONTRATO</span><strong>{currency.format(client.principal + client.interest)}</strong></div><div><span>ENDEREÇO</span><strong>{client.address || 'Não informado'}</strong></div></div><div className="installment-heading"><div><strong>Parcelas do contrato</strong><span>{paid} de {client.installmentCount} pagas</span></div><div className="status-legend"><span><i className="dot-paid" />Paga</span><span><i className="dot-open" />Em aberto</span><span><i className="dot-late" />Atrasada</span></div></div>
          <div className="installment-list">{client.installments.map((item) => { const state = installmentState(item); return <div className={`installment-row installment-${state}`} key={item.id}><span className="installment-number">{String(item.number).padStart(2, '0')}<small>/{client.installmentCount}</small></span><span className="installment-date"><strong>{fmtDate(item.dueDate)}</strong><small>{state === 'paid' ? `Pago em ${fmtDate(item.paidAt || item.dueDate)}` : 'Data de vencimento'}</small></span><span className="installment-amount">{currency.format(item.amount)}</span><StatusPill status={state} /><span className="installment-actions"><label className={`receipt-button ${item.receiptName ? 'has-receipt' : ''}`} title={item.receiptName || 'Anexar comprovante'}><Paperclip size={15} />{item.receiptName ? 'Comprovante' : 'Anexar'}<input type="file" accept="image/*,.pdf" onChange={(event) => { attach(client.id, item.id, event.target.files?.[0]); event.currentTarget.value = '' }} /></label>{state !== 'paid' && <button className="mark-paid-button" type="button" onClick={() => markPaid(client.id, item.id)} title="Marcar parcela como paga"><Check size={14} />Baixar</button>}{item.receiptData && <a className="receipt-open" href={item.receiptData} download={item.receiptName} title={`Abrir ${item.receiptName}`}><FileUp size={15} /></a>}</span></div> })}</div>
        </div>}
      </article>
    })}</div>}
    <div className="consultation-footer"><span>Mostrando <strong>{visible.length}</strong> de <strong>{clients.length}</strong> clientes</span><span><i className="status-dot dot-open" />Parcelas vencidas mudam para atrasadas automaticamente.</span></div>
  </section>
}

export default App
