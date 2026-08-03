'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { idToEmail } from '@/lib/auth'
import Logo from '@/components/logo'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [id, setId] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const email = idToEmail(id)
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pin })
      if (error) throw error
      localStorage.setItem('kasir_login_at', String(Date.now()))
      toast.success('Login berhasil')
      router.push('/')
      router.refresh()
    } catch (err) {
      toast.error('ID atau PIN salah')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1B2A4A] p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col items-center gap-1">
          <Logo size={64} rounded />
          <h1 className="mt-1 text-xl font-bold text-[#1B2A4A]">Aplikasi Kasir</h1>
          <p className="text-sm text-gray-500">by NB Projects</p>
        </div>
        <label className="block">
          <span className="text-sm text-gray-600">ID</span>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            placeholder="Masukkan ID"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-600">PIN</span>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            placeholder="Masukkan PIN"
          />
        </label>
        <button disabled={loading} className="w-full rounded-lg bg-[#1B2A4A] py-2 font-medium text-white disabled:opacity-50">
          {loading ? 'Masuk...' : 'Masuk'}
        </button>
      </form>
    </div>
  )
}
