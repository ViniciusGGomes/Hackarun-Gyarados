/**
 * Seed de desenvolvimento - Serviços do Capim Dourado Shopping.
 * Todos os dados são FICTÍCIOS (nomes, telefones, e-mails, objetos e horários).
 *
 * Uso:  pnpm prisma db seed   (ver "prisma.seed" no package.json)
 * Rodar de novo é seguro: dados de referência são atualizados (upsert) e os dados
 * transacionais (solicitações, itens encontrados etc.) são apagados e recriados.
 * Datas são relativas a "agora", então a agenda e as filas sempre parecem atuais.
 *
 * Variáveis opcionais: SEED_PASSWORD (senha dos usuários), SEED_FORCE=true (permite em produção).
 * Dependência: bcryptjs (troque pelo mesmo algoritmo que o login da API usar, ex. argon2).
 */
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import {
  PrismaClient,
  Prisma,
  EquipmentType,
  RequestStatus,
  RequestType,
  ObjectCategory,
  FoundItemStatus,
  SacSubject,
  LocationType,
  ServiceKind,
  ServiceFlow,
} from '@prisma/client'

const prisma = new PrismaClient()

// ------------------------------------------------------------------ utilidades
const TZ = 3 // America/Araguaina = UTC-3 (sem horário de verão)
const SLOT = 30
const LOAN = 120
const TOL = 15
const STORAGE_DAYS = 90

function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20261114) // semente fixa: mesmos dados a cada execução
const pick = <T>(a: readonly T[]): T => a[Math.floor(rand() * a.length)]
const chance = (p: number) => rand() < p
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1))

