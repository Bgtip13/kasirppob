'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

type Account = { id: string; name: string; type: string; balance: number }

export default function TopupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('')
  const [fee, setFee] = useState('')
  const [feeAccountId, setFeeAccountId] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase
      .from('accounts')
      .select('id, name, type, balance')
      .eq('is_active', true)
      .order('name')
      .then(({ data, error }) => {
        if (error) return
        setAccounts((data ?? []) as Account[])
        if (data?.length) setFromId(data[0].id)
        if (data?.length > 1) setToId(data[1].id)
        const koin = (data ?? []).find((a) => a.name.toLowerCase().includes('koinflip'))
        setFeeAccountId(koin?.id ?? data?.[0]?.id ?? '')
      })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    const f = Number(fee || 0)
    if (!fromId || !toId) return toast.error('Pilih akun asal dan tujuan')
    if (fromId === toId) return toast.error('Akun asal dan tujuan harus berbeda')
    if (isNaN(n) || n <= 0) return toast.error('Nominal harus lebih dari 0')
    if (isNaN(f) || f < 0) return toast.error('Fee tidak valid')
    if (f > 0 && !feeAccountId) return toast.error('Pilih akun untuk fee')
    setLoading(true)
    try {
      const { error } = await supabase.rpc('process_topup', {
        p_from_account_id: fromId,
        p_to_account_id: toId,
        p_amount: n,
        p_fee: f,
        p_fee_account_id: feeAccountId || null,
        p_note: note.trim() || null,
        p_date: date,
      })
      if (error) throw error
      toast.success('Top up berhasil')
      setAmount('')
      setFee('')
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
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-4 shadow">
        <label className="block">
          <span className="text-sm text-gray-600">Akun Asal</span>
          <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">Akun Tujuan</span>
          <select value={toId} onChange={(e) => setToId(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
            {accounts.map((a) => (
              <option key={a.id} value={a.id} disabled={a.id === fromId}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">Nominal Top Up</span>
          <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="0" required />
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">Fee (opsional)</span>
          <input type="number" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="0" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">Fee Masuk ke Akun</span>
          <select value={feeAccountId} onChange={(e) => setFeeAccountId(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
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
