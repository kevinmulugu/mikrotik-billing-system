import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AdminTicketDetail } from './AdminTicketDetail'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Ticket Detail — Admin' }

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'system_admin') redirect('/dashboard')

  const { id } = await params
  return <AdminTicketDetail ticketId={id} />
}
