import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminPanel from './admin-panel'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (me?.role !== 'admin') redirect('/')

  const { data: buyers } = await supabase
    .from('profiles')
    .select('user_id, id, nama_usaha, is_active, created_at')
    .eq('role', 'user')
    .order('created_at', { ascending: false })

  const { data: codes } = await supabase
    .from('activation_codes')
    .select('code, is_used, created_at')
    .order('created_at', { ascending: false })

  return <AdminPanel buyers={buyers ?? []} codes={codes ?? []} />
}
