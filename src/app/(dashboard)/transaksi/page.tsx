'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import BankLogo from '@/components/bank-logo'

type Account = { id: string; name: string; default_fee_percent: number }

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)
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
    setAmount(value)
    if (feeAuto && selectedAccount) {
      const n = Number(value)
      if (!isNaN(n) && n > 0) {
        const pct = selectedAccount.default_fee_percent ?? 1
        setFee(String(Math.round((n * pct) / 100)))
      }
    }
  }

  function handleFeeChange(value: string) {
    setFee(value)
    setFeeAuto(false)
  }

  function selectAccount(id: string) {
    setAccountId(id)
    setFeeAuto(true)
    if (amount) handleAmountChange(amount)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const nAmount = Number(amount)
    const nFee = Number(fee || 0)
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
      toast.success(
        method === 'lunas'
          ? `Transaksi berhasil — Tunai masuk ${formatRp(nAmount + nFee)}`
          : `Transaksi berhasil — Piutang ${formatRp(nAmount + nFee)}`
      )
      setAmount('')
      setFee('')
      setCustomerName('')
      setNote('')
      setFeeAuto(true)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Input Transaksi</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-4 shadow">
        <div>
          <span className="text-sm text-gray-600">Rekening</span>
          <div className="mt-1 space-y-2">
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => selectAccount(a.id)}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition ${
                  accountId === a.id ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white'
                }`}
              >
                <BankLogo name={a.name} />
                <span className="text-sm font-medium text-gray-800">{a.name}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-sm text-gray-600">Nominal Transfer</span>
          <input type="number" inputMode="numeric" value={amount} onChange={(e) => handleAmountChange(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="0" required />
        </label>

        <label className="block">
          <span className="text-sm text-gray-600">Biaya Admin / Fee</span>
          <input type="number" inputMode="numeric" value={fee} onChange={(e) => handleFeeChange(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="0" />
          <span className="text-xs text-gray-400">
            Otomatis {selectedAccount?.default_fee_percent ?? 1}% dari nominal — bisa diubah manual
          </span>
        </label>

        <div>
          <span className="text-sm text-gray-600">Metode</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMethod('lunas')}
              className={`rounded-lg py-2 text-sm font-medium ${method === 'lunas' ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Lunas / Tunai
            </button>
            <button
              type="button"
              onClick={() => setMethod('piutang')}
              className={`rounded-lg py-2 text-sm font-medium ${method === 'piutang' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Piutang (Talangi)
            </button>
          </div>
        </div>

        <label className="block">
          <span className="text-sm text-gray-600">Nama Customer {method === 'piutang' && <span className="text-red-500">*</span>}</span>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Nama customer" />
        </label>

        <label className="block">
          <span className="text-sm text-gray-600">Tanggal</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>

        <label className="block">
          <span className="text-sm text-gray-600">Catatan</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Opsional" />
        </label>

        {Number(amount) > 0 && (
          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            {method === 'lunas'
              ? `Tunai yang diterima: ${formatRp(Number(amount) + Number(fee || 0))}`
              : `Piutang ke customer: ${formatRp(Number(amount) + Number(fee || 0))}`}
          </p>
        )}

        <button disabled={loading} className="w-full rounded-lg bg-sky-500 py-2 font-medium text-white disabled:opacity-50">
          {loading ? 'Menyimpan...' : 'Simpan Transaksi'}
        </button>
      </form>
    </div>
  )
}
