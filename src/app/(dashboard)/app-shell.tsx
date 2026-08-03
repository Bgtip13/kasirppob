'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/logo'

const MENU = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/transaksi', label: 'Input Transaksi', icon: '💸' },
  { href: '/pengeluaran', label: 'Input Pengeluaran', icon: '📤' },
  { href: '/topup', label: 'Top Up Saldo', icon: '⬆️' },
  { href: '/laporan', label: 'Laporan Keuangan', icon: '📊' },
  { href: '/pengaturan', label: 'Pengaturan', icon: '⚙️' },
]

const ADMIN_MENU = { href: '/admin', label: 'Panel Admin', icon: '🛠️' }

const SESSION_MS = 60 * 60 * 1000 // 1 jam

export default function AppShell({
  children,
  userName,
  isAdmin = false,
}: {
  children: React.ReactNode
  userName: string
  isAdmin?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [now, setNow] = useState(new Date())

  const menu = isAdmin ? [...MENU, ADMIN_MENU] : MENU

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  async function forceLogout() {
    await supabase.auth.signOut()
    localStorage.removeItem('kasir_login_at')
    router.push('/login')
    router.refresh()
  }

  useEffect(() => {
    const loginAt = Number(localStorage.getItem('kasir_login_at') || 0)
    const elapsed = loginAt ? Date.now() - loginAt : SESSION_MS + 1
    if (elapsed >= SESSION_MS) {
      forceLogout()
      return
    }
    const t = setTimeout(forceLogout, SESSION_MS - elapsed)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hour = now.getHours()
  const greeting =
    hour >= 5 && hour < 11
      ? 'Selamat Pagi'
      : hour >= 11 && hour < 15
        ? 'Selamat Siang'
        : hour >= 15 && hour < 18
          ? 'Selamat Sore'
          : 'Selamat Malam'
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

  const linkClass = (href: string) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
      pathname === href ? 'bg-white text-[#1B2A4A]' : 'text-white hover:bg-white/10'
    }`

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar desktop */}
      <aside
        className={`hidden md:flex ${collapsed ? 'w-16' : 'w-60'} flex-col bg-gradient-to-b from-[#1B2A4A] to-[#22345C] transition-all`}
      >
        <div
          className={`flex h-16 items-center gap-3 border-b border-white/10 ${
            collapsed ? 'justify-center px-0' : 'px-4'
          }`}
        >
          <Logo size={36} rounded />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-base font-bold leading-tight text-white">Aplikasi Kasir</span>
              <span className="text-[10px] uppercase tracking-wider text-white/60">by NB Projects</span>
            </div>
          )}
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {menu.map((m) => (
            <Link key={m.href} href={m.href} title={m.label} className={linkClass(m.href)}>
              <span className="text-lg">{m.icon}</span>
              {!collapsed && <span>{m.label}</span>}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 p-2">
          <button onClick={forceLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white hover:bg-white/10">
            <span className="text-lg">🚪</span>
            {!collapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-gradient-to-b from-[#1B2A4A] to-[#22345C] shadow-lg">
            <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
              <Logo size={36} rounded />
              <div className="flex flex-col">
                <span className="text-base font-bold leading-tight text-white">Aplikasi Kasir</span>
                <span className="text-[10px] uppercase tracking-wider text-white/60">by NB Projects</span>
              </div>
            </div>
            <nav className="flex flex-col gap-1 p-2">
              {menu.map((m) => (
                <Link key={m.href} href={m.href} onClick={() => setMobileOpen(false)} className={linkClass(m.href)}>
                  <span className="text-lg">{m.icon}</span>
                  <span>{m.label}</span>
                </Link>
              ))}
            </nav>
            <div className="mt-auto border-t border-white/10 p-2">
              <button onClick={forceLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white hover:bg-white/10">
                <span className="text-lg">🚪</span>
                <span>Keluar</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Header + main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-2 bg-[#1B2A4A] px-3 text-white">
          <div className="flex items-center gap-1">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-white/10 md:hidden">
              ☰
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden rounded-lg p-2 hover:bg-white/10 md:block"
              title="Minimize sidebar"
            >
              {collapsed ? '»' : '«'}
            </button>
            <Logo size={22} rounded />
            <span className="ml-1 text-sm font-semibold">Aplikasi Kasir</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-medium leading-tight">{greeting}</p>
              <p className="text-[11px] leading-tight opacity-90">
                <span className="hidden sm:inline">{dateStr} · </span>
                {timeStr}
              </p>
            </div>
            <span className="hidden text-sm md:block">{userName}</span>
            <button
              onClick={forceLogout}
              className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/30 sm:text-sm"
            >
              Keluar
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-md flex-1 p-4">{children}</main>
      </div>
    </div>
  )
}
