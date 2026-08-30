/**
 * Normalizes an avatar URL so it always points to the correct backend.
 * - Absolute URLs → keep as-is
 * - Relative URLs (/uploads/...) → prepend API_BASE_URL (http://localhost:3001)
 * - Null/undefined → DiceBear fallback
 */
import { API_BASE_URL } from '@/lib/api'

export function getAvatarUrl(url: string | null | undefined, username: string): string {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    return url  // Keep absolute URLs (backend or external)
  }
  if (url && url.startsWith('/')) {
    return `${API_BASE_URL}${url}`  // Prepend backend URL for relative paths
  }
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`
}
