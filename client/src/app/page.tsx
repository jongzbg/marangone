import { redirect } from 'next/navigation'

export default function RootPage() {
  // Root redirects to home for now; login would redirect to home if already authed
  redirect('/home')
}