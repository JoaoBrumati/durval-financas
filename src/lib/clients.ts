import type { User } from '@supabase/supabase-js'
import { requireSupabase } from './supabase'

export type InstallmentStatus = 'paid' | 'open'

export interface Installment {
  id: string
  number: number
  amount: number
  dueDate: string
  status: InstallmentStatus
  paidAt?: string
  receiptName?: string
  receiptPath?: string
}

export interface Client {
  id: string
  name: string
  cpf: string
  address: string
  phone: string
  principal: number
  interest: number
  installmentCount: number
  createdAt: string
  installments: Installment[]
}

interface ClientRow {
  id: string
  name: string
  cpf: string
  address: string
  phone: string
  principal: number
  interest: number
  installment_count: number
  created_at: string
}

interface InstallmentRow {
  id: string
  client_id: string
  number: number
  amount: number
  due_date: string
  status: InstallmentStatus
  paid_at: string | null
  receipt_name: string | null
  receipt_path: string | null
}

interface LegacyInstallment extends Installment {
  receiptData?: string
}

interface LegacyClient extends Omit<Client, 'installments'> {
  installments: LegacyInstallment[]
}

const storageKeys = ['fluxo-clients-v2', 'fluxo-clients-v1']
const receiptBucket = 'loan-receipts'

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function clientToRow(client: Client, userId: string): ClientRow & { user_id: string } {
  return {
    id: client.id,
    user_id: userId,
    name: client.name,
    cpf: client.cpf,
    address: client.address,
    phone: client.phone,
    principal: client.principal,
    interest: client.interest,
    installment_count: client.installmentCount,
    created_at: client.createdAt,
  }
}

function installmentToRow(installment: Installment, clientId: string, userId: string) {
  return {
    id: installment.id,
    client_id: clientId,
    user_id: userId,
    number: installment.number,
    amount: installment.amount,
    due_date: installment.dueDate,
    status: installment.status,
    paid_at: installment.paidAt ?? null,
    receipt_name: installment.receiptName ?? null,
    receipt_path: installment.receiptPath ?? null,
  }
}

function rowsToClients(clientRows: ClientRow[], installmentRows: InstallmentRow[]): Client[] {
  const installmentsByClient = new Map<string, Installment[]>()
  for (const row of installmentRows) {
    const installments = installmentsByClient.get(row.client_id) ?? []
    installments.push({
      id: row.id,
      number: row.number,
      amount: Number(row.amount),
      dueDate: row.due_date,
      status: row.status,
      ...(row.paid_at ? { paidAt: row.paid_at } : {}),
      ...(row.receipt_name ? { receiptName: row.receipt_name } : {}),
      ...(row.receipt_path ? { receiptPath: row.receipt_path } : {}),
    })
    installmentsByClient.set(row.client_id, installments)
  }

  return clientRows.map((row) => ({
    id: row.id,
    name: row.name,
    cpf: row.cpf,
    address: row.address,
    phone: row.phone,
    principal: Number(row.principal),
    interest: Number(row.interest),
    installmentCount: row.installment_count,
    createdAt: row.created_at,
    installments: installmentsByClient.get(row.id) ?? [],
  }))
}

async function uploadReceipt(userId: string, clientId: string, installment: LegacyInstallment) {
  if (!installment.receiptData) return installment
  const response = await fetch(installment.receiptData)
  if (!response.ok) throw new Error(`Não foi possível ler o comprovante ${installment.receiptName ?? ''}.`)
  const contentType = response.headers.get('content-type')?.split(';')[0] ?? ''
  const file = await response.arrayBuffer()
  if (file.byteLength > 2 * 1024 * 1024) throw new Error('O comprovante precisa ter até 2 MB.')
  if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'].includes(contentType)) {
    throw new Error(`Tipo de comprovante não permitido: ${contentType || 'desconhecido'}.`)
  }

  const path = `${userId}/${clientId}/${installment.id}`
  const { error } = await requireSupabase().storage.from(receiptBucket).upload(path, file, {
    contentType,
    upsert: true,
  })
  throwOnError(error)

  return { ...installment, receiptPath: path }
}

