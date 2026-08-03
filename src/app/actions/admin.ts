'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Belum login')

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await admin
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (data?.role !== 'admin') throw new Error('Bukan admin')
  return admin
}

export async function adminGenerateCodes(count: number): Promise<string[]> {
  const admin = await requireAdmin()
  const n = Math.min(Math.max(count, 1), 50)
  const codes: string[] = []
  for (let i = 0; i < n; i++) {
    const code = `KASIR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    codes.push(code)
  }
  const { error } = await admin.from('activation_codes').insert(codes.map((c) => ({ code: c })))
  if (error) throw error
  return codes
}

export async function adminDeleteUser(userId: string) {
  const admin = await requireAdmin()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw error
}

export async function adminToggleActive(userId: string, active: boolean) {
  const admin = await requireAdmin()
  const { error } = await admin.from('profiles').update({ is_active: active }).eq('user_id', userId)
  if (error) throw error
}
