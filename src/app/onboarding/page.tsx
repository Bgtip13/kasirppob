'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

const fields = [
  { key: 'p_cash', label: 'Uang Tunai' },
  { key: 'p_mandiri', label: 'Mandiri' },
  { key: 'p_bri', label: 'BRI' },
  { key: 'p_seabank', label: 'SeaBank' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.rpc('setup_accounts', {
        p_cash: Number(values.p_cash || 0),
        p_mandiri: Number(values.p_mandiri || 0),
        p_bri: Number(values.p_bri || 0),
        p_seabank: Number(values.p_seabank || 0),
      })
      if (error) throw error
      toast.success('Saldo awal disimpan')
      router.push('/')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1B2A4A] p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <h1 className="text-xl font-bold text-[#1B2A4A]">Saldo Awal</h1>
        <p className="text-sm text-gray-500">Isi saldo masing-masing akun saat ini.</p>
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="text-sm text-gray-600">{f.label}</span>
            <input
              type="number"
              inputMode="numeric"
              value={values[f.key] ?? ''}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="0"
            />
          </label>
        ))}
        <button disabled={loading} className="w-full rounded-lg bg-[#1B2A4A] py-2 font-medium text-white disabled:opacity-50">
          {loading ? 'Menyimpan...' : 'Simpan'}
        </button>
      </form>
    </div>
  )
}
