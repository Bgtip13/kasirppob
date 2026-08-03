'use client'

import { useState } from 'react'

const BRANDS: Record<string, { bg: string; fg: string; text: string }> = {
  mandiri: { bg: '#003C8F', fg: '#ffffff', text: 'M' },
  bri: { bg: '#00529C', fg: '#ffffff', text: 'B' },
  seabank: { bg: '#FFD100', fg: '#003C8F', text: 'S' },
}

export default function BankLogo({ name, size = 36 }: { name: string; size?: number }) {
  const key = name.toLowerCase()
  const brand = BRANDS[key] ?? {
    bg: '#64748b',
    fg: '#ffffff',
    text: name.charAt(0).toUpperCase(),
  }
  const [error, setError] = useState(false)

  if (!error) {
    return (
      <img
        src={`/logos/${key}.png`}
        alt={name}
        width={size}
        height={size}
        onError={() => setError(true)}
        className="shrink-0 rounded-full object-contain"
      />
    )
  }

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        background: brand.bg,
        color: brand.fg,
        fontSize: size * 0.45,
      }}
    >
      {brand.text}
    </span>
  )
}
