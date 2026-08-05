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

function Section({ open, title, onToggle, children }: { open: boolean; title: string; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white shadow">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        <span className={`text-lg font-bold text-sky-500 transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && <div className="space-y-3 border-t px-4 py-4">{children}</div>}
    </div>
  )
}

export default function PengaturanPage() {
  const supabase = createClient()
  const [open, setOpen] = useState<'pin' | 'kelola' | 'tambah' | null>(null)

  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  const [accounts, setAccounts] = useState<Account[]>([])
  const [feeInputs, setFeeInputs] = useState<Record<string, string>>({})

  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'bank' | 'cash'>('bank')
  const [newBalance, setNewBalance] = useState('')

  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [editAccName, setEditAccName] = useState('')
  const [editAccBalance, setEditAccBalance] = useState('')

  const [loading, setLoading] = useState(false)

  async function load() {
    const { data, error } = await supabase.from('accounts').select('*').order('name')
    if (error) return toast.error(error.message)
    setAccounts((data ?? []) as Account[])
    const map: Record<string, string> = {}
    ;(data ?? []).forEach((a: Account) => (map[a.id] = String(a.default_fee_percent)))
    setFeeInputs(map)
  }

  useEffect(() => { load() }, [])

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
      setOldPin(''); setNewPin(''); setConfirmPin('')
    } catch (err) { toast.error((err as any)?.message || 'Terjadi kesalahan') }
    finally { setLoading(false) }
  }

  async function saveFee(id: string) {
    const n = Number(feeInputs[id])
    if (isNaN(n) || n < 0) return toast.error('Fee tidak valid')
    const { error } = await supabase.from('accounts').update({ default_fee_percent: n }).eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Fee default diperbarui'); load()
  }

  async function toggleActive(a: Account) {
    await supabase.from('accounts').update({ is_active: !a.is_active }).eq('id', a.id)
    load()
  }

  function openEditAccount(a: Account) {
    setEditingAccount(a); setEditAccName(a.name); setEditAccBalance(String(a.balance))
  }

  async function saveAccount() {
    if (!editingAccount) return
    if (!editAccName.trim()) return toast.error('Nama rekening wajib diisi')
    setLoading(true)
    try {
      const { error } = await supabase.from('accounts')
        .update({ name: editAccName.trim(), balance: Number(editAccBalance || 0) })
        .eq('id', editingAccount.id)
      if (error) throw error
      toast.success('Rekening diperbarui'); setEditingAccount(null); load()
    } catch (err) { toast.error((err as any)?.message || 'Terjadi kesalahan') }
    finally { setLoading(false) }
  }

  async function addAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return toast.error('Nama rekening wajib diisi')
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sesi tidak ditemukan')
      const { error } = await supabase.from('accounts').insert({
        user_id: user.id, name: newName.trim(), type: newType, balance: Number(newBalance || 0),
      })
      if (error) throw error
      toast.success('Rekening ditambahkan')
      setNewName(''); setNewType('bank'); setNewBalance(''); setOpen(null); load()
    } catch (err) { toast.error((err as any)?.message || 'Terjadi kesalahan') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      <Section open={open === 'pin'} title="🔒 Ubah PIN Login"
        onToggle={() => setOpen(open === 'pin' ? null : 'pin')}>
        <form onSubmit={changePin} className="space-y-2">
          <input type="password" inputMode="numeric" placeholder="PIN lama"
            value={oldPin} onChange={(e) => setOldPin(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          <input type="password" inputMode="numeric" placeholder="PIN baru (min 6 digit)"
            value={newPin} onChange={(e) => setNewPin(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          <input type="password" inputMode="numeric" placeholder="Ulangi PIN baru"
            value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          <button disabled={loading} className="w-full rounded-lg bg-sky-500 py-2 font-medium text-white disabled:opacity-50">
            {loading ? 'Menyimpan...' : 'Ubah PIN'}
          </button>
        </form>
      </Section>

      <Section open={open === 'kelola'} title="🏦 Kelola Rekening"
        onToggle={() => setOpen(open === 'kelola' ? null : 'kelola')}>
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="rounded-xl border p-3">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{a.name} {!a.is_active && <span className="text-xs text-gray-400">(nonaktif)</span>}</p>
                  <p className="text-xs text-gray-500">{a.type === 'cash' ? 'Tunai' : 'Bank'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEditAccount(a)} className="text-blue-600">Edit</button>
                  <button onClick={() => toggleActive(a)} className={a.is_active ? 'text-red-600' : 'text-green-600'}>
                    {a.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-end gap-2">
                <input value={feeInputs[a.id] ?? ''} onChange={(e) => setFeeInputs({ ...feeInputs, [a.id]: e.target.value })}
                  inputMode="numeric" placeholder="Fee %" className="w-24 rounded-lg border px-2 py-1 text-sm" />
                <button onClick={() => saveFee(a.id)} className="rounded-lg bg-gray-800 px-3 py-1 text-xs text-white">Simpan Fee</button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section open={open === 'tambah'} title="➕ Tambah Rekening"
        onToggle={() => setOpen(open === 'tambah' ? null : 'tambah')}>
        <form onSubmit={addAccount} className="space-y-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nama rekening (mis. BCA, DANA)"
            className="w-full rounded-lg border px-3 py-2" />
          <select value={newType} onChange={(e) => setNewType(e.target.value as 'bank' | 'cash')}
            className="w-full rounded-lg border px-3 py-2">
            <option value="bank">Bank / E-Wallet</option>
            <option value="cash">Tunai / Cash</option>
          </select>
          <input value={newBalance} onChange={(e) => setNewBalance(e.target.value)} inputMode="numeric" placeholder="Saldo awal"
            className="w-full rounded-lg border px-3 py-2" />
          <button disabled={loading} className="w-full rounded-lg bg-sky-500 py-2 font-medium text-white disabled:opacity-50">
            {loading ? 'Menyimpan...' : 'Simpan Rekening'}
          </button>
        </form>
      </Section>

      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md space-y-2 rounded-2xl bg-white p-4">
            <h3 className="text-sm font-semibold">Edit Rekening</h3>
            <input value={editAccName} onChange={(e) => setEditAccName(e.target.value)} placeholder="Nama rekening"
              className="w-full rounded-lg border px-3 py-2" />
            <input value={editAccBalance} onChange={(e) => setEditAccBalance(e.target.value)} inputMode="numeric" placeholder="Saldo"
              className="w-full rounded-lg border px-3 py-2" />
            <div className="flex gap-2">
              <button onClick={saveAccount} disabled={loading} className="flex-1 rounded-lg bg-sky-500 py-2 font-medium text-white disabled:opacity-50">
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button onClick={() => setEditingAccount(null)} className="flex-1 rounded-lg bg-gray-200 py-2">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
