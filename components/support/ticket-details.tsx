"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Clock,
  MessageSquare,
  Paperclip,
  Send,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  Calendar,
  ArrowLeft,
  Loader2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import type { Ticket } from "@/types/ticket"

interface TicketDetailsProps {
  ticketId: string
}

export function TicketDetails({ ticketId }: TicketDetailsProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  // Fetch ticket details
  const fetchTicket = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch ticket')
      }

      const data = await response.json()
      
      // Handle both response formats
      if (data.ticket) {
        // Single ticket response format
        setTicket(data.ticket)
      } else if (data.tickets && data.tickets.length > 0) {
        // Array response format - take first ticket
        setTicket(data.tickets[0])
      } else {
        throw new Error('No ticket data found')
      }
    } catch (error) {
      console.error('Error fetching ticket:', error)
      toast.error('Failed to load ticket details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session && ticketId) {
      fetchTicket()
    }
  }, [session, ticketId])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive'
      case 'high':
        return 'default'
      case 'medium':
        return 'secondary'
      case 'low':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatTimestamp = (date: Date | string): string => {
    const d = new Date(date)
    return d.toLocaleString()
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    
    // Validate file size
    const maxSize = 5 * 1024 * 1024
    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        toast.error(`${file.name} exceeds 5MB limit`)
        return false
      }
      return true
    })

    if (selectedFiles.length + validFiles.length > 5) {
      toast.error('Maximum 5 attachments allowed')
      return
    }

    setSelectedFiles(prev => [...prev, ...validFiles])
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() && selectedFiles.length === 0) {
      toast.error('Please enter a message or attach a file')
      return
    }

    setIsSubmitting(true)

    try {
      // Create FormData for file upload
      const formData = new FormData()
      formData.append('action', 'addMessage')
      formData.append('message', newMessage)

      // Append attachments
      selectedFiles.forEach((file) => {
        formData.append('attachments', file)
      })

      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      toast.success('Message sent successfully')
      setNewMessage('')
      setSelectedFiles([])
      
      // Refresh ticket data
      await fetchTicket()
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateStatus',
          status: newStatus,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      toast.success(`Ticket status updated to ${newStatus}`)
      await fetchTicket()
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    }
  }

  const handleCloseTicket = async () => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateStatus',
          status: 'closed',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to close ticket')
      }

      toast.success('Ticket closed successfully')
      await fetchTicket()
    } catch (error) {
      console.error('Error closing ticket:', error)
      toast.error('Failed to close ticket')
    }
  }

  const handleReopenTicket = async () => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'reopen',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to reopen ticket')
      }

      toast.success('Ticket reopened successfully')
      await fetchTicket()
    } catch (error) {
      console.error('Error reopening ticket:', error)
      toast.error('Failed to reopen ticket')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-10 w-10" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-96" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Ticket not found</p>
            <Button onClick={() => router.push('/support/tickets')}>Go Back</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold">{ticket.ticket.title}</h2>
            <Badge variant="outline" className="font-mono">
              #{ticket._id.substring(0, 8)}
            </Badge>
            <Badge variant={getPriorityColor(ticket.ticket.priority)} className="capitalize">
              {ticket.ticket.priority}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Created {formatTimestamp(ticket.createdAt)} • Updated{" "}
            {formatTimestamp(ticket.updatedAt)}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(ticket.status === 'resolved' || ticket.status === 'closed') && (
              <DropdownMenuItem onClick={handleReopenTicket}>
                Reopen Ticket
              </DropdownMenuItem>
            )}
            {ticket.status !== 'closed' && (
              <>
                <DropdownMenuItem>Request Callback</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleCloseTicket}>
                  Close Ticket
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Ticket Details */}
          <Card>
            <CardHeader>
              <CardTitle>Ticket Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="text-sm whitespace-pre-wrap">{ticket.ticket.description}</p>
              </div>

              {ticket.routerId && typeof ticket.routerId === 'object' && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Related Router</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {ticket.routerId.routerInfo?.name || 'Router'}
                    </Badge>
                    {ticket.routerId.health?.status && (
                      <Badge 
                        variant={ticket.routerId.health.status === 'online' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {ticket.routerId.health.status}
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" className="h-auto p-0 text-xs" asChild>
                      <a href={`/routers/${ticket.routerId._id}`}>
                        View Router
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversation ({ticket.communication.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {ticket.communication.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No messages yet
                </p>
              ) : (
                ticket.communication.map((message, index) => (
                  <div key={index}>
                    <div
                      className={`flex gap-3 ${
                        message.from?._id === session?.user?.id ? "flex-row-reverse" : ""
                      }`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={message.from?.image || undefined} />
                        <AvatarFallback>
                          {message.from?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{message.from?.name ?? 'User'}</span>
                          {message.from?.role === 'system_admin' && (
                            <Badge variant="secondary" className="text-xs">
                              Support
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(message.timestamp)}
                          </span>
                        </div>

                        <div
                          className={`rounded-lg p-3 text-sm ${
                            message.from._id === session?.user?.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{message.message}</p>
                        </div>

                        {message.attachments && message.attachments.length > 0 && (
                          <div className="space-y-2">
                            {message.attachments.map((attachment) => (
                              <div
                                key={attachment.id}
                                className="flex items-center gap-2 rounded-lg border bg-background p-2"
                              >
                                <Paperclip className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {attachment.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatFileSize(attachment.size)}
                                  </p>
                                </div>
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={attachment.url} download target="_blank" rel="noopener noreferrer">
                                    Download
                                  </a>
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Reply Form - Only show if not closed */}
          {ticket.status !== 'closed' && (
            <Card>
              <CardHeader>
                <CardTitle>Reply to Ticket</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Type your message here..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={4}
                  disabled={isSubmitting}
                />

                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Attachments</p>
                    <div className="space-y-2">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 rounded-lg border bg-background p-2"
                        >
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveFile(index)}
                            disabled={isSubmitting}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.txt,.log"
                      onChange={handleFileSelect}
                      disabled={isSubmitting || selectedFiles.length >= 5}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('file-upload')?.click()}
                      disabled={isSubmitting || selectedFiles.length >= 5}
                    >
                      <Paperclip className="h-4 w-4 mr-2" />
                      Attach Files ({selectedFiles.length}/5)
                    </Button>
                  </div>

                  <Button onClick={handleSendMessage} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Reply
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                defaultValue={ticket.status}
                onValueChange={handleStatusChange}
                disabled={ticket.status === 'closed'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="waiting_customer">Waiting Customer</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Ticket Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ticket Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Category</span>
                <Badge variant="outline" className="capitalize">
                  {ticket.ticket.category.replace('_', ' ')}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Type</span>
                <Badge variant="outline" className="capitalize">
                  {ticket.ticket.type.replace('_', ' ')}
                </Badge>
              </div>

              {ticket.assignment && (
                <div className="space-y-2 border-t pt-4">
                  <span className="text-sm text-muted-foreground">Assigned To</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={ticket.assignment?.assignedTo?.image || undefined} />
                      <AvatarFallback>
                        {ticket.assignment?.assignedTo?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">
                      {ticket.assignment?.assignedTo?.name ?? 'Unassigned'}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-xs capitalize">
                    {ticket.assignment?.department ?? 'support'}
                  </Badge>
                </div>
              )}

              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Created</span>
                </div>
                <p className="text-sm">{formatTimestamp(ticket.createdAt)}</p>
              </div>

              {ticket.sla.firstResponseAt && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">First Response</span>
                  </div>
                  <p className="text-sm">{formatTimestamp(ticket.sla.firstResponseAt)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SLA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Service Level Agreement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Response Time</span>
                <span className="font-medium">{ticket.sla.responseTime} hours</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Resolution Time</span>
                <span className="font-medium">{ticket.sla.resolutionTime} hours</span>
              </div>
              {ticket.sla.breachedSla ? (
                <Badge variant="destructive" className="w-full justify-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  SLA Breached
                </Badge>
              ) : ticket.sla.firstResponseAt ? (
                <Badge variant="outline" className="w-full justify-center">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  SLA Met
                </Badge>
              ) : (
                <Badge variant="secondary" className="w-full justify-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending Response
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}