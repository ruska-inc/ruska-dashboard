import { createClient } from './client'
import { Project, PaymentRecord, Contractor, ContractorAssignment } from '@/lib/types'

// =============================================
// プロジェクト
// =============================================

export async function getProjects() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Project[]
}

export async function createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('projects')
    .insert(project)
    .select()
    .single()
  if (error) throw error
  return data as Project
}

export async function updateProject(id: string, project: Partial<Omit<Project, 'id' | 'created_at'>>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('projects')
    .update(project)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Project
}

export async function deleteProject(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
}

// =============================================
// ユーザープロファイル
// =============================================

export async function getMyProfile() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (error) return null
  return data
}

// =============================================
// 入金記録
// =============================================

export async function getPaymentRecords() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('payment_records')
    .select('*')
    .order('payment_date', { ascending: false })
  if (error) throw error
  return data as PaymentRecord[]
}

export async function createPaymentRecord(record: Omit<PaymentRecord, 'id' | 'created_at'>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('payment_records')
    .insert(record)
    .select()
    .single()
  if (error) throw error
  return data as PaymentRecord
}

export async function deletePaymentRecord(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('payment_records').delete().eq('id', id)
  if (error) throw error
}

// =============================================
// 業務委託先
// =============================================

export async function getContractors() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contractors')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Contractor[]
}

export async function createContractor(contractor: Omit<Contractor, 'id' | 'created_at'>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contractors')
    .insert(contractor)
    .select()
    .single()
  if (error) throw error
  return data as Contractor
}

// =============================================
// 業務委託案件
// =============================================

export async function getContractorAssignments() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contractor_assignments')
    .select('*, contractor:contractors(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as (ContractorAssignment & { contractor: Contractor })[]
}

export async function createContractorAssignment(
  assignment: Omit<ContractorAssignment, 'id' | 'created_at' | 'contractor'>
) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contractor_assignments')
    .insert(assignment)
    .select()
    .single()
  if (error) throw error
  return data as ContractorAssignment
}

export async function updateContractorAssignment(
  id: string,
  assignment: Partial<Omit<ContractorAssignment, 'id' | 'created_at' | 'contractor'>>
) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contractor_assignments')
    .update(assignment)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as ContractorAssignment
}
