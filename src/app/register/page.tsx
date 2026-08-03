'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { idToEmail } from '@/lib/auth'
import { registerBuyer } from '@/app/actions/register'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [id, setId] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [namaUsaha, setNamaUsaha] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length < 6) return toast.error('PIN minimal 6 digit')
    if (pin !== confirm) return toast.error('PIN tidak cocok')
    if (!code.trim()) return toast.error('Kode aktivasi wajib diisi')
    setLoading(true)
    try {
      await registerBuyer(id, pin, code, namaUsaha)
      const email = idToEmail(id)
      const { error } = await supabase.auth.signInWithPassword({ email, password: pin })
      if (error) throw error
      localStorage.setItem('kasir_login_at', String(Date.now()))
      toast.success('Akun berhasil dibuat')
      router.push('/onboarding')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1B2A4A] p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <h1 className="text-xl font-bold text-[#1B2A4A]">Buat Akun — Aplikasi Kasir</h1>
        <label className="block">
          <span className="text-sm text-gray-600">Kode Aktivasi</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Masukkan kode dari penjual" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">Nama Usaha (opsional)</span>
          <input value={namaUsaha} onChange={(e) => setNamaUsaha(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="mis. Toko Sumber Rejeki" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">ID</span>
          <input value={id} onChange={(e) => setId(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">PIN (min 6 digit)</span>
          <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">Ulangi PIN</span>
          <input type="password" inputMode="numeric" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <button disabled={loading} className="w-full rounded-lg bg-[#1B2A4A] py-2 font-medium text-white disabled:opacity-50">
          {loading ? 'Membuat...' : 'Buat Akun'}
        </button>
      </form>
    </div>
  )
}
