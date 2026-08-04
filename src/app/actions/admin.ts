'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const admin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
  if (profile?.role !== 'admin') throw new Error('Akses ditolak')
  return user
}

export type Buyer = {
  id: string
  business_name: string | null
  user_id: string
  last_login_at: string | null
  created_at: string | null
  activation_code: string | null
  status: string
}

export async function listBuyers(): Promise<Buyer[]> {
  await requireAdmin()

  const { data: users, error: uErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (uErr) throw new Error(uErr.message)
  const userMap = new Map((users?.users ?? []).map((u) => [u.id, u]))

  const { data: profiles, error: pErr } = await admin.from('profiles').select('*')
  if (pErr) throw new Error(pErr.message)

  const { data: codes, error: cErr } = await admin
    .from('activation_codes').select('code, used_by').not('used_by', 'is', null)
  if (cErr) throw new Error(cErr.message)
  const codeMap = new Map((codes ?? []).map((c: any) => [c.used_by, c.code]))

  return (profiles ?? [])
    .filter((p: any) => p.role === 'user')
    .map((p: any) => {
      const u = userMap.get(p.user_id)
      return {
        id: p.id,
        business_name: p.business_name ?? p.nama_usaha ?? null,
        user_id: p.user_id,
        last_login_at: u?.last_sign_in_at ?? null,
        created_at: u?.created_at ?? null,
        activation_code: codeMap.get(p.user_id) ?? null,
        status: 'Aktif',
      }
    })
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
}

export async function createActivationCode(): Promise<string> {
  await requireAdmin()
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  const { error } = await admin.from('activation_codes').insert({ code, is_used: false })
  if (error) throw new Error(error.message)
  return code
}

async function getUserIdByBuyerId(buyerId: string): Promise<string> {
  const { data, error } = await admin.from('profiles').select('user_id').eq('id', buyerId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Pembeli tidak ditemukan')
  return data.user_id
}

export async function resetBuyer(buyerId: string): Promise<void> {
  await requireAdmin()
  const uid = await getUserIdByBuyerId(buyerId)
  await admin.from('transactions').delete().eq('user_id', uid)
  await admin.from('piutang_payments').delete().eq('user_id', uid)
  await admin.from('piutang').delete().eq('user_id', uid)
  await admin.from('penjualan').delete().eq('user_id', uid)
  await admin.from('barang').delete().eq('user_id', uid)
  await admin.from('accounts').delete().eq('user_id', uid)
  await admin.from('settings').delete().eq('user_id', uid)
}

export async function deleteBuyer(buyerId: string): Promise<void> {
  await requireAdmin()
  const uid = await getUserIdByBuyerId(buyerId)
  const { error } = await admin.auth.admin.deleteUser(uid)
  if (error) throw new Error(error.message)
}
