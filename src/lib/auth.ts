export function idToEmail(id: string): string {
  const clean = id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
  if (!clean) throw new Error('ID tidak valid')
  return `${clean}@merchant.local`
}
