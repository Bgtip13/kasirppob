'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

type Account = { id: string; name: string }

export default function TopupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [toAccountId, setToAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase
      .from('accounts')
      .select('id, name, type')
      .eq('is_active', true)
      .order('name')
      .then(({ data, error }) => {
        if (error) return
        const banks = (data ?? []).filter((a) => a.type === 'bank')
        setAccounts(banks as Account[])
        if (banks.length) setToAccountId(banks[0].id)
      })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    if (!toAccountId) return toast.error('Pilih rekening tujuan')
    if (isNaN(n) || n <= 0) return toast.error('Nominal harus lebih dari 0')
    setLoading(true)
    try {
      const { error } = await supabase.rpc('process_topup', {
        p_to_account_id: toAccountId,
        p_amount: n,
        p_note: note.trim() || null,
        p_date: date,
      })
      if (error) throw error
      toast.success('Top up saldo berhasil')
      setAmount('')
      setNote('')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Top Up Saldo</h1>
      <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
        Top up diambil dari saldo Uang Tunai ke rekening tujuan.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-4 shadow">
        <label className="block">
          <span className="text-sm text-gray-600">Rekening Tujuan</span>
          <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">Nominal Top Up</span>
          <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="0" required />
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">Tanggal</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">Catatan</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Opsional" />
        </label>
        <button disabled={loading} className="w-full rounded-lg bg-sky-500 py-2 font-medium text-white disabled:opacity-50">
          {loading ? 'Menyimpan...' : 'Simpan Top Up'}
        </button>
      </form>
    </div>
  )
}
