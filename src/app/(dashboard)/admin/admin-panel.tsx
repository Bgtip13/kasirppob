'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { listBuyers, createActivationCode, resetBuyer, deleteBuyer, type Buyer } from '@/app/actions/admin'

function timeAgo(iso: string | null) {
  if (!iso) return '-'
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'baru saja'
  if (min < 60) return `${min} menit lalu`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} jam lalu`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} hari lalu`
  return `${Math.floor(d / 30)} bulan lalu`
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'

export default function AdminPanel() {
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [loading, setLoading] = useState(true)
  const [showCode, setShowCode] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try { setBuyers(await listBuyers()) }
    catch (err) { toast.error((err as any)?.message || 'Gagal memuat pembeli') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleCreateCode() {
    try {
      const code = await createActivationCode()
      setShowCode(code)
      toast.success('Kode aktivasi dibuat')
    } catch (err) { toast.error((err as any)?.message || 'Gagal membuat kode') }
  }

  async function copyCode(code: string) {
    try { await navigator.clipboard.writeText(code); toast.success('Kode disalin') }
    catch { toast.error('Gagal menyalin') }
  }

  async function handleReset(id: string) {
    if (!confirm('Reset SEMUA data pembeli ini? Akun tetap ada, saldo jadi nol.')) return
    setBusyId(id)
    try { await resetBuyer(id); toast.success('Data pembeli di-reset'); load() }
    catch (err) { toast.error((err as any)?.message || 'Gagal reset') }
    finally { setBusyId(null) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus TOTAL pembeli ini? Semua datanya hilang permanen.')) return
    setBusyId(id)
    try { await deleteBuyer(id); toast.success('Pembeli dihapus'); load() }
    catch (err) { toast.error((err as any)?.message || 'Gagal hapus') }
    finally { setBusyId(null) }
  }

  const kodeTerpakai = buyers.filter((b) => b.activation_code).length
  const loginHariIni = buyers.filter((b) => b.last_login_at && Date.now() - new Date(b.last_login_at).getTime() < 86400000).length

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#1B2A4A] p-5 text-white shadow">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Panel Admin</h1>
            <p className="mt-0.5 text-xs text-blue-200">Kelola pembeli, kode aktivasi, dan data aplikasi</p>
          </div>
          <button onClick={handleCreateCode} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white">
            + Kode Aktivasi
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white p-3 text-center shadow">
          <p className="text-xl font-bold text-[#1B2A4A]">{buyers.length}</p>
          <p className="text-xs text-gray-500">Total Pembeli</p>
        </div>
        <div className="rounded-2xl bg-white p-3 text-center shadow">
          <p className="text-xl font-bold text-[#1B2A4A]">{kodeTerpakai}</p>
          <p className="text-xs text-gray-500">Kode Terpakai</p>
        </div>
        <div className="rounded-2xl bg-white p-3 text-center shadow">
          <p className="text-xl font-bold text-green-600">{loginHariIni}</p>
          <p className="text-xs text-gray-500">Login Hari Ini</p>
        </div>
      </div>

      {showCode && (
        <div className="rounded-2xl border-2 border-dashed border-green-500 bg-green-50 p-4">
          <p className="text-xs font-semibold text-green-700">Kode Aktivasi Baru</p>
          <p className="mt-1 text-2xl font-bold tracking-widest text-green-700">{showCode}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => copyCode(showCode)} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white">Salin Kode</button>
            <button onClick={() => setShowCode(null)} className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs">Tutup</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading && <p className="text-sm text-gray-400">Memuat...</p>}
        {!loading && buyers.length === 0 && <p className="text-sm text-gray-400">Belum ada pembeli</p>}
        {buyers.map((b) => (
          <div key={b.id} className="rounded-2xl bg-white p-4 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">{b.business_name || b.id}</p>
                <p className="text-xs text-gray-500">ID: {b.id}</p>
              </div>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">{b.status}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-gray-400">Login Terakhir</p>
                <p className="mt-0.5 font-medium">{timeAgo(b.last_login_at)}</p>
                <p className="text-[10px] text-gray-400">{fmtDate(b.last_login_at)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-gray-400">Sejak Pembelian</p>
                <p className="mt-0.5 font-medium">{timeAgo(b.created_at)}</p>
                <p className="text-[10px] text-gray-400">{fmtDate(b.created_at)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <p className="text-gray-400">Kode Aktivasi</p>
                <button onClick={() => b.activation_code && copyCode(b.activation_code)}
                  className="mt-0.5 font-mono font-semibold text-sky-600 underline">
                  {b.activation_code ?? '-'}
                </button>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => handleReset(b.id)} disabled={busyId === b.id}
                className="flex-1 rounded-lg bg-amber-500 py-2 text-xs font-medium text-white disabled:opacity-50">
                {busyId === b.id ? 'Memproses...' : 'Reset Data'}
              </button>
              <button onClick={() => handleDelete(b.id)} disabled={busyId === b.id}
                className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-medium text-white disabled:opacity-50">
                {busyId === b.id ? 'Memproses...' : 'Hapus'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
