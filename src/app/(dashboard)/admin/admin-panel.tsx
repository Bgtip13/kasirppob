'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { adminGenerateCodes, adminDeleteUser, adminToggleActive } from '@/app/actions/admin'

type Buyer = {
  user_id: string
  id: string
  nama_usaha: string | null
  is_active: boolean
  created_at: string
}
type Code = { code: string; is_used: boolean; created_at: string }

export default function AdminPanel({ buyers, codes }: { buyers: Buyer[]; codes: Code[] }) {
  const router = useRouter()
  const [count, setCount] = useState('1')
  const [generated, setGenerated] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  async function generate() {
    const n = Number(count) || 1
    setLoading(true)
    try {
      const result = await adminGenerateCodes(n)
      setGenerated(result)
      toast.success(`${result.length} kode berhasil dibuat`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  async function toggle(b: Buyer) {
    try {
      await adminToggleActive(b.user_id, !b.is_active)
      toast.success(b.is_active ? 'Pembeli dinonaktifkan' : 'Pembeli diaktifkan')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan')
    }
  }

  async function remove(b: Buyer) {
    if (!confirm(`Hapus pembeli "${b.id}"? Semua datanya akan terhapus permanen.`)) return
    try {
      await adminDeleteUser(b.user_id)
      toast.success('Pembeli dihapus')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan')
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Panel Admin</h1>

      {/* Generate kode */}
      <div className="rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-2 text-sm font-semibold">Buat Kode Aktivasi</h2>
        <div className="flex gap-2">
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="w-24 rounded-lg border px-3 py-2"
            placeholder="Jumlah"
          />
          <button onClick={generate} disabled={loading} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {loading ? 'Membuat...' : 'Generate'}
          </button>
        </div>
        {generated.length > 0 && (
          <div className="mt-3 rounded-lg bg-gray-50 p-3">
            <p className="mb-1 text-xs text-gray-500">Kode baru (kasih ke pembeli):</p>
            {generated.map((c) => (
              <p key={c} className="font-mono text-sm font-semibold text-[#1B2A4A]">{c}</p>
            ))}
          </div>
        )}
      </div>

      {/* Daftar pembeli */}
      <div className="overflow-x-auto rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-3 text-sm font-semibold">Daftar Pembeli ({buyers.length})</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">ID</th>
              <th className="py-2">Nama Usaha</th>
              <th className="py-2">Status</th>
              <th className="py-2">Daftar</th>
              <th className="py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {buyers.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-gray-400">Belum ada pembeli</td></tr>
            )}
            {buyers.map((b) => (
              <tr key={b.user_id} className="border-b">
                <td className="py-2 font-medium">{b.id}</td>
                <td className="py-2">{b.nama_usaha ?? '-'}</td>
                <td className="py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {b.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="py-2">{b.created_at.slice(0, 10)}</td>
                <td className="py-2 whitespace-nowrap">
                  <button onClick={() => toggle(b)} className="mr-2 text-blue-600">
                    {b.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button onClick={() => remove(b)} className="text-red-600">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Daftar kode */}
      <div className="overflow-x-auto rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-3 text-sm font-semibold">Daftar Kode Aktivasi</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">Kode</th>
              <th className="py-2">Status</th>
              <th className="py-2">Dibuat</th>
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 && (
              <tr><td colSpan={3} className="py-4 text-center text-gray-400">Belum ada kode</td></tr>
            )}
            {codes.map((c) => (
              <tr key={c.code} className="border-b">
                <td className="py-2 font-mono font-medium">{c.code}</td>
                <td className="py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${c.is_used ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                    {c.is_used ? 'Terpakai' : 'Tersedia'}
                  </span>
                </td>
                <td className="py-2">{c.created_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
