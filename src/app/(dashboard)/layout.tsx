import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from './app-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_active')
    .eq('user_id', user.id)
    .maybeSingle()

  // Akun dinonaktifkan penjual → lempar ke login
  if (profile && profile.is_active === false) redirect('/login')

  const { data: settings } = await supabase
    .from('settings')
    .select('onboarding_done')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!settings?.onboarding_done) redirect('/onboarding')

  const userName = profile?.id ?? user.email?.replace('@merchant.local', '') ?? 'User'

  return (
    <AppShell userName={userName} isAdmin={profile?.role === 'admin'}>
      {children}
    </AppShell>
  )
}
