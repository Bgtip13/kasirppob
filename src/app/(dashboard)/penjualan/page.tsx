'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

type Account = { id: string; name: string }
type Barang = { id: string; nama: string; harga_jual: number; stok: number; is_active: boolean }
type CartItem = { barang_id: string; nama: string; harga: number; qty: number; stok: number }
type SaleTx = {
  id: string
  penjualan_id: string | null
  account_id: string | null
  amount: number
  note: string | null
  date: string
}

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

export default function PenjualanPage() {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'jual' | 'barang' | 'riwayat'>('jual')

  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState('')
  const [barang, setBarang] = useState<Barang[]>([])
  const [selectedBarangId, setSelectedBarangId] = useState('')
  const [qty, setQty] = useState('1')
  const [cart, setCart] = useState<CartItem[]>([])
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  const [nama, setNama] = useState('')
  const [harga, setHarga] = useState('')
  const [stok, setStok] = useState('')

  const [sales, setSales] = useState<SaleTx[]>([])

  async function loadBarang() {
    const { data, error } = await supabase
      .from('barang')
      .select('id, nama, harga_jual, stok, is_active')
      .eq('is_active', true)
      .order('nama')
    if (error) return
    setBarang((data ?? []) as Barang[])
    if (data?.length && !data.find((b) => b.id === selectedBarangId)) {
      setSelectedBarangId(data[0].id)
    }
  }

  async function loadSales() {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, penjualan_id, account_id, amount, note, date')
      .eq('type', 'sale')
      .order('date', { ascending: false })
    if (error) return
    setSales((data ?? []) as SaleTx[])
  }

  useEffect(() => {
    supabase
      .from('accounts')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data, error }) => {
        if (error) return
        setAccounts((data ?? []) as Account[])
        if (data?.length) setAccountId(data[0].id)
      })
    loadBarang()
    loadSales()
  }, [])

  const totalCart = cart.reduce((s, c) => s + c.harga * c.qty, 0)
  const nameOfAccount = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '-'

  function addToCart() {
    const b = barang.find((x) => x.id === selectedBarangId)
    if (!b) return toast.error('Pilih barang dulu')
    const q = Number(qty)
    if (isNaN(q) || q <= 0) return toast.error('Qty harus lebih dari 0')
    const existing = cart.find((c) => c.barang_id === b.id)
    const used = existing ? existing.qty : 0
    if (used + q > Number(b.stok)) return toast.error(`Stok tidak cukup (sisa ${b.stok})`)
    if (existing) {
      setCart(cart.map((c) => (c.barang_id === b.id ? { ...c, qty: c.qty + q } : c)))
    } else {
      setCart([...cart, { barang_id: b.id, nama: b.nama, harga: Number(b.harga_jual), qty: q, stok: Number(b.stok) }])
    }
    toast.success(`${b.nama} ditambahkan`)
  }

  function removeFromCart(barang_id: string) {
    setCart(cart.filter((c) => c.barang_id !== barang_id))
  }

  async function submitSale() {
    if (cart.length === 0) return toast.error('Keranjang kosong')
    if (!accountId) return toast.error('Pilih akun tujuan')
    setLoading(true)
    try {
      const { error } = await supabase.rpc('process_sale', {
        p_account_id: accountId,
        p_items: cart.map((c) => ({ barang_id: c.barang_id, qty: c.qty })),
        p_catatan: note.trim() || null,
        p_date: date,
      })
      if (error) throw error
      toast.success('Penjualan berhasil dicatat')
      setCart([])
      setNote('')
      loadBarang()
      loadSales()
      router.refresh()
    } catch (err) {
      toast.error((err as any)?.message || 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  async function addBarang(e: React.FormEvent) {
    e.preventDefault()
    if (!nama.trim()) return toast.error('Nama barang wajib diisi')
    const h = Number(harga || 0)
    const s = Number(stok || 0)
    if (h < 0 || s < 0) return toast.error('Harga/stok tidak valid')
    setLoading(true)
    try {
      const { error } = await supabase.rpc('add_barang', {
        p_nama: nama.trim(),
        p_harga: h,
        p_stok: s,
      })
      if (error) throw error
      toast.success('Barang ditambahkan')
      setNama('')
      setHarga('')
      setStok('')
      loadBarang()
    } catch (err) {
      toast.error((err as any)?.message || 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  async function deleteBarang(id: string) {
    if (!confirm('Hapus barang ini?')) return
    const { error } = await supabase.from('barang').update({ is_active: false }).eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Barang dihapus')
    loadBarang()
  }

  async function deleteSale(tx: SaleTx) {
    if (!confirm('Hapus penjualan ini? Stok akan dikembalikan dan saldo akun dipotong kembali.')) return
    const { error } = await supabase.rpc('delete_transaction', { p_tx_id: tx.id })
    if (error) return toast.error(error.message)
    toast.success('Penjualan dihapus')
    loadBarang()
    loadSales()
    router.refresh()
  }

  async function printNota(tx: SaleTx) {
    if (!tx.penjualan_id) return toast.error('Data nota tidak ditemukan')
    const [itemsRes, profileRes] = await Promise.all([
      supabase
        .from('penjualan_item')
        .select('nama, harga, qty, subtotal')
        .eq('penjualan_id', tx.penjualan_id),
      supabase.from('profiles').select('id, nama_usaha').maybeSingle(),
    ])
    const items = itemsRes.data ?? []
    const namaUsaha = profileRes.data?.nama_usaha ?? ''
    const kasirId = profileRes.data?.id ?? ''

    const w = window.open('', '_blank', 'width=380,height=600')
    if (!w) return toast.error('Popup diblokir browser, izinkan popup dulu')

    w.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Nota Penjualan</title>
<style>
  body { font-family: Arial, sans-serif; width: 300px; margin: 0 auto; padding: 20px; color: #111; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 2px; }
  .sub { text-align: center; font-size: 11px; color: #555; margin-bottom: 12px; }
  .info { font-size: 11px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td { padding: 5px 0; border-bottom: 1px solid #eee; vertical-align: top; }
  .right { text-align: right; white-space: nowrap; }
  .total { font-weight: bold; font-size: 14px; }
  .footer { text-align: center; font-size: 10px; color: #888; margin-top: 16px; }
</style>
</head>
<body>
  <h1>Aplikasi Kasir</h1>
  <div class="sub">${namaUsaha ? namaUsaha + '<br>' : ''}by NB Projects</div>
  <div class="info">
    No: ${tx.id.slice(0, 8).toUpperCase()}<br>
    Tanggal: ${tx.date}<br>
    Kasir: ${kasirId}<br>
    Pembayaran: ${nameOfAccount(tx.account_id)}
  </div>
  <table>
    ${items
      .map(
        (i) =>
          `<tr><td>${i.nama}<br><span style="color:#666">${i.qty} x ${formatRp(Number(i.harga))}</span></td><td class="right">${formatRp(Number(i.subtotal))}</td></tr>`
      )
      .join('')}
    <tr class="total"><td>TOTAL</td><td class="right">${formatRp(Number(tx.amount))}</td></tr>
  </table>
  <div class="footer">Terima kasih — Aplikasi Kasir by NB Projects</div>
</body>
</html>`)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Penjualan</h1>

      <div className="grid grid-cols-3 gap-2">
        {(['jual', 'barang', 'riwayat'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg py-2 text-sm font-medium ${tab === t ? 'bg-sky-500 text-white' : 'bg-white text-gray-700'}`}
          >
            {t === 'jual' ? '🛒 Jual' : t === 'barang' ? '📦 Barang' : '🧾 Riwayat'}
          </button>
        ))}
      </div>

      {tab === 'jual' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow">
            <h2 className="mb-3 text-sm font-semibold">Keranjang</h2>
            <div className="flex gap-2">
              <select value={selectedBarangId} onChange={(e) => setSelectedBarangId(e.target.value)} className="flex-1 rounded-lg border px-3 py-2">
                {barang.map((b) => (
                  <option key={b.id} value={b.id}>{b.nama} — Stok {b.stok}</option>
                ))}
              </select>
              <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="w-20 rounded-lg border px-3 py-2" min="1" />
              <button onClick={addToCart} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white">+ Tambah</button>
            </div>

            {cart.length > 0 && (
              <div className="mt-3 space-y-2">
                {cart.map((c) => (
                  <div key={c.barang_id} className="flex items-center justify-between border-b pb-2 text-sm">
                    <div>
                      <p className="font-medium">{c.nama}</p>
                      <p className="text-xs text-gray-500">{c.qty} x {formatRp(c.harga)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{formatRp(c.qty * c.harga)}</span>
                      <button onClick={() => removeFromCart(c.barang_id)} className="text-red-600">✕</button>
                    </div>
                  </div>
                ))}
                <p className="pt-2 text-right font-semibold">Total: {formatRp(totalCart)}</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow">
            <h2 className="mb-3 text-sm font-semibold">Pembayaran</h2>
            <label className="block">
              <span className="text-sm text-gray-600">Uang Masuk ke Akun</span>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="text-sm text-gray-600">Tanggal</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
            </label>
            <label className="mt-3 block">
              <span className="text-sm text-gray-600">Catatan</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Opsional" />
            </label>
            <button onClick={submitSale} disabled={loading} className="mt-4 w-full rounded-lg bg-sky-500 py-2 font-medium text-white disabled:opacity-50">
              {loading ? 'Menyimpan...' : `Simpan Penjualan (${formatRp(totalCart)})`}
            </button>
          </div>
        </div>
      )}

      {tab === 'barang' && (
        <div className="space-y-4">
          <form onSubmit={addBarang} className="space-y-3 rounded-2xl bg-white p-4 shadow">
            <h2 className="text-sm font-semibold">Tambah Barang</h2>
            <input placeholder="Nama barang" value={nama} onChange={(e) => setNama(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" inputMode="numeric" placeholder="Harga jual" value={harga} onChange={(e) => setHarga(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
              <input type="number" inputMode="numeric" placeholder="Stok" value={stok} onChange={(e) => setStok(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
            </div>
            <button disabled={loading} className="w-full rounded-lg bg-sky-500 py-2 font-medium text-white disabled:opacity-50">
              {loading ? 'Menyimpan...' : 'Tambah Barang'}
            </button>
          </form>

          <div className="rounded-2xl bg-white p-4 shadow">
            <h2 className="mb-3 text-sm font-semibold">Daftar Barang ({barang.length})</h2>
            {barang.length === 0 && <p className="text-sm text-gray-400">Belum ada barang. Tambahkan dulu di atas.</p>}
            <div className="space-y-2">
              {barang.map((b) => (
                <div key={b.id} className="flex items-center justify-between border-b pb-2 text-sm">
                  <div>
                    <p className="font-medium">{b.nama}</p>
                    <p className="text-xs text-gray-500">{formatRp(Number(b.harga_jual))} · Stok {b.stok}</p>
                  </div>
                  <button onClick={() => deleteBarang(b.id)} className="text-red-600">Hapus</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'riwayat' && (
        <div className="rounded-2xl bg-white p-4 shadow">
          <h2 className="mb-3 text-sm font-semibold">Riwayat Penjualan</h2>
          {sales.length === 0 && <p className="text-sm text-gray-400">Belum ada penjualan</p>}
          <div className="space-y-2">
            {sales.map((s) => (
              <div key={s.id} className="flex items-center justify-between border-b pb-2 text-sm">
                <div>
                  <p className="font-medium">{s.date} — {nameOfAccount(s.account_id)}</p>
                  <p className="text-xs text-gray-500">{s.note ?? '-'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatRp(Number(s.amount))}</span>
                  <button onClick={() => printNota(s)} className="text-blue-600">Cetak Nota</button>
                  <button onClick={() => deleteSale(s)} className="text-red-600">Hapus</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
