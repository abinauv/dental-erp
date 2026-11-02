import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth'

export default async function RootPage() {
  const session = await getServerSession()

  if (session?.user) {
    redirect('/dashboard')
  }

  redirect('/login')
}
