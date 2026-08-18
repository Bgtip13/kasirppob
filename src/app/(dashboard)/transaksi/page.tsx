'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

type Account = { id: string; name: string; default_fee_percent: number }

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)
}

// Format angka dengan titik ribuan saat diketik: 1000 -> "1.000"
function formatIdrInput(v: string): string {
  const digits = v.replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('id-ID')
}

export default function TransaksiPage() {
  const router = useRouter()
  const supabase = createClient()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [fee, setFee] = useState('')
  const [feeAuto, setFeeAuto] = useState(true)
  const [method, setMethod] = useState<'lunas' | 'piutang'>('lunas')
  const [customerName, setCustomerName] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase
      .from('accounts')
      .select('id, name, default_fee_percent')
      .eq('type', 'bank')
      .eq('is_active', true)
      .order('name')
      .then(({ data, error }) => {
        if (error) return
        setAccounts((data ?? []) as Account[])
        if (data?.length) setAccountId(data[0].id)
      })
  }, [])

  const selectedAccount = accounts.find((a) => a.id === accountId)

  function handleAmountChange(value: string) {
    const formatted = formatIdrInput(value)
    setAmount(formatted)
    if (feeAuto && selectedAccount) {
      const n = Number(formatted.replace(/\D/g, ''))
      if (!isNaN(n) && n > 0) {
        const pct = selectedAccount.default_fee_percent ?? 1
        setFee(formatIdrInput(String(Math.round((n * pct) / 100))))
      } else {
        setFee('')
      }
    }
  }

  function handleFeeChange(value: string) {
    setFee(formatIdrInput(value))
    setFeeAuto(false)
  }

  function selectAccount(id: string) {
    setAccountId(id)
    setFeeAuto(true)
    if (amount) handleAmountChange(amount)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const nAmount = Number(amount.replace(/\D/g, ''))
    const nFee = Number((fee || '').replace(/\D/g, '')) || 0
    if (!accountId) return toast.error('Pilih rekening dulu')
    if (isNaN(nAmount) || nAmount <= 0) return toast.error('Nominal harus lebih dari 0')
    if (isNaN(nFee) || nFee < 0) return toast.error('Fee tidak valid')
    if (method === 'piutang' && !customerName.trim()) return toast.error('Nama customer wajib untuk piutang')

    setLoading(true)
    try {
      const { error } = await supabase.rpc('process_transfer', {
        p_account_id: accountId,
        p_amount: nAmount,
        p_fee: nFee,
        p_is_piutang: method === 'piutang',
        p_customer_name: customerName.trim() || null,
        p_note: note.trim() || null,
        p_date: date,
      })
      if (error) throw error
      toast.success('Transaksi berhasil disimpan')
      setAmount('')
      setFee('')
      setFeeAuto(true)
      setCustomerName('')
      setNote('')
      setDate(new Date().toISOString().slice(0, 10))
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const preview = (() => {
    const a = Number(amount.replace(/\D/g, '')) || 0
    const f = Number((fee || '').replace(/\D/g, '')) || 0
    return a > 0 ? a + f : 0
  })()

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-xl font-bold text-gray-800">Input Transaksi</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-4 shadow">
        <label className="block">
          <span className="text-sm text-gray-600">Rekening</span>
          <select
            value={accountId}
            onChange={(e) => selectAccount(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-gray-800"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-gray-600">Nominal Transfer</span>
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-gray-800"
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-600">Biaya Admin / Fee</span>
          <input
            inputMode="numeric"
            value={fee}
            onChange={(e) => handleFeeChange(e.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-gray-800"
          />
          <span className="text-xs text-gray-400">Otomatis 1% dari nominal — bisa diubah manual</span>
        </label>

        <div>
          <span className="text-sm text-gray-600">Metode</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMethod('lunas')}
              className={`rounded-lg py-2 text-sm font-medium ${method === 'lunas' ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Lunas
            </button>
            <button
              type="button"
              onClick={() => setMethod('piutang')}
              className={`rounded-lg py-2 text-sm font-medium ${method === 'piutang' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Piutang
            </button>
          </div>
        </div>

        {method === 'piutang' && (
          <label className="block">
            <span className="text-sm text-gray-600">Nama Customer</span>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-gray-800" />
          </label>
        )}

        <label className="block">
          <span className="text-sm text-gray-600">Catatan (opsional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-gray-800" />
        </label>

        <label className="block">
          <span className="text-sm text-gray-600">Tanggal</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-gray-800" />
        </label>

        {preview > 0 && (
          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            {method === 'lunas'
              ? `Tunai yang diterima: ${formatRp(preview)}`
              : `Piutang ke customer: ${formatRp(preview)}`}
          </p>
        )}

        <button disabled={loading} className="w-full rounded-lg bg-sky-500 py-2 font-medium text-white disabled:opacity-50">
          {loading ? 'Menyimpan...' : 'Simpan Transaksi'}
        </button>
      </form>
    </div>
  )
}