async function importLegacyClients(user: User) {
  const saved = storageKeys.flatMap((key) => {
    const value = localStorage.getItem(key)
    if (!value) return []
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) throw new Error(`Os dados antigos em ${key} não estão em um formato válido.`)
    return parsed as LegacyClient[]
  })

  if (!saved.length) return false

  const supabase = requireSupabase()
  for (const legacyClient of saved) {
    const client = {
      ...legacyClient,
      installments: await Promise.all(legacyClient.installments.map((item) => uploadReceipt(user.id, legacyClient.id, item))),
    }

    const { error: clientError } = await supabase.from('clients').upsert(clientToRow(client, user.id))
    throwOnError(clientError)

    if (client.installments.length) {
      const { error: installmentsError } = await supabase
        .from('installments')
        .upsert(client.installments.map((item) => installmentToRow(item, client.id, user.id)))
      throwOnError(installmentsError)
    }
  }

  for (const key of storageKeys) localStorage.removeItem(key)
  return true
}

export async function fetchClients(user: User) {
  await importLegacyClients(user)

  const supabase = requireSupabase()
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, cpf, address, phone, principal, interest, installment_count, created_at')
    .order('created_at', { ascending: false })
  throwOnError(clientsError)

  if (!clients?.length) return []

  const { data: installments, error: installmentsError } = await supabase
    .from('installments')
    .select('id, client_id, number, amount, due_date, status, paid_at, receipt_name, receipt_path')
    .in('client_id', clients.map((client) => client.id))
    .order('number')
  throwOnError(installmentsError)

  return rowsToClients(clients as ClientRow[], (installments ?? []) as InstallmentRow[])
}

export async function createClientRecord(client: Client, userId: string) {
  const supabase = requireSupabase()
  const { error: clientError } = await supabase.from('clients').insert(clientToRow(client, userId))
  throwOnError(clientError)

  const { error: installmentsError } = await supabase
    .from('installments')
    .insert(client.installments.map((item) => installmentToRow(item, client.id, userId)))
  if (installmentsError) {
    const { error: cleanupError } = await supabase.from('clients').delete().eq('id', client.id)
    if (cleanupError) throw new Error(`${installmentsError.message} A limpeza do contrato incompleto também falhou: ${cleanupError.message}`)
    throwOnError(installmentsError)
  }
}

export async function markInstallmentPaid(installmentId: string, userId: string, paidAt: string) {
  const { error } = await requireSupabase()
    .from('installments')
    .update({ status: 'paid', paid_at: paidAt })
    .eq('id', installmentId)
    .eq('user_id', userId)
  throwOnError(error)
}

export async function saveInstallmentReceipt(clientId: string, installment: Installment, userId: string, file: File) {
  const supabase = requireSupabase()
  const path = `${userId}/${clientId}/${installment.id}`
  const { error: uploadError } = await supabase.storage.from(receiptBucket).upload(path, file, {
    contentType: file.type,
    upsert: true,
  })
  throwOnError(uploadError)

  const { error: updateError } = await supabase
    .from('installments')
    .update({ receipt_name: file.name, receipt_path: path })
    .eq('id', installment.id)
    .eq('user_id', userId)
  if (updateError) {
    const { error: cleanupError } = await supabase.storage.from(receiptBucket).remove([path])
    if (cleanupError) throw new Error(`${updateError.message} A limpeza do comprovante também falhou: ${cleanupError.message}`)
    throwOnError(updateError)
  }

  return { ...installment, receiptName: file.name, receiptPath: path }
}

export async function createReceiptUrl(path: string) {
  const { data, error } = await requireSupabase().storage.from(receiptBucket).createSignedUrl(path, 60)
  throwOnError(error)
  if (!data) throw new Error('O Supabase não retornou um link para o comprovante.')
  return data.signedUrl
}