const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000)
const addDays = (d: Date, n: number) => addMin(d, n * 1440)
const localNow = () => new Date(Date.now() - TZ * 3600000)
/** Data/hora local (Palmas) a partir de "hoje + dayOffset". */
function local(dayOffset: number, h: number, m = 0) {
  const n = localNow()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + dayOffset, h + TZ, m))
}
/** Para colunas @db.Date. */
function dateOnly(d: Date) {
  const l = new Date(d.getTime() - TZ * 3600000)
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()))
}
const weekdayOf = (d: Date) => new Date(d.getTime() - TZ * 3600000).getUTCDay()
/** Início de bloco de 30 min, a partir de agora + minutos. */
function slotFromNow(minutes: number) {
  const t = new Date(Date.now() + minutes * 60000)
  t.setUTCMinutes(Math.floor(t.getUTCMinutes() / SLOT) * SLOT, 0, 0)
  return t
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const usedProtocols = new Set<string>()
function protocol(fixed?: string) {
  if (fixed) {
    usedProtocols.add(fixed)
    return fixed
  }
  let p = ''
  do {
    const s = (n: number) => Array.from({ length: n }, () => ALPHABET[Math.floor(rand() * ALPHABET.length)]).join('')
    p = `CAP-${s(4)}-${s(4)}`
  } while (usedProtocols.has(p))
  usedProtocols.add(p)
  return p
}

const FIRST = ['Maria', 'João', 'Ana', 'Carlos', 'Juliana', 'Pedro', 'Fernanda', 'Lucas', 'Patrícia', 'Rafael', 'Luciana', 'Marcos', 'Sônia', 'Bruno', 'Helena', 'Antônio', 'Beatriz', 'Gustavo', 'Daniela', 'Rodrigo']
const LAST = ['Souza', 'Lima', 'Costa', 'Alves', 'Rocha', 'Mendes', 'Barros', 'Dias', 'Ferraz', 'Nunes', 'Pereira', 'Teixeira', 'Prado', 'Ribeiro', 'Cardoso', 'Moura']
const slug = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
function person() {
  const f = pick(FIRST)
  const l = pick(LAST)
  return {
    name: `${f} ${l}`,
    phone: `63999${String(between(100000, 999999))}`,
    email: chance(0.4) ? `${slug(f)}.${slug(l)}@exemplo.com` : null,
  }
}

// ------------------------------------------------------------------ dados de referência
const locationSeed: [string, string, LocationType][] = [
  ['Entrada Principal (Av. NS-05)', 'Térreo', 'entrance'],
  ['Entrada Avenida JK', 'Térreo', 'entrance'],
  ['Entrada Avenida LO 2A', 'Térreo', 'entrance'],
  ['Praça de Eventos', 'Térreo', 'store_area'],
  ['Alameda das Cores', 'Térreo', 'store_area'],
  ['SAC / Espaço do Cliente', 'Térreo', 'service'], // posição fictícia
  ['Espaço Família', 'Térreo', 'service'],
  ['Banheiros Térreo', 'Térreo', 'service'],
  ['Cinemark', 'Térreo', 'store_area'],
  ['Praça de Alimentação', '2º pavimento', 'food_court'],
  ['Banheiros Praça de Alimentação', '2º pavimento', 'service'],
  ['Estacionamento Externo', 'Térreo', 'parking'],
  ['Estacionamento Subsolo 1', 'Subsolo 1', 'parking'],
  ['Estacionamento Subsolo 2', 'Subsolo 2', 'parking'],
  ['Bicicletário', 'Subsolo 1', 'parking'],
]

// slug, nome, tipo, fluxo, equipamento, descrição curta, ícone
const serviceSeed: [string, string, ServiceKind, ServiceFlow, EquipmentType | null, string, string][] = [
  ['cadeiras-de-rodas', 'Cadeiras de rodas', 'interactive', 'equipment_reservation', 'wheelchair', 'Empréstimo gratuito. Reserve o horário e retire no SAC.', 'wheelchair'],
  ['carrinhos-de-bebe', 'Carrinhos de bebê', 'interactive', 'equipment_reservation', 'stroller', 'Empréstimo gratuito para clientes. Reserve e retire no local.', 'baby'],
  ['achados-e-perdidos', 'Achados e perdidos', 'interactive', 'lost_report', null, 'Perdeu algo? Registre aqui e nossa equipe procura para você.', 'briefcase'],
  ['sac', 'SAC - Atendimento ao Cliente', 'interactive', 'sac_message', null, 'Dúvidas, reclamações, sugestões e elogios.', 'headset'],
  ['espaco-familia', 'Espaço Família', 'informational', 'none', null, 'Fraldário e apoio para famílias com crianças.', 'family'],
  ['banheiros-pne', 'Banheiros PNE', 'informational', 'none', null, 'Banheiros acessíveis em todos os pavimentos.', 'wc'],
  ['correios', 'Correios', 'informational', 'none', null, 'Agência dos Correios no shopping.', 'mail'],
  ['policia-federal', 'Polícia Federal', 'informational', 'none', null, 'Atendimento da Polícia Federal.', 'badge'],
  ['detran', 'Detran', 'informational', 'none', null, 'Serviços do Detran-TO.', 'car'],
  ['resolve-palmas', 'Resolve Palmas', 'informational', 'none', null, 'Serviços públicos municipais em um só lugar.', 'building'],
  ['espaco-do-cliente', 'Espaço do Cliente', 'informational', 'none', null, 'Atendimento e benefícios para clientes.', 'users'],
  ['maria-express', 'Maria Express', 'informational', 'none', null, 'Loja de conveniência no Subsolo 1.', 'store'],
  ['carregadores-eletricos', 'Carregadores elétricos', 'informational', 'none', null, 'Pontos de recarga para veículos elétricos.', 'plug'],
  ['pet-friendly', 'Pet friendly', 'informational', 'none', null, 'Regras para visitar o shopping com seu pet.', 'paw'],
  ['wi-fi', 'Wi-Fi', 'informational', 'none', null, 'Wi-Fi gratuito para clientes.', 'wifi'],
  ['estacionamento', 'Estacionamento', 'informational', 'none', null, 'Vagas no térreo e nos subsolos. Pague pelo app.', 'parking'],
  ['bicicletario', 'Bicicletário', 'informational', 'none', null, 'Bicicletário no Subsolo 1.', 'bike'],
]

const howItWorks: Record<string, string[]> = {
  'cadeiras-de-rodas': ['Escolha o horário', 'Retire no SAC com a sua reserva', 'Devolva no mesmo local'],
  'carrinhos-de-bebe': ['Escolha o horário', 'Retire no local informado', 'Devolva no mesmo local'],
  'achados-e-perdidos': ['Registre o objeto perdido', 'A equipe procura e compara com os itens encontrados', 'Avisamos você para retirar'],
  sac: ['Escolha o assunto', 'Escreva sua mensagem', 'Acompanhe a resposta pelo protocolo'],
}

const PRIVACY_TEXT =
  'Usamos seus dados (nome, telefone e e-mail opcional) apenas para atender a sua solicitação e avisar sobre o andamento. ' +
  'Os dados são apagados ou anonimizados após o prazo de retenção. Você pode pedir a exclusão pelo SAC. (Texto fictício para demonstração.)'

// ------------------------------------------------------------------ modelo de criação de solicitações
type Actor = 'staff' | 'visitor' | 'system'
type StaffKey = 'paulo' | 'camila' | 'marina'
interface Step { to: RequestStatus; at: Date; actor: Actor; user?: StaffKey; note?: string }
interface Msg { author: 'staff' | 'visitor'; text: string; at: Date; user?: StaffKey }
interface Base {
  type: RequestType
  name: string
  phone?: string | null
  email?: string | null
  createdAt: Date
  protocol?: string
  steps: Step[]
  messages?: Msg[]
  newReply?: boolean
  anonymized?: boolean
}
interface Detail {
  reservation?: Prisma.ReservationCreateWithoutRequestInput
  lostReport?: Prisma.LostReportCreateWithoutRequestInput
  sacMessage?: Prisma.SacMessageCreateWithoutRequestInput
}
const FINAL = new Set<RequestStatus>(['returned', 'cancelled', 'no_show', 'delivered', 'closed_not_found', 'closed'])
const STAFF = ['paulo', 'camila'] as const

const U: Record<string, string> = {} // id dos usuários
const L: Record<string, string> = {} // id dos locais
const S: Record<string, string> = {} // id dos serviços

async function createRequest(b: Base, d: Detail) {
  const last = b.steps[b.steps.length - 1]
  const firstStaff = b.messages?.find((m) => m.author === 'staff')
  return prisma.request.create({
    data: {
      protocol: protocol(b.protocol),
      type: b.type,
      status: last.to,
      visitorName: b.anonymized ? 'Anonimizado' : b.name,
      visitorPhone: b.anonymized ? null : (b.phone ?? null),
      visitorEmail: b.anonymized ? null : (b.email ?? null),
      hasNewVisitorReply: b.newReply ?? false,
      firstResponseAt: firstStaff?.at ?? null,
      completedAt: FINAL.has(last.to) ? last.at : null,
      anonymizedAt: b.anonymized ? addDays(last.at, 180) : null,
      createdAt: b.createdAt,
      updatedAt: last.at,
      consents: {
        create: { privacyNotice: { connect: { version: '1.0' } }, purpose: 'Atender a solicitação', acceptedAt: b.createdAt },
      },
      history: {
        create: b.steps.map((s, i) => ({
          fromStatus: i ? b.steps[i - 1].to : null,
          toStatus: s.to,
          actorType: s.actor,
          actorUser: s.user ? { connect: { id: U[s.user] } } : undefined,
          internalNote: s.note ?? null,
          createdAt: s.at,
        })),
      },
      messages: {
        create: (b.messages ?? []).map((m) => ({
          author: m.author,
          authorUser: m.user ? { connect: { id: U[m.user] } } : undefined,
          text: m.text,
          createdAt: m.at,
        })),
      },
      reservation: d.reservation ? { create: d.reservation } : undefined,
      lostReport: d.lostReport ? { create: d.lostReport } : undefined,
      sacMessage: d.sacMessage ? { create: d.sacMessage } : undefined,
    },
  })
}

// ---- reservas
type Outcome = 'reserved' | 'picked_up' | 'returned' | 'no_show' | 'cancelled'
interface ResOpts {
  type: EquipmentType
  name: string
  phone: string
  email?: string | null
  created?: Date
  start: Date
  outcome: Outcome
  forWhom?: 'self' | 'other'
  size?: 'adult' | 'child'
  kind?: 'single' | 'double'
  loc?: string
  notes?: string
  returnNotes?: string
  protocol?: string
  anonymized?: boolean
}
async function addReservation(o: ResOpts) {
  const created = o.created ?? addMin(o.start, -between(40, 2000))
  const staff = pick(STAFF)
  const steps: Step[] = [{ to: 'reserved', at: created, actor: 'visitor' }]
  const pickedUpAt = addMin(o.start, between(0, 10))
  const returnedAt = addMin(o.start, between(60, 115))
  if (o.outcome === 'picked_up' || o.outcome === 'returned') steps.push({ to: 'picked_up', at: pickedUpAt, actor: 'staff', user: staff })
  if (o.outcome === 'returned') steps.push({ to: 'returned', at: returnedAt, actor: 'staff', user: staff })
  if (o.outcome === 'no_show') steps.push({ to: 'no_show', at: addMin(o.start, TOL + 1), actor: 'system', note: 'Tolerância de retirada excedida' })
  if (o.outcome === 'cancelled') steps.push({ to: 'cancelled', at: addMin(o.start, -between(20, 60)), actor: 'visitor', note: 'Cancelado pelo visitante' })
  const wheel = o.type === 'wheelchair'
  return createRequest(
    { type: 'reservation', name: o.name, phone: o.phone, email: o.email, createdAt: created, steps, protocol: o.protocol, anonymized: o.anonymized },
    {
      reservation: {
        equipmentType: o.type,
        startAt: o.start,
        endAt: addMin(o.start, LOAN),
        pickupDeadline: addMin(o.start, TOL),
        pickedUpAt: o.outcome === 'picked_up' || o.outcome === 'returned' ? pickedUpAt : null,
        returnedAt: o.outcome === 'returned' ? returnedAt : null,
        forWhom: wheel ? (o.forWhom ?? 'self') : null,
        size: wheel ? (o.size ?? 'adult') : null,
        strollerKind: wheel ? null : (o.kind ?? 'single'),
        currentLocation: o.loc ? { connect: { id: L[o.loc] } } : undefined,
        notes: o.notes ?? null,
        returnNotes: o.outcome === 'returned' ? (o.returnNotes ?? 'Equipamento em bom estado') : null,
      },
    },
  )
}

// ---- achados e perdidos
const DESC: Record<ObjectCategory, string[]> = {
  documents: ['Carteira de identidade', 'Carteira de habilitação', 'Cartão de banco'],
  wallet_bag: ['Carteira de couro marrom', 'Bolsa pequena preta', 'Carteira preta com zíper'],
  phone_electronics: ['Celular com capinha escura', 'Fone de ouvido bluetooth branco', 'Carregador portátil'],
  keys: ['Chaveiro com 3 chaves', 'Chave de carro com controle', 'Chaves com pingente de capim dourado'],
  clothing_accessories: ['Casaco jeans', 'Boné preto', 'Cachecol listrado'],
  glasses_jewelry: ['Óculos de grau armação preta', 'Óculos de sol', 'Pulseira prateada'],
  other: ['Garrafa térmica azul', 'Guarda-chuva preto', 'Mochila cinza escura'],
}
const CATS = Object.keys(DESC) as ObjectCategory[]
const PERIODS = ['morning', 'afternoon', 'night'] as const
const LOST_LOCS = ['Praça de Alimentação', 'Praça de Alimentação', 'Estacionamento Subsolo 1', 'Estacionamento Externo', 'Alameda das Cores', 'Praça de Eventos', 'Cinemark', 'Banheiros Térreo']

interface FoundOpts {
  category: ObjectCategory
  description: string
  loc: string
  foundAt: Date
  by?: 'paulo' | 'camila'
  status?: FoundItemStatus
  place?: string
  closeAfterDays?: number
  closeNotes?: string
}
async function addFound(o: FoundOpts) {
  const closed = o.status && o.status !== 'stored'
  const closedAt = closed ? addDays(o.foundAt, o.closeAfterDays ?? 5) : null
  const by = o.by ?? pick(STAFF)
  const created = await prisma.foundItem.create({
    data: {
      code: `TMP-${randomUUID()}`, // ajustado abaixo com o seq gerado
      status: o.status ?? 'stored',
      category: o.category,
      description: o.description,
      foundLocation: { connect: { id: L[o.loc] } },
      foundAt: o.foundAt,
      storedPlace: o.place ?? 'Armário do SAC',
      handedInBy: pick(['Segurança', 'Limpeza', 'Cliente', 'Lojista']),
      storageDeadline: dateOnly(addDays(o.foundAt, STORAGE_DAYS)),
      registeredBy: { connect: { id: U[by] } },
      closedAt,
      closedBy: closed ? { connect: { id: U[by] } } : undefined,
      closeNotes: o.closeNotes ?? null,
      createdAt: o.foundAt,
    },
  })
  return prisma.foundItem.update({ where: { id: created.id }, data: { code: `ACH-${String(created.seq).padStart(4, '0')}` } })
}

const LOST_PATH: RequestStatus[] = ['registered', 'searching', 'possible_match', 'ready_for_pickup', 'delivered']
interface LostOpts {
  name: string
  phone: string
  email?: string | null
  created: Date
  category: ObjectCategory
  description: string
  ident?: string
  loc?: string
  status: RequestStatus
  foundItemId?: string
  protocol?: string
  messages?: Msg[]
  photoUrl?: string
}
async function addLost(o: LostOpts) {
  const staff = pick(STAFF)
  let path: RequestStatus[]
  if (o.status === 'closed_not_found') path = ['registered', 'searching', 'closed_not_found']
  else if (o.status === 'cancelled') path = ['registered', 'cancelled']
  else path = LOST_PATH.slice(0, LOST_PATH.indexOf(o.status) + 1)
  const steps: Step[] = path.map((to, i) => ({
    to,
    at: addMin(o.created, i * between(180, 1500)),
    actor: i === 0 || to === 'cancelled' ? 'visitor' : 'staff',
    user: i === 0 || to === 'cancelled' ? undefined : staff,
  }))
  const rank = LOST_PATH.indexOf(o.status)
  const lastAt = steps[steps.length - 1].at
  return createRequest(
    { type: 'lost_report', name: o.name, phone: o.phone, email: o.email, createdAt: o.created, steps, protocol: o.protocol, messages: o.messages },
    {
      lostReport: {
        category: o.category,
        description: o.description,
        identificationDetail: o.ident ?? null,
        photoUrl: o.photoUrl ?? null,
        location: o.loc ? { connect: { id: L[o.loc] } } : undefined,
        unknownLocation: !o.loc,
        lostDate: dateOnly(addMin(o.created, -between(0, 600))),
        lostPeriod: o.loc ? pick(PERIODS) : 'unknown',
        foundItem: o.foundItemId ? { connect: { id: o.foundItemId } } : undefined,
        matchedAt: o.foundItemId && rank >= 2 ? steps[2].at : null,
        identificationValidated: rank >= 3 ? true : null,
        deliveredAt: o.status === 'delivered' ? lastAt : null,
        deliveryNotes: o.status === 'delivered' ? 'Entregue ao proprietário com documento com foto.' : null,
      },
    },
  )
}

// ---- SAC
const SAC_TEXT: Record<SacSubject, string[]> = {
  complaint: ['O banheiro estava sem papel higiênico.', 'Ar-condicionado fraco na praça de alimentação.', 'Cobrança divergente no estacionamento.', 'Elevador parado por mais de 20 minutos.'],
  question: ['Qual o horário do Detran no shopping?', 'Vocês emprestam carregador de celular?', 'Posso entrar com meu cachorro?'],
  suggestion: ['Sugiro mais bancos perto da Praça de Eventos.', 'Seria bom ter sinalização para o bicicletário.'],
  compliment: ['Atendimento excelente do SAC hoje!', 'Equipe muito educada na retirada da cadeira de rodas.'],
  other: ['Gostaria de informações sobre eventos do mês.'],
  data_deletion: ['Solicito a exclusão dos meus dados pessoais.'],
}
interface SacOpts {
  subject: SacSubject
  message?: string
  name: string
  phone?: string | null
  email?: string | null
  created: Date
  status: RequestStatus
  service?: string
  relatedProtocol?: string
  responseMin?: number
  newReply?: boolean
  protocol?: string
}
async function addSac(o: SacOpts) {
  const staff = pick(STAFF)
  const resp = o.responseMin ?? between(20, 600)
  const SAC_PATH: RequestStatus[] = ['open', 'in_progress', 'answered', 'closed']
  const path = SAC_PATH.slice(0, SAC_PATH.indexOf(o.status) + 1)
  const times = [o.created, addMin(o.created, resp), addMin(o.created, resp + 40), addMin(o.created, resp + 1500)]
  const steps: Step[] = path.map((to, i) => ({ to, at: times[i], actor: i === 0 ? 'visitor' : 'staff', user: i === 0 ? undefined : staff }))
  const messages: Msg[] = []
  if (path.length > 1) messages.push({ author: 'staff', user: staff, at: times[1], text: 'Obrigado pelo contato. Já encaminhamos ao setor responsável e retornamos em breve.' })
  if (o.newReply) messages.push({ author: 'visitor', at: addMin(times[1], 90), text: 'Obrigado! Aguardo o retorno.' })
  return createRequest(
    { type: 'sac_message', name: o.name, phone: o.phone, email: o.email, createdAt: o.created, steps, messages, newReply: o.newReply, protocol: o.protocol },
    {
      sacMessage: {
        subject: o.subject,
        message: o.message ?? pick(SAC_TEXT[o.subject]),
        relatedService: o.service ? { connect: { id: S[o.service] } } : undefined,
        relatedProtocol: o.relatedProtocol ?? null,
      },
    },
  )
}

// ------------------------------------------------------------------ seed principal
async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_FORCE !== 'true') {
    console.error('Seed bloqueado em produção. Use SEED_FORCE=true se for intencional.')
    process.exit(1)
  }

  // 1) limpa dados transacionais (reinicia o seq dos itens encontrados)
  await prisma.$executeRawUnsafe('TRUNCATE TABLE requests, found_items, unmet_demands, job_logs RESTART IDENTITY CASCADE')

  // 2) dados de referência
  await prisma.privacyNotice.upsert({
    where: { version: '1.0' },
    update: { text: PRIVACY_TEXT, active: true },
    create: { version: '1.0', text: PRIVACY_TEXT, active: true },
  })

  await prisma.reservationSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })

  for (let weekday = 0; weekday <= 6; weekday++) {
    const sunday = weekday === 0
    const data = { closed: false, openTime: sunday ? '14:00' : '10:00', closeTime: sunday ? '20:00' : '22:00' }
    await prisma.openingHour.upsert({ where: { weekday }, update: data, create: { weekday, ...data } })
  }

  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? 'Senha@123', 10)
  const users: [string, string, string, 'manager' | 'attendant', boolean][] = [
    ['marina', 'Marina Gestora', 'gestor@exemplo.com', 'manager', true],
    ['paulo', 'Paulo Atendente', 'paulo@exemplo.com', 'attendant', true],
    ['camila', 'Camila Atendente', 'camila@exemplo.com', 'attendant', true],
    ['ex', 'Ex-atendente Inativo', 'inativo@exemplo.com', 'attendant', false],
  ]
  for (const [key, name, email, role, active] of users) {
    const u = await prisma.user.upsert({
      where: { email },
      update: { name, role, active, passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      create: { name, email, role, active, passwordHash },
    })
    U[key] = u.id
  }

  for (const [name, floor, type] of locationSeed) {
    const loc = await prisma.location.upsert({
      where: { name_floor: { name, floor } },
      update: { type, active: true },
      create: { name, floor, type },
    })
    L[name] = loc.id
  }
  // um local inativo, para testar o filtro
  await prisma.location.upsert({
    where: { name_floor: { name: 'Quiosque Temporário (encerrado)', floor: 'Térreo' } },
    update: { active: false },
    create: { name: 'Quiosque Temporário (encerrado)', floor: 'Térreo', type: 'store_area', active: false },
  })

  for (const [i, [slugName, name, kind, flow, equipmentType, shortDescription, icon]] of serviceSeed.entries()) {
    const data = {
      name,
      kind,
      flow,
      equipmentType,
      shortDescription,
      icon,
      description: `${shortDescription} (Texto fictício para demonstração.)`,
      howItWorks: howItWorks[slugName] ?? [],
      contactPhone: slugName === 'sac' || kind === 'interactive' ? '(63) 3219-4616' : null,
      pickupLocationId: kind === 'interactive' && slugName !== 'sac' ? L['SAC / Espaço do Cliente'] : null,
      sortOrder: i,
      active: true,
    }
    const s = await prisma.service.upsert({ where: { slug: slugName }, update: data, create: { slug: slugName, ...data } })
    S[slugName] = s.id
  }

  await prisma.equipment.deleteMany()
  await prisma.equipment.createMany({
    data: [
      { type: 'wheelchair', label: 'Cadeira adulto', quantity: 4, pickupLocationId: L['SAC / Espaço do Cliente'] },
      { type: 'wheelchair', label: 'Cadeira infantil', quantity: 2, pickupLocationId: L['SAC / Espaço do Cliente'] },
      { type: 'wheelchair', label: 'Cadeira adulto (em manutenção)', quantity: 1, pickupLocationId: L['SAC / Espaço do Cliente'], active: false },
      { type: 'stroller', label: 'Carrinho simples', quantity: 5, pickupLocationId: L['Espaço Família'] },
      { type: 'stroller', label: 'Carrinho duplo', quantity: 2, pickupLocationId: L['Espaço Família'] },
    ],
  })

  // 3) reservas de demonstração (valores combinados para a apresentação)
  const maria = await addReservation({ type: 'wheelchair', name: 'Maria Souza', phone: '63999990001', email: 'maria.souza@exemplo.com', start: local(1, 10), outcome: 'reserved', size: 'adult', loc: 'Entrada Principal (Av. NS-05)', notes: 'Estarei na entrada principal.', protocol: 'CAP-7K3Q-9XM2' })
  await addReservation({ type: 'wheelchair', name: 'Carlos Mendes', phone: '63999990011', start: slotFromNow(-60), outcome: 'picked_up', forWhom: 'other', size: 'adult' })
  await addReservation({ type: 'stroller', name: 'Juliana Alves', phone: '63999990012', email: 'juliana.alves@exemplo.com', start: slotFromNow(60), outcome: 'reserved', kind: 'single', loc: 'Praça de Alimentação' })
  await addReservation({ type: 'stroller', name: 'Fernanda Rocha', phone: '63999990013', start: slotFromNow(-30), outcome: 'picked_up', kind: 'double' })
  await addReservation({ type: 'wheelchair', name: 'Helena Costa', phone: '63999990014', start: slotFromNow(150), outcome: 'reserved', forWhom: 'other', size: 'adult' })
  const antonio = await addReservation({ type: 'wheelchair', name: 'Antônio Barros', phone: '63999990015', email: 'antonio.barros@exemplo.com', start: local(-1, 14), outcome: 'returned', forWhom: 'other', size: 'adult' })
  await addReservation({ type: 'stroller', name: 'Luciana Ferraz', phone: '63999990016', start: local(1, 15), created: local(-1, 20), outcome: 'cancelled', kind: 'single' })
  await addReservation({ type: 'wheelchair', name: 'Roberto Dias', phone: '63999990017', start: local(-2, 16), outcome: 'no_show', forWhom: 'other', size: 'child' })
  // reserva antiga já anonimizada (RF31)
  await addReservation({ type: 'stroller', name: 'Dado removido', phone: '63999990018', start: local(-200, 15), outcome: 'returned', anonymized: true })

  // reservas históricas (30 dias) para alimentar os indicadores
  for (let d = 1; d <= 30; d++) {
    const day = local(-d, 12)
    const wd = weekdayOf(day)
    const weekend = wd === 0 || wd === 6
    const hours = wd === 0 ? [14, 15, 16, 17, 18] : [10, 11, 11, 12, 12, 13, 14, 15, 15, 16, 16, 17, 18, 19, 20]
    const n = weekend ? between(2, 4) : between(1, 3)
    for (let i = 0; i < n; i++) {
      const type: EquipmentType = chance(weekend ? 0.65 : 0.4) ? 'stroller' : 'wheelchair'
      const r = rand()
      const outcome: Outcome = r < 0.8 ? 'returned' : r < 0.9 ? 'no_show' : 'cancelled'
      const p = person()
      await addReservation({
        type,
        ...p,
        start: local(-d, pick(hours), chance(0.5) ? 0 : 30),
        outcome,
        forWhom: chance(0.4) ? 'other' : 'self',
        size: chance(0.85) ? 'adult' : 'child',
        kind: chance(0.75) ? 'single' : 'double',
      })
    }
  }

  // 4) itens encontrados
  const F = {
    chaves: await addFound({ category: 'keys', description: 'Chaveiro com 3 chaves e pingente de capim dourado', loc: 'Alameda das Cores', foundAt: local(-5, 15) }),
    oculos: await addFound({ category: 'glasses_jewelry', description: 'Óculos de grau armação preta', loc: 'Praça de Alimentação', foundAt: local(-8, 13) }),
    rg: await addFound({ category: 'documents', description: 'Carteira de identidade', loc: 'Banheiros Térreo', foundAt: local(-12, 11), status: 'delivered', closeAfterDays: 2 }),
    carteiraMarrom: await addFound({ category: 'wallet_bag', description: 'Carteira de couro marrom', loc: 'Estacionamento Subsolo 1', foundAt: local(-2, 17) }),
    fone: await addFound({ category: 'phone_electronics', description: 'Fone de ouvido bluetooth branco', loc: 'Praça de Eventos', foundAt: local(-1, 19) }),
    bone: await addFound({ category: 'clothing_accessories', description: 'Boné preto', loc: 'Cinemark', foundAt: local(-125, 18), status: 'discarded', closeAfterDays: 95, closeNotes: 'Descartado após o prazo de guarda' }),
    cartao: await addFound({ category: 'documents', description: 'Cartão de banco', loc: 'Praça de Alimentação', foundAt: local(-60, 12), status: 'forwarded', closeAfterDays: 3, closeNotes: 'Encaminhado ao banco emissor' }),
    guardaChuva: await addFound({ category: 'other', description: 'Guarda-chuva preto', loc: 'Entrada Avenida JK', foundAt: local(-95, 16) }), // prazo vencido
    bolsa: await addFound({ category: 'wallet_bag', description: 'Bolsa pequena preta', loc: 'Praça de Alimentação', foundAt: local(-1, 20) }),
  }

  // 5) objetos perdidos
  await addLost({ name: 'João Lima', phone: '63999990002', email: 'joao.lima@exemplo.com', created: local(-1, 16), category: 'wallet_bag', description: 'Carteira preta de couro', ident: 'Foto de um cachorro dentro da carteira', loc: 'Praça de Alimentação', status: 'registered', protocol: 'CAP-4M8Z-2QWD' })
  await addLost({ ...person(), created: local(-3, 21), category: 'phone_electronics', description: 'Celular azul com capinha transparente', ident: 'Papel de parede com foto de praia', loc: 'Praça de Eventos', status: 'searching' })
  await addLost({ ...person(), created: local(-4, 17), category: 'keys', description: 'Chaveiro com chaves e pingente dourado', ident: 'Três chaves, uma delas com fita vermelha', loc: 'Alameda das Cores', status: 'possible_match', foundItemId: F.chaves.id })
  await addLost({
    ...person(), created: local(-7, 14), category: 'glasses_jewelry', description: 'Óculos de grau preto', ident: 'Haste esquerda consertada com fita', loc: 'Praça de Alimentação', status: 'ready_for_pickup', foundItemId: F.oculos.id,
    messages: [{ author: 'staff', user: 'paulo', at: local(-5, 10), text: 'Encontramos um item compatível. Venha ao SAC com um documento com foto para a retirada.' }],
  })
  await addLost({ ...person(), created: local(-11, 10), category: 'documents', description: 'Carteira de identidade', ident: 'Data de nascimento 1990', loc: 'Banheiros Térreo', status: 'delivered', foundItemId: F.rg.id })
  await addLost({ ...person(), created: local(-45, 15), category: 'clothing_accessories', description: 'Casaco jeans azul', loc: 'Cinemark', status: 'closed_not_found' })
  await addLost({ ...person(), created: local(-6, 12), category: 'other', description: 'Garrafa térmica azul', loc: 'Praça de Alimentação', status: 'cancelled' })
  await addLost({ ...person(), created: addMin(new Date(), -120), category: 'other', description: 'Mochila cinza escura com um chaveiro de panda', status: 'registered' })

  // histórico para os indicadores: 12 perdidos entregues (com item vinculado), 6 sem localização, 6 itens só guardados
  for (let i = 0; i < 12; i++) {
    const cat = pick(CATS)
    const d = between(3, 28)
    const loc = pick(LOST_LOCS)
    const desc = pick(DESC[cat])
    const found = await addFound({ category: cat, description: desc, loc, foundAt: local(-d, between(10, 20)), status: 'delivered', closeAfterDays: between(1, 6) })
    await addLost({ ...person(), created: local(-d, between(10, 20)), category: cat, description: desc, loc, status: 'delivered', foundItemId: found.id })
  }
  for (let i = 0; i < 6; i++) {
    const cat = pick(CATS)
    await addLost({ ...person(), created: local(-between(10, 40), between(10, 20)), category: cat, description: pick(DESC[cat]), loc: pick(LOST_LOCS), status: 'closed_not_found' })
    const cat2 = pick(CATS)
    await addFound({ category: cat2, description: pick(DESC[cat2]), loc: pick(LOST_LOCS), foundAt: local(-between(1, 30), between(10, 20)) })
  }

  // 6) mensagens ao SAC
  await addSac({ subject: 'complaint', message: 'O banheiro do segundo piso estava sem papel higiênico.', name: 'Ana Prado', email: 'ana.prado@exemplo.com', created: local(0, 9, 30), status: 'open' })
  await addSac({ subject: 'question', message: 'Qual o horário de atendimento do Detran no shopping?', name: 'Bruno Teixeira', phone: '63999990021', created: local(-1, 11), status: 'in_progress', service: 'detran', responseMin: 25 })
  await addSac({ subject: 'complaint', message: 'A cobrança do estacionamento veio diferente do tempo que fiquei.', name: 'Daniela Cardoso', phone: '63999990022', created: local(-2, 18), status: 'in_progress', service: 'estacionamento', responseMin: 45, newReply: true })
  await addSac({ subject: 'complaint', message: 'A cadeira de rodas demorou para ser entregue na retirada.', name: 'Antônio Barros', phone: '63999990015', created: local(-1, 18), status: 'open', service: 'cadeiras-de-rodas', relatedProtocol: antonio.protocol })
  await addSac({ subject: 'suggestion', name: 'Rafael Moura', email: 'rafael.moura@exemplo.com', created: local(-5, 15), status: 'answered', responseMin: 120 })
  await addSac({ subject: 'compliment', name: 'Beatriz Ribeiro', email: 'beatriz.ribeiro@exemplo.com', created: local(-6, 17), status: 'closed', responseMin: 60 })
  await addSac({ subject: 'data_deletion', name: 'Patrícia Nunes', phone: '63999990016', created: local(-3, 10), status: 'open' })
  for (let i = 0; i < 8; i++) {
    const subject = pick(['complaint', 'question', 'suggestion', 'compliment'] as const)
    await addSac({ subject, ...person(), created: local(-between(7, 28), between(9, 20)), status: 'closed', responseMin: between(15, 720) })
  }

  // 7) demanda não atendida (consultas sem horário livre)
  const unmet: Prisma.UnmetDemandCreateManyInput[] = []
  for (let d = 0; d < 18; d++) {
    const type: EquipmentType = chance(0.7) ? 'stroller' : 'wheelchair'
    unmet.push({ equipmentType: type, requestedFor: dateOnly(local(-d, 12)), createdAt: local(-d, pick([11, 12, 14, 15, 16, 17]), between(0, 59)) })
  }
  await prisma.unmetDemand.createMany({ data: unmet })

  // 8) notificações e logs de tarefas
  await prisma.notificationLog.createMany({
    data: [
      { requestId: maria.id, event: 'reservation_confirmed', toEmail: 'maria.souza@exemplo.com', status: 'sent', attempts: 1, sentAt: maria.createdAt },
      { requestId: antonio.id, event: 'reservation_confirmed', toEmail: 'antonio.barros@exemplo.com', status: 'sent', attempts: 1, sentAt: antonio.createdAt },
      { requestId: antonio.id, event: 'status_changed', toEmail: 'antonio.barros@exemplo.com', status: 'failed', attempts: 3, error: 'Tempo esgotado no servidor de e-mail (simulado)' },
      { requestId: maria.id, event: 'new_message', toEmail: 'maria.souza@exemplo.com', status: 'pending', attempts: 0 },
    ],
  })
  await prisma.jobLog.createMany({
    data: [
      { jobName: 'expire-reservations', status: 'success', affectedCount: 1, startedAt: local(-2, 16, 16), finishedAt: local(-2, 16, 16) },
      { jobName: 'expire-reservations', status: 'success', affectedCount: 0, startedAt: local(0, 8, 0), finishedAt: local(0, 8, 0) },
      { jobName: 'anonymize-personal-data', status: 'success', affectedCount: 1, startedAt: local(-1, 3, 0), finishedAt: local(-1, 3, 0) },
      { jobName: 'send-notifications', status: 'failed', affectedCount: 0, error: 'Servidor de e-mail indisponível (simulado)', startedAt: local(-1, 18, 0), finishedAt: local(-1, 18, 1) },
    ],
  })

  // 9) resumo
  const [req, res, lost, found, sac, un] = await Promise.all([
    prisma.request.count(), prisma.reservation.count(), prisma.lostReport.count(), prisma.foundItem.count(), prisma.sacMessage.count(), prisma.unmetDemand.count(),
  ])
  console.log('\nSeed concluído.')
  console.log(`  solicitações: ${req} (reservas ${res}, perdidos ${lost}, SAC ${sac}) | itens encontrados: ${found} | demandas não atendidas: ${un}`)
  console.log('\nLogin (senha: ' + (process.env.SEED_PASSWORD ?? 'Senha@123') + ')')
  console.log('  Gestor:    gestor@exemplo.com')
  console.log('  Atendente: paulo@exemplo.com / camila@exemplo.com')
  console.log('\nAcompanhamento (protocolo + telefone)')
  console.log('  Reserva:  CAP-7K3Q-9XM2 / 63999990001')
  console.log('  Perdido:  CAP-4M8Z-2QWD / 63999990002')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())