import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, type, balance, is_active')
    .order('name')

  const { data: piutang } = await supabase
    .from('piutang')
    .select('remaining')
    .neq('status', 'paid')

  const active = (accounts ?? []).filter((a) => a.is_active)
  const totalSaldo = active.reduce((s, a) => s + Number(a.balance), 0)
  const totalPiutang = (piutang ?? []).reduce((s, p) => s + Number(p.remaining), 0)

  const sorted = [...active].sort((a, b) => (a.type === 'cash' ? -1 : 1) - (b.type === 'cash' ? -1 : 1))

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="rounded-2xl bg-blue-600 p-5 text-white shadow">
        <p className="text-sm opacity-90">Total Semua Saldo</p>
        <p className="mt-1 text-3xl font-bold">{formatRp(totalSaldo)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {sorted.map((a) => (
          <div key={a.id} className="rounded-2xl bg-white p-4 shadow">
            <p className="text-sm text-gray-500">{a.name}</p>
            <p className="mt-1 text-lg font-semibold">{formatRp(Number(a.balance))}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-amber-500 p-5 text-white shadow">
        <p className="text-sm opacity-90">Total Piutang Aktif</p>
        <p className="mt-1 text-3xl font-bold">{formatRp(totalPiutang)}</p>
      </div>
    </div>
  )
}
