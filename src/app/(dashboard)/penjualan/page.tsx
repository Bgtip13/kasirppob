'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

type Account = { id: string; name: string }
type Barang = { id: string; nama: string; harga_beli: number; harga_jual: number; stok: number; is_active: boolean }
type CartItem = { barang_id: string; nama: string; harga: number; qty: number; stok: number }
type SaleTx = { id: string; penjualan_id: string | null; account_id: string | null; amount: number; note: string | null; date: string }

const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

export default function PenjualanPage() {
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

  const [showAddBarang, setShowAddBarang] = useState(false)
  const [nama, setNama] = useState('')
  const [hargaBeli, setHargaBeli] = useState('')
  const [harga, setHarga] = useState('')
  const [stok, setStok] = useState('')

  const [editingBarang, setEditingBarang] = useState<Barang | null>(null)
  const [editNama, setEditNama] = useState('')
  const [editBeli, setEditBeli] = useState('')
  const [editJual, setEditJual] = useState('')
  const [editStok, setEditStok] = useState('')

  const [sales, setSales] = useState<SaleTx[]>([])
  const [labaMap, setLabaMap] = useState<Record<string, number>>({})

  async function loadBarang() {
    const { data, error } = await supabase
      .from('barang').select('id, nama, harga_beli, harga_jual, stok, is_active')
      .eq('is_active', true).order('nama')
    if (error) return toast.error(error.message)
    setBarang((data ?? []) as Barang[])
    if (data?.length && !data.find((b) => b.id === selectedBarangId)) setSelectedBarangId(data[0].id)
  }

  async function loadSales() {
    const [txRes, itemRes] = await Promise.all([
      supabase.from('transactions').select('id, penjualan_id, account_id, amount, note, date')
        .eq('type', 'sale').order('date', { ascending: false }),
      supabase.from('penjualan_item').select('penjualan_id, qty, barang(harga_beli)'),
    ])
    if (txRes.error) return toast.error(txRes.error.message)
    setSales((txRes.data ?? []) as SaleTx[])
    if (itemRes.error) return
    const m: Record<string, number> = {}
    ;(itemRes.data ?? []).forEach((it: any) => {
      const beli = Number(it.barang?.harga_beli || 0)
      m[it.penjualan_id] = (m[it.penjualan_id] || 0) + beli * Number(it.qty)
    })
    setLabaMap(m)
  }

  useEffect(() => {
    supabase.from('accounts').select('id, name').eq('is_active', true).order('name')
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

  async function handleAddBarang(e: React.FormEvent) {
    e.preventDefault()
    const nHarga = Number(harga); const nStok = Number(stok); const nBeli = Number(hargaBeli || 0)
    if (!nama.trim()) return toast.error('Nama barang wajib diisi')
    if (isNaN(nHarga) || nHarga <= 0) return toast.error('Harga jual tidak valid')
    if (isNaN(nStok) || nStok < 0) return toast.error('Stok tidak valid')
    setLoading(true)
    try {
      const { error } = await supabase.rpc('add_barang', { p_nama: nama.trim(), p_harga: nHarga, p_stok: nStok, p_harga_beli: nBeli })
      if (error) throw error
      toast.success('Barang ditambahkan')
      setNama(''); setHarga(''); setHargaBeli(''); setStok(''); setShowAddBarang(false)
      loadBarang()
    } catch (err) { toast.error((err as any)?.message || 'Terjadi kesalahan') }
    finally { setLoading(false) }
  }

  async function deleteBarang(b: Barang) {
    if (!confirm(`Hapus barang "${b.nama}"?`)) return
    const { error } = await supabase.from('barang').update({ is_active: false }).eq('id', b.id)
    if (error) return toast.error(error.message)
    toast.success('Barang dihapus'); loadBarang()
  }

  function openEditBarang(b: Barang) {
    setEditingBarang(b); setEditNama(b.nama); setEditBeli(String(b.harga_beli))
    setEditJual(String(b.harga_jual)); setEditStok(String(b.stok))
  }

  async function saveEditBarang() {
    if (!editingBarang) return
    setLoading(true)
    try {
      const { error } = await supabase.from('barang').update({
        nama: editNama.trim(), harga_beli: Number(editBeli || 0),
        harga_jual: Number(editJual), stok: Number(editStok || 0),
      }).eq('id', editingBarang.id)
      if (error) throw error
      toast.success('Barang diperbarui'); setEditingBarang(null); loadBarang()
    } catch (err) { toast.error((err as any)?.message || 'Terjadi kesalahan') }
    finally { setLoading(false) }
  }

  function addToCart() {
    const b = barang.find((x) => x.id === selectedBarangId)
    if (!b) return toast.error('Pilih barang dulu')
    const nQty = Number(qty)
    if (isNaN(nQty) || nQty <= 0) return toast.error('Qty tidak valid')
    if (nQty > b.stok) return toast.error(`Stok ${b.nama} hanya ${b.stok}`)
    setCart((prev) => {
      const found = prev.find((c) => c.barang_id === b.id)
      if (found) {
        if (found.qty + nQty > b.stok) { toast.error(`Stok ${b.nama} tidak cukup`); return prev }
        return prev.map((c) => (c.barang_id === b.id ? { ...c, qty: c.qty + nQty } : c))
      }
      return [...prev, { barang_id: b.id, nama: b.nama, harga: b.harga_jual, qty: nQty, stok: b.stok }]
    })
  }

  const removeFromCart = (barang_id: string) => setCart((prev) => prev.filter((c) => c.barang_id !== barang_id))

  async function saveSale() {
    if (!accountId) return toast.error('Pilih akun tujuan dulu')
    if (cart.length === 0) return toast.error('Keranjang masih kosong')
    setLoading(true)
    try {
      const { error } = await supabase.rpc('process_sale', {
        p_account_id: accountId,
        p_items: cart.map((c) => ({ barang_id: c.barang_id, qty: c.qty })),
        p_catatan: note.trim() || null,
        p_date: date,
      })
      if (error) throw error
      toast.success('Penjualan tersimpan')
      setCart([]); setNote(''); setQty('1'); loadBarang(); loadSales()
    } catch (err) { toast.error((err as any)?.message || 'Terjadi kesalahan') }
    finally { setLoading(false) }
  }

  async function deleteSale(s: SaleTx) {
    if (!confirm('Hapus penjualan ini? Stok & saldo akun akan dikembalikan.')) return
    const { error } = await supabase.rpc('delete_transaction', { p_tx_id: s.id })
    if (error) return toast.error(error.message)
    toast.success('Penjualan dihapus'); loadSales(); loadBarang()
  }

  async function printNota(s: SaleTx) {
    const { data: items, error } = await supabase
      .from('penjualan_item').select('nama, qty, harga, subtotal').eq('penjualan_id', s.penjualan_id)
    if (error) return toast.error(error.message)
    const w = window.open('', '_blank', 'width=420,height=600')
    if (!w) return toast.error('Pop-up diblokir. Izinkan pop-up untuk situs ini.')
    const tgl = new Date(s.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    const rows = (items ?? []).map((it: any) =>
      `<tr><td>${it.nama}</td><td>${it.qty}</td><td>${formatRp(Number(it.harga))}</td><td>${formatRp(Number(it.subtotal))}</td></tr>`
    ).join('')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Nota</title><style>
body{font-family:Arial,sans-serif;padding:24px;color:#111}
h1{font-size:18px;margin:0 0 2px}.sub{color:#666;font-size:11px;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
th,td{padding:6px 4px;text-align:left;border-bottom:1px solid #eee}th{font-size:11px;color:#666}
.total{font-size:14px;font-weight:bold;margin-top:12px}.foot{margin-top:16px;font-size:11px;color:#666}
</style></head><body>
<h1>Nota Penjualan</h1><div class="sub">Tanggal: ${tgl}<br>Pembayaran: ${nameOfAccount(s.account_id)}</div>
<table><tr><th>Nama</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr>${rows}</table>
<div class="total">Total: ${formatRp(Number(s.amount))}</div>
<div class="foot">Terima kasih 🙏</div><script>window.print()</scr` + `ipt></body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['jual', 'barang', 'riwayat'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${tab === t ? 'bg-sky-500 text-white' : 'bg-white text-gray-600'}`}>
            {t === 'jual' ? 'Jual' : t === 'barang' ? 'Barang' : 'Riwayat'}
          </button>
        ))}
      </div>

      {tab === 'jual' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow">
            <h2 className="mb-3 text-sm font-semibold">Keranjang Penjualan</h2>
            <label className="block text-sm text-gray-600">Uang masuk ke rekening
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <select value={selectedBarangId} onChange={(e) => setSelectedBarangId(e.target.value)} className="col-span-2 rounded-lg border px-3 py-2 text-sm">
                {barang.length === 0 && <option value="">Belum ada barang</option>}
                {barang.map((b) => <option key={b.id} value={b.id}>{b.nama} — stok {b.stok}</option>)}
              </select>
              <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" placeholder="Qty" className="rounded-lg border px-3 py-2 text-sm" />
            </div>
            <button onClick={addToCart} className="mt-2 w-full rounded-lg bg-gray-800 py-2 text-sm font-medium text-white">+ Tambah ke Keranjang</button>
            {cart.length > 0 && (
              <div className="mt-3 space-y-2">
                {cart.map((c) => (
                  <div key={c.barang_id} className="flex items-center justify-between border-b pb-1 text-sm">
                    <span>{c.nama} × {c.qty}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatRp(c.harga * c.qty)}</span>
                      <button onClick={() => removeFromCart(c.barang_id)} className="text-red-500">✕</button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1 text-sm font-bold">
                  <span>Total</span><span>{formatRp(totalCart)}</span>
                </div>
              </div>
            )}
          </div>
          <div className="rounded-2xl bg-white p-4 shadow">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (opsional)" className="w-full rounded-lg border px-3 py-2 text-sm" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" />
            <button onClick={saveSale} disabled={loading} className="mt-3 w-full rounded-lg bg-sky-500 py-2 font-medium text-white disabled:opacity-50">
              {loading ? 'Menyimpan...' : 'Simpan Penjualan'}
            </button>
          </div>
        </div>
      )}

      {tab === 'barang' && (
        <div className="rounded-2xl bg-white p-4 shadow">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Daftar Barang</h2>
            <button onClick={() => setShowAddBarang(!showAddBarang)} className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-white">
              {showAddBarang ? 'Tutup' : '+ Tambah Barang'}
            </button>
          </div>
          {showAddBarang && (
            <form onSubmit={handleAddBarang} className="mb-4 space-y-2 rounded-xl bg-gray-50 p-3">
              <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama barang" className="w-full rounded-lg border px-3 py-2 text-sm" />
              <input value={hargaBeli} onChange={(e) => setHargaBeli(e.target.value)} inputMode="numeric" placeholder="Harga beli" className="w-full rounded-lg border px-3 py-2 text-sm" />
              <input value={harga} onChange={(e) => setHarga(e.target.value)} inputMode="numeric" placeholder="Harga jual" className="w-full rounded-lg border px-3 py-2 text-sm" />
              <input value={stok} onChange={(e) => setStok(e.target.value)} inputMode="numeric" placeholder="Stok" className="w-full rounded-lg border px-3 py-2 text-sm" />
              <button disabled={loading} className="w-full rounded-lg bg-sky-500 py-2 text-sm font-medium text-white disabled:opacity-50">
                {loading ? 'Menyimpan...' : 'Simpan Barang'}
              </button>
            </form>
          )}
          <div className="space-y-2">
            {barang.length === 0 && <p className="text-sm text-gray-400">Belum ada barang. Klik "+ Tambah Barang".</p>}
            {barang.map((b) => (
              <div key={b.id} className="flex items-center justify-between border-b pb-2 text-sm">
                <div>
                  <p className="font-medium">{b.nama}</p>
                  <p className="text-xs text-gray-500">Jual {formatRp(b.harga_jual)} · Beli {formatRp(b.harga_beli)} · Stok {b.stok}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => openEditBarang(b)} className="text-blue-600">Edit</button>
                  <button onClick={() => deleteBarang(b)} className="text-red-600">Hapus</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'riwayat' && (
        <div className="rounded-2xl bg-white p-4 shadow">
          <h2 className="mb-3 text-sm font-semibold">Riwayat Penjualan</h2>
          {sales.length === 0 && <p className="text-sm text-gray-400">Belum ada penjualan</p>}
          <div className="space-y-2">
            {sales.map((s) => {
              const laba = Number(s.amount) - (labaMap[s.penjualan_id || ''] || 0)
              return (
                <div key={s.id} className="border-b pb-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{s.date} — {nameOfAccount(s.account_id)}</p>
                      <p className="text-xs text-gray-500">{s.note ?? '-'}</p>
                    </div>
                    <span className="font-semibold">{formatRp(Number(s.amount))}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-green-600">Laba: {formatRp(laba)}</span>
                    <div className="flex gap-3">
                      <button onClick={() => printNota(s)} className="text-blue-600">Cetak Nota</button>
                      <button onClick={() => deleteSale(s)} className="text-red-600">Hapus</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {editingBarang && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md space-y-2 rounded-2xl bg-white p-4">
            <h3 className="text-sm font-semibold">Edit Barang</h3>
            <input value={editNama} onChange={(e) => setEditNama(e.target.value)} placeholder="Nama barang" className="w-full rounded-lg border px-3 py-2 text-sm" />
            <input value={editBeli} onChange={(e) => setEditBeli(e.target.value)} inputMode="numeric" placeholder="Harga beli" className="w-full rounded-lg border px-3 py-2 text-sm" />
            <input value={editJual} onChange={(e) => setEditJual(e.target.value)} inputMode="numeric" placeholder="Harga jual" className="w-full rounded-lg border px-3 py-2 text-sm" />
            <input value={editStok} onChange={(e) => setEditStok(e.target.value)} inputMode="numeric" placeholder="Stok" className="w-full rounded-lg border px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button onClick={saveEditBarang} disabled={loading} className="flex-1 rounded-lg bg-sky-500 py-2 text-sm font-medium text-white disabled:opacity-50">
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button onClick={() => setEditingBarang(null)} className="flex-1 rounded-lg bg-gray-200 py-2 text-sm">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
