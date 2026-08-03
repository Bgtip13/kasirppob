'use server'

import { createClient } from '@supabase/supabase-js'

export async function registerBuyer(id: string, pin: string, code: string, namaUsaha?: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Cek kode aktivasi (di server)
  const { data: license } = await supabase
    .from('activation_codes')
    .select('*')
    .eq('code', code.trim())
    .eq('is_used', false)
    .single()
  if (!license) throw new Error('Kode aktivasi tidak valid atau sudah terpakai')

  // 2. Buat user pembeli
  const email = `${id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')}@merchant.local`
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
  })
  if (authError) throw new Error('ID sudah digunakan atau PIN tidak valid')

  // 3. Simpan profil
  const { error: profileError } = await supabase.from('profiles').insert({
    user_id: authData.user.id,
    id: id.trim(),
    nama_usaha: namaUsaha?.trim() || null,
    role: 'user',
    is_active: true,
  })
  if (profileError) throw new Error('Gagal menyimpan profil')

  // 4. Tandai kode terpakai
  await supabase
    .from('activation_codes')
    .update({ is_used: true, used_by: authData.user.id })
    .eq('code', code.trim())

  return { success: true }
}
