'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'

type Account = { id: string; name: string; type: string; balance: number }
type Tx = {
  id: string
  type: string
  account_id: string | null
  cash_account_id: string | null
  amount: number
  fee: number
  method: string | null
  customer_name: string | null
  note: string | null
  category: string | null
  date: string
}
type Piutang = { id: string; customer_name: string; total_due: number; remaining: number; status: string }

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)
}
const today = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => new Date().toISOString().slice(0, 8) + '01'

const TYPE_LABEL: Record<string, string> = {
  transfer: 'Transfer',
  topup: 'Top Up',
  expense: 'Pengeluaran',
  piutang_payment: 'Bayar Piutang',
}

export default function LaporanPage() {
  const router = useRouter()
  const supabase = createClient()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [txs, setTxs] = useState<Tx[]>([])
  const [piutang, setPiutang] = useState<Piutang[]>([])
  const [start, setStart] = useState(firstOfMonth())
  const [end, setEnd] = useState(today())
  const [editing, setEditing] = useState<Tx | null>(null)
  const [paying, setPaying] = useState<Piutang | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [editForm, setEditForm] = useState({
    account_id: '',
    amount: '',
    fee: '',
    method: 'lunas',
    customer_name: '',
    note: '',
    date: '',
  })
  const [loading, setLoading] = useState(false)

  async function load() {
    const [a, t, p] = await Promise.all([
      supabase.from('accounts').select('id, name, type, balance').eq('is_active', true),
      supabase
        .from('transactions')
        .select('id, type, account_id, cash_account_id, amount, fee, method, customer_name, note, category, date')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false }),
      supabase
        .from('piutang')
        .select('id, customer_name, total_due, remaining, status')
        .neq('status', 'paid')
        .order('created_at', { ascending: false }),
    ])
    if (a.error || t.error || p.error) return
    setAccounts((a.data ?? []) as Account[])
    setTxs((t.data ?? []) as Tx[])
    setPiutang((p.data ?? []) as Piutang[])
  }

  useEffect(() => {
    load()
  }, [start, end])

  const nameOf = (id: string | null) => accounts.find((x) => x.id === id)?.name ?? '-'

  const summary = useMemo(() => {
    let totalFee = 0
    let totalExpense = 0
    for (const tx of txs) {
      if (tx.type === 'transfer') totalFee += Number(tx.fee)
      if (tx.type === 'expense') totalExpense += Number(tx.amount)
    }
    const perAccount = accounts.map((acc) => {
      let masuk = 0
      let keluar = 0
      for (const tx of txs) {
        const a = Number(tx.amount)
        if (tx.type === 'transfer') {
          if (tx.account_id === acc.id) keluar += a
          if (tx.method === 'lunas' && tx.cash_account_id === acc.id) masuk += a + Number(tx.fee)
        } else if (tx.type === 'topup') {
          if (tx.account_id === acc.id) masuk += a
          if (tx.cash_account_id === acc.id) keluar += a
        } else if (tx.type === 'expense') {
          if (tx.account_id === acc.id) keluar += a
        } else if (tx.type === 'piutang_payment') {
          if (tx.cash_account_id === acc.id) masuk += a
        }
      }
      const saldoAwal = Number(acc.balance) - (masuk - keluar)
      return { ...acc, masuk, keluar, saldoAwal }
    })
    return { totalFee, totalExpense, laba: totalFee - totalExpense, perAccount }
  }, [txs, accounts])

  async function handleDelete(tx: Tx) {
    if (!confirm('Hapus transaksi ini? Semua saldo akan dikembalikan.')) return
    const { error } = await supabase.rpc('delete_transaction', { p_tx_id: tx.id })
    if (error) return toast.error(error.message)
    toast.success('Transaksi dihapus')
    load()
  }

  function openEdit(tx: Tx) {
    setEditing(tx)
    setEditForm({
      account_id: tx.account_id ?? '',
      amount: String(tx.amount),
      fee: String(tx.fee),
      method: tx.method === 'piutang' ? 'piutang' : 'lunas',
      customer_name: tx.customer_name ?? '',
      note: tx.note ?? '',
      date: tx.date,
    })
  }

  async function saveEdit() {
    if (!editing) return
    setLoading(true)
    try {
      const { error } = await supabase.rpc('update_transfer', {
        p_tx_id: editing.id,
        p_account_id: editForm.account_id,
        p_amount: Number(editForm.amount),
        p_fee: Number(editForm.fee || 0),
        p_is_piutang: editForm.method === 'piutang',
        p_customer_name: editForm.customer_name || null,
        p_note: editForm.note || null,
        p_date: editForm.date,
      })
      if (error) throw error
      toast.success('Transaksi diperbarui')
      setEditing(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  async function handlePay() {
    if (!paying) return
    const n = Number(payAmount)
    if (isNaN(n) || n <= 0) return toast.error('Nominal tidak valid')
    setLoading(true)
    try {
      const { error } = await supabase.rpc('pay_piutang', { p_piutang_id: paying.id, p_amount: n })
      if (error) throw error
      toast.success('Pembayaran piutang berhasil')
      setPaying(null)
      setPayAmount('')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  function exportExcel() {
    const rows: (string | number)[][] = []
    rows.push(['Laporan Keuangan', `${start} s/d ${end}`])
    rows.push([])
    rows.push(['Total Fee', summary.totalFee, 'Total Pengeluaran', summary.totalExpense, 'Laba Bersih', summary.laba])
    rows.push([])
    rows.push(['MUTASI SALDO PER AKUN'])
    rows.push(['Akun', 'Saldo Awal', 'Masuk', 'Keluar', 'Saldo Akhir'])
    summary.perAccount.forEach((x) => rows.push([x.name, x.saldoAwal, x.masuk, x.keluar, x.balance]))
    rows.push([])
    rows.push(['DAFTAR TRANSAKSI'])
    rows.push(['Tanggal', 'Jenis', 'Rekening', 'Nominal', 'Fee', 'Metode', 'Customer', 'Keterangan'])
    txs.forEach((tx) =>
      rows.push([
        tx.date,
        TYPE_LABEL[tx.type] ?? tx.type,
        nameOf(tx.account_id ?? tx.cash_account_id),
        tx.amount,
        tx.fee,
        tx.method ?? '-',
        tx.customer_name ?? '-',
        tx.note ?? tx.category ?? '-',
      ])
    )
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan')
    XLSX.writeFile(wb, `laporan-${start}-sampai-${end}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Laporan Keuangan</h1>
        <button onClick={exportExcel} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white">
          Export Excel
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg border px-3 py-2" />
        <span className="text-sm text-gray-500">s/d</span>
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-lg border px-3 py-2" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white p-3 shadow">
          <p className="text-xs text-gray-500">Total Fee</p>
          <p className="mt-1 text-sm font-semibold text-green-600">{formatRp(summary.totalFee)}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow">
          <p className="text-xs text-gray-500">Pengeluaran</p>
          <p className="mt-1 text-sm font-semibold text-red-600">{formatRp(summary.totalExpense)}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow">
          <p className="text-xs text-gray-500">Laba Bersih</p>
          <p className="mt-1 text-sm font-semibold">{formatRp(summary.laba)}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-3 text-sm font-semibold">Mutasi Saldo per Akun</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">Akun</th>
              <th className="py-2">Saldo Awal</th>
              <th className="py-2">Masuk</th>
              <th className="py-2">Keluar</th>
              <th className="py-2">Saldo Akhir</th>
            </tr>
          </thead>
          <tbody>
            {summary.perAccount.map((x) => (
              <tr key={x.id} className="border-b">
                <td className="py-2">{x.name}</td>
                <td className="py-2">{formatRp(x.saldoAwal)}</td>
                <td className="py-2 text-green-600">{formatRp(x.masuk)}</td>
                <td className="py-2 text-red-600">{formatRp(x.keluar)}</td>
                <td className="py-2 font-medium">{formatRp(Number(x.balance))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-3 text-sm font-semibold">Daftar Transaksi</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">Tanggal</th>
              <th className="py-2">Jenis</th>
              <th className="py-2">Rekening</th>
              <th className="py-2">Nominal</th>
              <th className="py-2">Fee</th>
              <th className="py-2">Customer</th>
              <th className="py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {txs.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-gray-400">
                  Tidak ada transaksi di rentang tanggal ini
                </td>
              </tr>
            )}
            {txs.map((tx) => (
              <tr key={tx.id} className="border-b">
                <td className="whitespace-nowrap py-2">{tx.date}</td>
                <td className="py-2">{TYPE_LABEL[tx.type] ?? tx.type}</td>
                <td className="py-2">{nameOf(tx.account_id ?? tx.cash_account_id)}</td>
                <td className="py-2">{formatRp(Number(tx.amount))}</td>
                <td className="py-2">{tx.type === 'transfer' ? formatRp(Number(tx.fee)) : '-'}</td>
                <td className="py-2">{tx.customer_name ?? '-'}</td>
                <td className="whitespace-nowrap py-2">
                  {tx.type === 'transfer' && (
                    <button onClick={() => openEdit(tx)} className="mr-2 text-blue-600">
                      Edit
                    </button>
                  )}
                  <button onClick={() => handleDelete(tx)} className="text-red-600">
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-3 text-sm font-semibold">Piutang Aktif</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">Customer</th>
              <th className="py-2">Total</th>
              <th className="py-2">Sisa</th>
              <th className="py-2">Status</th>
              <th className="py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {piutang.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-gray-400">
                  Tidak ada piutang aktif
                </td>
              </tr>
            )}
            {piutang.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="py-2">{p.customer_name}</td>
                <td className="py-2">{formatRp(Number(p.total_due))}</td>
                <td className="py-2">{formatRp(Number(p.remaining))}</td>
                <td className="py-2">{p.status === 'partial' ? 'Dicicil' : 'Belum dibayar'}</td>
                <td className="py-2">
                  <button
                    onClick={() => {
                      setPaying(p)
                      setPayAmount(String(p.remaining))
                    }}
                    className="text-blue-600"
                  >
                    Bayar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold">Edit Transaksi</h2>
            <select value={editForm.account_id} onChange={(e) => setEditForm({ ...editForm, account_id: e.target.value })} className="w-full rounded-lg border px-3 py-2">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Nominal"
              value={editForm.amount}
              onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
              className="w-full rounded-lg border px-3 py-2"
            />
            <input
              type="number"
              placeholder="Fee"
              value={editForm.fee}
              onChange={(e) => setEditForm({ ...editForm, fee: e.target.value })}
              className="w-full rounded-lg border px-3 py-2"
            />
            <select value={editForm.method} onChange={(e) => setEditForm({ ...editForm, method: e.target.value })} className="w-full rounded-lg border px-3 py-2">
              <option value="lunas">Lunas / Tunai</option>
              <option value="piutang">Piutang</option>
            </select>
            <input
              placeholder="Nama customer"
              value={editForm.customer_name}
              onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
              className="w-full rounded-lg border px-3 py-2"
            />
            <input
              placeholder="Catatan"
              value={editForm.note}
              onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
              className="w-full rounded-lg border px-3 py-2"
            />
            <input
              type="date"
              value={editForm.date}
              onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              className="w-full rounded-lg border px-3 py-2"
            />
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={loading} className="flex-1 rounded-lg bg-sky-500 py-2 font-medium text-white disabled:opacity-50">
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button onClick={() => setEditing(null)} className="flex-1 rounded-lg bg-gray-200 py-2">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {paying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPaying(null)}>
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold">Bayar Piutang — {paying.customer_name}</h2>
            <p className="text-sm text-gray-500">Sisa: {formatRp(Number(paying.remaining))}</p>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Nominal bayar"
            />
            <div className="flex gap-2">
              <button onClick={handlePay} disabled={loading} className="flex-1 rounded-lg bg-sky-500 py-2 font-medium text-white disabled:opacity-50">
                {loading ? 'Menyimpan...' : 'Bayar'}
              </button>
              <button onClick={() => setPaying(null)} className="flex-1 rounded-lg bg-gray-200 py-2">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
