'use client'

import { useState } from 'react'

export default function Logo({ size = 40, rounded = false }: { size?: number; rounded?: boolean }) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#1B2A4A] font-bold text-white"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        AK
      </span>
    )
  }

  return (
    <img
      src="/logos/app.png"
      alt="Aplikasi Kasir"
      width={size}
      height={size}
      onError={() => setError(true)}
      className={`shrink-0 object-contain ${rounded ? 'rounded-full' : 'rounded-lg'}`}
    />
  )
}
