'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  Send,
  AlertTriangle,
  Clock,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { Ticket } from '@/types/ticket'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_customer', label: 'Waiting Customer' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
] as const

const statusVariant = (s: string) => {
  switch (s) {
    case 'open': return 'destructive' as const
    case 'in_progress': return 'default' as const
    case 'waiting_customer': return 'secondary' as const
    case 'resolved': return 'secondary' as const
    case 'closed': return 'outline' as const
    default: return 'outline' as const
  }
}

const priorityVariant = (p: string) => {
  switch (p) {
    case 'urgent': return 'destructive' as const
    case 'high': return 'default' as const
    case 'medium': return 'secondary' as const
    default: return 'outline' as const
  }
}

export function AdminTicketDetail({ ticketId }: { ticketId: string }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}`)
      if (!res.ok) throw new Error('Failed to load ticket')
      const data = await res.json()
      setTicket(data.ticket)
    } catch {
      toast.error('Failed to load ticket')
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    if (session) fetchTicket()
  }, [session, fetchTicket])

  const handleSend = async () => {
    if (!message.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addMessage', message: message.trim(), isInternal }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to send')
      }
      const data = await res.json()
      setTicket(data.ticket)
      setMessage('')
      setIsInternal(false)
      toast.success(isInternal ? 'Internal note added' : 'Reply sent')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send reply')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    setStatusUpdating(true)
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateStatus', status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update status')
      }
      const data = await res.json()
      setTicket(data.ticket)
      toast.success('Status updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setStatusUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Ticket not found.{' '}
        <Link href="/admin/tickets" className="underline">Back to list</Link>
      </div>
    )
  }

  const slaBreached = ticket.sla?.breachedSla
  const userName = ticket.userId?.name || ticket.userId?.email || 'Unknown'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/tickets"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold truncate">{ticket.ticket?.title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            From <span className="text-foreground font-medium">{userName}</span>
            {' · '}
            {new Date(ticket.createdAt).toLocaleString('en-KE')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {slaBreached && (
            <Badge variant="destructive" className="gap-1 text-xs">
              <AlertTriangle className="h-3 w-3" />SLA Breached
            </Badge>
          )}
          <Badge variant={priorityVariant(ticket.ticket?.priority)}>{ticket.ticket?.priority}</Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Communication thread */}
        <div className="lg:col-span-2 space-y-4">
          {/* Original description */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-1">{userName} <span className="text-muted-foreground font-normal">· original message</span></p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.ticket?.description}</p>
            </CardContent>
          </Card>

          {/* Messages */}
          {ticket.communication?.map((msg, i) => {
            const isAdminMsg = msg.from?.role === 'system_admin'
            const sender = msg.from?.name || msg.from?.email || 'Unknown'
            return (
              <Card
                key={i}
                className={msg.isInternal
                  ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20'
                  : isAdminMsg
                  ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20'
                  : ''}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      {isAdminMsg && <Shield className="h-3.5 w-3.5 text-blue-600" />}
                      {sender}
                      {msg.isInternal && (
                        <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 dark:text-amber-400">
                          internal note
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.timestamp).toLocaleString('en-KE')}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.attachments.map((a, j) => (
                        <a
                          key={j}
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline text-blue-600"
                        >
                          {a.name}
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}

          {/* Reply form */}
          {ticket.status !== 'closed' && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Reply</p>
                  <button
                    type="button"
                    onClick={() => setIsInternal((v) => !v)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      isInternal
                        ? 'border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'border-border text-muted-foreground hover:border-amber-400 hover:text-amber-700'
                    }`}
                  >
                    {isInternal ? '🔒 Internal note' : 'Internal note?'}
                  </button>
                </div>
                <Textarea
                  placeholder={isInternal ? 'Add an internal note (not visible to user)…' : 'Type your reply…'}
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={isInternal ? 'border-amber-300 focus-visible:ring-amber-400' : ''}
                />
                <div className="flex justify-end">
                  <Button onClick={handleSend} disabled={submitting || !message.trim()} size="sm">
                    {submitting
                      ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      : <Send className="h-4 w-4 mr-1" />}
                    {isInternal ? 'Save note' : 'Send reply'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          {/* Status */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">Status</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <Badge variant={statusVariant(ticket.status)} className="capitalize">
                {ticket.status?.replace('_', ' ')}
              </Badge>
              {ticket.status !== 'closed' && (
                <Select
                  value={ticket.status}
                  onValueChange={handleStatusChange}
                  disabled={statusUpdating}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Ticket info */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span className="capitalize">{ticket.ticket?.category?.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="capitalize">{ticket.ticket?.type?.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority</span>
                <Badge variant={priorityVariant(ticket.ticket?.priority)} className="text-xs h-5">
                  {ticket.ticket?.priority}
                </Badge>
              </div>
              {ticket.routerId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Router</span>
                  <span className="truncate max-w-[120px]">
                    {(ticket.routerId as any)?.routerInfo?.name || 'Unknown'}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SLA */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />SLA
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Response</span>
                <span>{ticket.sla?.responseTime}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Resolution</span>
                <span>{ticket.sla?.resolutionTime}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">First response</span>
                <span>
                  {ticket.sla?.firstResponseAt
                    ? new Date(ticket.sla.firstResponseAt).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })
                    : <span className="text-amber-600">Pending</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Resolved</span>
                <span>
                  {ticket.sla?.resolvedAt
                    ? new Date(ticket.sla.resolvedAt).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })
                    : '—'}
                </span>
              </div>
              {slaBreached && (
                <Badge variant="destructive" className="w-full justify-center text-xs mt-1">
                  SLA Breached
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* User info */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">Submitted by</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-1 text-sm">
              <p className="font-medium">{ticket.userId?.name || '—'}</p>
              <p className="text-muted-foreground text-xs">{ticket.userId?.email}</p>
              <Link
                href={`/admin/users?search=${encodeURIComponent(ticket.userId?.email || '')}`}
                className="text-xs text-blue-600 underline"
              >
                View user
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
