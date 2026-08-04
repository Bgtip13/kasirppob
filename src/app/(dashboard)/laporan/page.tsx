'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'

type Account = { id: string; name: string; type: string; balance: number }
type Tx = {
  id: string; type: string; account_id: string | null; cash_account_id: string | null;
  fee_account_id: string | null; penjualan_id: string | null; amount: number; fee: number;
  method: string | null; customer_name: string | null; note: string | null; category: string | null; date: string
}
type Piutang = { id: string; customer_name: string; total_due: number; remaining: number; status: string }

const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
const today = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => new Date().toISOString().slice(0, 8) + '01'

const TYPE_LABEL: Record<string, string> = {
  transfer: 'Transfer', topup: 'Top Up', expense: 'Pengeluaran',
  piutang_payment: 'Bayar Piutang', sale: 'Penjualan',
}

export default function LaporanPage() {
  const supabase = createClient()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [txs, setTxs] = useState<Tx[]>([])
  const [piutang, setPiutang] = useState<Piutang[]>([])
  const [items, setItems] = useState<any[]>([])
  const [start, setStart] = useState(firstOfMonth())
  const [end, setEnd] = useState(today())
  const [showMutasi, setShowMutasi] = useState(false)
  const [showTx, setShowTx] = useState(false)
  const [showPiutang, setShowPiutang] = useState(false)

  const [editing, setEditing] = useState<Tx | null>(null)
  const [editForm, setEditForm] = useState({ account_id: '', amount: '', fee: '', method: 'lunas', customer_name: '', note: '', date: '' })
  const [paying, setPaying] = useState<Piutang | null>(null)
  const [payAccount, setPayAccount] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    const [a, t, p, it] = await Promise.all([
      supabase.from('accounts').select('id, name, type, balance').eq('is_active', true),
      supabase.from('transactions')
        .select('id, type, account_id, cash_account_id, fee_account_id, penjualan_id, amount, fee, method, customer_name, note, category, date')
        .gte('date', start).lte('date', end).order('date', { ascending: false }).limit(300),
      supabase.from('piutang').select('id, customer_name, total_due, remaining, status').neq('status', 'paid').order('created_at', { ascending: false }),
      supabase.from('penjualan_item').select('penjualan_id, qty, barang(harga_beli)'),
    ])
    if (a.error || t.error || p.error) return
    setAccounts((a.data ?? []) as Account[])
    setTxs((t.data ?? []) as Tx[])
    setPiutang((p.data ?? []) as Piutang[])
    setItems(it.data ?? [])
  }

  useEffect(() => { load() }, [start, end])

  const cogsMap = useMemo(() => {
    const m: Record<string, number> = {}
    items.forEach((it: any) => {
      const beli = Number(it.barang?.harga_beli || 0)
      m[it.penjualan_id] = (m[it.penjualan_id] || 0) + beli * Number(it.qty)
    })
    return m
  }, [items])

  const summary = useMemo(() => {
    let fee = 0, pengeluaran = 0, penjualan = 0, cogs = 0
    txs.forEach((t) => {
      fee += Number(t.fee || 0)
      if (t.type === 'expense') pengeluaran += Number(t.amount)
      if (t.type === 'sale') {
        penjualan += Number(t.amount)
        cogs += cogsMap[t.penjualan_id || ''] || 0
      }
    })
    return { fee, pengeluaran, laba: penjualan - cogs - pengeluaran - fee }
  }, [txs, cogsMap])

  const mutasi = useMemo(() => accounts.map((acc) => {
    let masuk = 0, keluar = 0
    txs.forEach((tx) => {
      const a = Number(tx.amount); const f = Number(tx.fee || 0)
      if (tx.type === 'transfer') {
        if (tx.account_id === acc.id) masuk += a
        if (tx.cash_account_id === acc.id) keluar += a + f
      } else if (tx.type === 'topup') {
        if (tx.account_id === acc.id) masuk += a
        if (tx.cash_account_id === acc.id) keluar += a
        if (tx.fee_account_id === acc.id) masuk += f
      } else if (tx.type === 'expense') {
        if (tx.account_id === acc.id) keluar += a
      } else if (tx.type === 'piutang_payment') {
        if (tx.account_id === acc.id) masuk += a
        if (tx.cash_account_id === acc.id) keluar += a
      } else if (tx.type === 'sale') {
        if (tx.account_id === acc.id) masuk += a
      }
    })
    return { ...acc, masuk, keluar }
  }), [accounts, txs])

  const nameOfAccount = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '-'

  async function handleDelete(tx: Tx) {
    if (!confirm('Hapus transaksi ini?')) return
    const { error } = await supabase.rpc('delete_transaction', { p_tx_id: tx.id })
    if (error) return toast.error(error.message)
    toast.success('Transaksi dihapus'); load()
  }

  function openEdit(tx: Tx) {
    setEditing(tx)
    setEditForm({
      account_id: tx.account_id ?? '', amount: String(tx.amount), fee: String(tx.fee || 0),
      method: tx.method ?? 'lunas', customer_name: tx.customer_name ?? '', note: tx.note ?? '', date: tx.date,
    })
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setLoading(true)
    try {
      const { error } = await supabase.from('transactions').update({
        account_id: editForm.account_id || null, amount: Number(editForm.amount),
        fee: Number(editForm.fee || 0), method: editForm.method,
        customer_name: editForm.customer_name.trim() || null,
        note: editForm.note.trim() || null, date: editForm.date,
      }).eq('id', editing.id)
      if (error) throw error
      toast.success('Transaksi diperbarui'); setEditing(null); load()
    } catch (err) { toast.error((err as any)?.message || 'Terjadi kesalahan') }
    finally { setLoading(false) }
  }

  async function handlePay() {
    if (!paying) return
    const n = Number(payAmount)
    if (!payAccount) return toast.error('Pilih rekening penerima')
    if (isNaN(n) || n <= 0) return toast.error('Nominal tidak valid')
    if (n > Number(paying.remaining)) return toast.error('Nominal melebihi sisa piutang')
    setLoading(true)
    try {
      const { error } = await supabase.rpc('pay_piutang', { p_piutang_id: paying.id, p_account_id: payAccount, p_amount: n })
      if (error) throw error
      toast.success('Piutang dibayar'); setPaying(null); setPayAmount(''); load()
    } catch (err) { toast.error((err as any)?.message || 'Terjadi kesalahan') }
    finally { setLoading(false) }
  }

  function exportExcel() {
    const rows = txs.map((t) => ({
      Tanggal: t.date, Tipe: TYPE_LABEL[t.type] ?? t.type, Akun: nameOfAccount(t.account_id),
      Nominal: Number(t.amount), Fee: Number(t.fee || 0),
      Metode: t.method ?? '-', Customer: t.customer_name ?? '-', Catatan: t.note ?? '-',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transaksi')
    XLSX.writeFile(wb, `laporan-${start}-sampai-${end}.xlsx`)
    toast.success('Export Excel berhasil')
  }

  const Card = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="flex-1 rounded-2xl bg-white p-4 shadow">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{formatRp(value)}</p>
    </div>
  )

  const Section = ({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) => (
    <div className="rounded-2xl bg-white p-4 shadow">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button onClick={onToggle} className="rounded-lg border border-sky-500 px-3 py-1 text-xs font-medium text-sky-600">
          {open ? 'Sembunyikan' : 'Tampilkan'}
        </button>
      </div>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow">
        <div className="flex gap-2">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="flex-1 rounded-lg border px-3 py-2 text-sm" />
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="flex-1 rounded-lg border px-3 py-2 text-sm" />
        </div>
        <button onClick={exportExcel} className="mt-2 w-full rounded-lg bg-green-600 py-2 text-sm font-medium text-white">Export Excel</button>
      </div>

      <div className="flex gap-3">
        <Card label="Total Fee" value={summary.fee} color="text-amber-600" />
        <Card label="Pengeluaran" value={summary.pengeluaran} color="text-red-600" />
        <Card label="Laba Bersih" value={summary.laba} color="text-green-600" />
      </div>

      <Section title="Mutasi Saldo per Akun" open={showMutasi} onToggle={() => setShowMutasi(!showMutasi)}>
        <div className="space-y-2">
          {mutasi.map((m) => (
            <div key={m.id} className="flex items-center justify-between border-b pb-2 text-sm">
              <div>
                <p className="font-medium">{m.name}</p>
                <p className="text-xs text-gray-500">Saldo: {formatRp(Number(m.balance))}</p>
              </div>
              <div className="text-right text-xs">
                <p className="text-green-600">Masuk {formatRp(m.masuk)}</p>
                <p className="text-red-600">Keluar {formatRp(m.keluar)}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Daftar Transaksi" open={showTx} onToggle={() => setShowTx(!showTx)}>
        <div className="space-y-2">
          {txs.length === 0 && <p className="text-sm text-gray-400">Tidak ada transaksi di rentang ini</p>}
          {txs.map((t) => (
            <div key={t.id} className="border-b pb-2 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t.date} — {TYPE_LABEL[t.type] ?? t.type}</p>
                  <p className="text-xs text-gray-500">{nameOfAccount(t.account_id)} · {t.customer_name ?? t.note ?? '-'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatRp(Number(t.amount))}</span>
                  <button onClick={() => openEdit(t)} className="text-blue-600">Edit</button>
                  <button onClick={() => handleDelete(t)} className="text-red-600">Hapus</button>
                </div>
              </div>
              {Number(t.fee) > 0 && <p className="text-xs text-amber-600">Fee: {formatRp(Number(t.fee))}</p>}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Piutang Aktif" open={showPiutang} onToggle={() => setShowPiutang(!showPiutang)}>
        <div className="space-y-2">
          {piutang.length === 0 && <p className="text-sm text-gray-400">Tidak ada piutang aktif</p>}
          {piutang.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b pb-2 text-sm">
              <div>
                <p className="font-medium">{p.customer_name}</p>
                <p className="text-xs text-gray-500">Total {formatRp(Number(p.total_due))} · Sisa {formatRp(Number(p.remaining))}</p>
              </div>
              <button onClick={() => { setPaying(p); setPayAccount(''); setPayAmount('') }}
                className="rounded-lg bg-sky-500 px-3 py-1 text-xs font-medium text-white">Bayar</button>
            </div>
          ))}
        </div>
      </Section>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form onSubmit={handleSaveEdit} className="w-full max-w-md space-y-2 rounded-2xl bg-white p-4">
            <h3 className="text-sm font-semibold">Edit Transaksi</h3>
            <select value={editForm.account_id} onChange={(e) => setEditForm({ ...editForm, account_id: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} inputMode="numeric" placeholder="Nominal" className="w-full rounded-lg border px-3 py-2 text-sm" />
            <input value={editForm.fee} onChange={(e) => setEditForm({ ...editForm, fee: e.target.value })} inputMode="numeric" placeholder="Fee" className="w-full rounded-lg border px-3 py-2 text-sm" />
            <input value={editForm.customer_name} onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })} placeholder="Nama customer" className="w-full rounded-lg border px-3 py-2 text-sm" />
            <input value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} placeholder="Catatan" className="w-full rounded-lg border px-3 py-2 text-sm" />
            <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button disabled={loading} className="flex-1 rounded-lg bg-sky-500 py-2 text-sm font-medium text-white disabled:opacity-50">
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-lg bg-gray-200 py-2 text-sm">Batal</button>
            </div>
          </form>
        </div>
      )}

      {paying && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md space-y-2 rounded-2xl bg-white p-4">
            <h3 className="text-sm font-semibold">Bayar Piutang — {paying.customer_name}</h3>
            <p className="text-xs text-gray-500">Sisa: {formatRp(Number(paying.remaining))}</p>
            <select value={payAccount} onChange={(e) => setPayAccount(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm">
              <option value="">Pilih rekening penerima</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} inputMode="numeric" placeholder="Nominal bayar" className="w-full rounded-lg border px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button onClick={handlePay} disabled={loading} className="flex-1 rounded-lg bg-sky-500 py-2 text-sm font-medium text-white disabled:opacity-50">
                {loading ? 'Menyimpan...' : 'Bayar'}
              </button>
              <button onClick={() => setPaying(null)} className="flex-1 rounded-lg bg-gray-200 py-2 text-sm">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
