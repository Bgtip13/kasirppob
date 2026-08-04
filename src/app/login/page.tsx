'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { idToEmail } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [id, setId] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id.trim()) return toast.error('Masukkan ID')
    if (!pin) return toast.error('Masukkan PIN')
    setLoading(true)
    try {
      const email = idToEmail(id.trim())
      const { error } = await supabase.auth.signInWithPassword({ email, password: pin })
      if (error) throw error
      localStorage.setItem('kasir_login_at', String(Date.now()))
      toast.success('Berhasil masuk')
      router.push('/')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <div className="mb-6 flex flex-col items-center">
            <img src="/logos/app.png" alt="Logo" className="h-16 w-16 rounded-xl object-contain" />
            <h1 className="mt-3 text-lg font-bold text-gray-800">Aplikasi Kasir</h1>
            <p className="text-xs text-gray-500">by NB Projects</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="ID"
              autoCapitalize="none"
              className="w-full rounded-lg border px-3 py-2"
            />
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              inputMode="numeric"
              placeholder="PIN"
              className="w-full rounded-lg border px-3 py-2"
            />
            <button disabled={loading} className="w-full rounded-lg bg-sky-500 py-2 font-medium text-white disabled:opacity-50">
              {loading ? 'Masuk...' : 'Masuk'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-600">
            Belum punya akun?{' '}
            <button
              type="button"
              onClick={() => router.push('/register')}
              className="font-medium text-sky-600 underline"
            >
              Daftar di sini
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
