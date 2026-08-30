export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export function formatDistanceToNow(date: string): string {
  return timeAgo(date)
}

/**
 * Format as "HH:MM · D เดือน พ.ศ." (e.g. "22:00 · 5 พ.ค. 2569")
 * Falls back to relative if no date is provided.
 */
export function formatAbsoluteTime(date: string | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  const hours = d.getHours().toString().padStart(2, '0')
  const minutes = d.getMinutes().toString().padStart(2, '0')
  const day = d.getDate()
  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const month = thaiMonths[d.getMonth()]
  const thaiYear = d.getFullYear() + 543
  return `${hours}:${minutes} · ${day} ${month} ${thaiYear}`
}
