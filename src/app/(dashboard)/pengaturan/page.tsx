'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

type Account = {
  id: string
  name: string
  type: string
  balance: number
  default_fee_percent: number
  is_active: boolean
}

export default function PengaturanPage() {
  const supabase = createClient()

  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  const [accounts, setAccounts] = useState<Account[]>([])
  const [feeInputs, setFeeInputs] = useState<Record<string, string>>({})

  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'bank' | 'cash'>('bank')
  const [newBalance, setNewBalance] = useState('')

  const [loading, setLoading] = useState(false)

  async function load() {
    const { data, error } = await supabase.from('accounts').select('*').order('name')
    if (error) return
    setAccounts((data ?? []) as Account[])
    const map: Record<string, string> = {}
    ;(data ?? []).forEach((a: Account) => (map[a.id] = String(a.default_fee_percent)))
    setFeeInputs(map)
  }

  useEffect(() => {
    load()
  }, [])

  async function changePin(e: React.FormEvent) {
    e.preventDefault()
    if (newPin.length < 6) return toast.error('PIN baru minimal 6 digit')
    if (newPin !== confirmPin) return toast.error('PIN baru tidak cocok')
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) throw new Error('Sesi tidak ditemukan')
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: oldPin })
      if (verifyError) throw new Error('PIN lama salah')
      const { error } = await supabase.auth.updateUser({ password: newPin })
      if (error) throw error
      toast.success('PIN berhasil diubah')
      setOldPin('')
      setNewPin('')
      setConfirmPin('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  async function saveFee(id: string) {
    const n = Number(feeInputs[id])
    if (isNaN(n) || n < 0) return toast.error('Fee tidak valid')
    const { error } = await supabase.from('accounts').update({ default_fee_percent: n }).eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Fee default diperbarui')
    load()
  }

  async function toggleActive(a: Account) {
    await supabase.from('accounts').update({ is_active: !a.is_active }).eq('id', a.id)
    load()
  }

  async function addAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return toast.error('Nama rekening wajib diisi')
    setLoading(true)
    try {
      const { error } = await supabase.rpc('add_account', {
        p_name: newName.trim(),
        p_type: newType,
        p_initial_balance: Number(newBalance || 0),
      })
      if (error) throw error
      toast.success('Rekening ditambahkan')
      setNewName('')
      setNewBalance('')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Pengaturan</h1>

      <form onSubmit={changePin} className="space-y-3 rounded-2xl bg-white p-4 shadow">
        <h2 className="text-sm font-semibold">Ubah PIN Login</h2>
        <input
          type="password"
          inputMode="numeric"
          placeholder="PIN lama"
          value={oldPin}
          onChange={(e) => setOldPin(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
        />
        <input
          type="password"
          inputMode="numeric"
          placeholder="PIN baru (min 6 digit)"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
        />
        <input
          type="password"
          inputMode="numeric"
          placeholder="Ulangi PIN baru"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
        />
        <button disabled={loading} className="w-full rounded-lg bg-sky-500 py-2 font-medium text-white disabled:opacity-50">
          {loading ? 'Menyimpan...' : 'Ubah PIN'}
        </button>
      </form>

      <div className="space-y-3 rounded-2xl bg-white p-4 shadow">
        <h2 className="text-sm font-semibold">Kelola Rekening & Fee Default</h2>
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center gap-2 border-b pb-2">
            <div className="flex-1">
              <p className="text-sm font-medium">{a.name}</p>
              <p className="text-xs text-gray-500">
                {a.type === 'cash' ? 'Tunai' : 'Bank'} · {a.is_active ? 'Aktif' : 'Nonaktif'}
              </p>
            </div>
            <input
              type="number"
              value={feeInputs[a.id] ?? ''}
              onChange={(e) => setFeeInputs({ ...feeInputs, [a.id]: e.target.value })}
              className="w-20 rounded-lg border px-2 py-1 text-sm"
              title="Fee default (%)"
            />
            <button onClick={() => saveFee(a.id)} className="rounded-lg bg-gray-100 px-2 py-1 text-sm">
              Simpan %
            </button>
            <button onClick={() => toggleActive(a)} className="rounded-lg bg-gray-100 px-2 py-1 text-sm">
              {a.is_active ? 'Nonaktif' : 'Aktif'}
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={addAccount} className="space-y-3 rounded-2xl bg-white p-4 shadow">
        <h2 className="text-sm font-semibold">Tambah Rekening</h2>
        <input
          placeholder="Nama rekening (mis. BCA)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
        />
        <select value={newType} onChange={(e) => setNewType(e.target.value as 'bank' | 'cash')} className="w-full rounded-lg border px-3 py-2">
          <option value="bank">Bank</option>
          <option value="cash">Tunai</option>
        </select>
        <input
          type="number"
          inputMode="numeric"
          placeholder="Saldo awal"
          value={newBalance}
          onChange={(e) => setNewBalance(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
        />
        <button disabled={loading} className="w-full rounded-lg bg-sky-500 py-2 font-medium text-white disabled:opacity-50">
          {loading ? 'Menyimpan...' : 'Tambah Rekening'}
        </button>
      </form>
    </div>
  )
}
