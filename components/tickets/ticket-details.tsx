"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge, BadgeProps } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  MessageSquare,
  Paperclip,
  Send,
  User,
  X,
  XCircle,
} from "lucide-react"

// Validation schema for reply
const replySchema = z.object({
  message: z.string().min(10, "Message must be at least 10 characters").max(2000, "Message too long"),
})

type ReplyForm = z.infer<typeof replySchema>

// Types
interface TicketMessage {
  _id: string
  from: string
  fromName: string
  message: string
  attachments: string[]
  isInternal: boolean
  timestamp: Date
}

interface Ticket {
  _id: string
  customerId: string
  userId: string
  routerId?: string
  ticket: {
    title: string
    description: string
    category: string
    priority: string
    type: string
  }
  assignment?: {
    assignedTo: string
    assignedToName: string
    assignedAt: Date
    department: string
  }
  sla: {
    responseTime: number
    resolutionTime: number
    firstResponseAt?: Date
    resolvedAt?: Date
    breachedSla: boolean
  }
  communication: TicketMessage[]
  resolution?: {
    solution: string
    resolvedBy: string
    resolvedByName: string
    customerSatisfaction?: number
    feedback?: string
  }
  status: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed"
  createdAt: Date
  updatedAt: Date
}

interface TicketDetailsProps {
  ticketId: string
  onTicketUpdated?: () => void
  onTicketClosed?: () => void
}

// Status badge variant mapping
const getStatusVariant = (status: string): BadgeProps["variant"] => {
  switch (status) {
    case "open":
      return "default"
    case "in_progress":
      return "secondary"
    case "waiting_customer":
      return "outline"
    case "resolved":
      return "default"
    case "closed":
      return "secondary"
    default:
      return "outline"
  }
}

// Priority badge variant mapping
const getPriorityVariant = (priority: string): BadgeProps["variant"] => {
  switch (priority) {
    case "urgent":
      return "destructive"
    case "high":
      return "destructive"
    case "medium":
      return "outline"
    case "low":
      return "secondary"
    default:
      return "outline"
  }
}

// Get status icon
const getStatusIcon = (status: string) => {
  switch (status) {
    case "open":
      return <AlertCircle className="h-4 w-4" />
    case "in_progress":
      return <Clock className="h-4 w-4" />
    case "waiting_customer":
      return <MessageSquare className="h-4 w-4" />
    case "resolved":
      return <CheckCircle className="h-4 w-4" />
    case "closed":
      return <XCircle className="h-4 w-4" />
    default:
      return <FileText className="h-4 w-4" />
  }
}

export function TicketDetails({ ticketId, onTicketUpdated, onTicketClosed }: TicketDetailsProps) {
  const { data: session } = useSession()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const form = useForm<ReplyForm>({
    resolver: zodResolver(replySchema),
    defaultValues: {
      message: "",
    },
  })

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
      setTicket(data.ticket)
    } catch (error) {
      console.error('Error fetching ticket:', error)
      toast.error('Failed to load ticket details')
    } finally {
      setLoading(false)
    }
  }

  // Send reply
  const onSubmit = async (data: ReplyForm) => {
    try {
      setSending(true)
      const response = await fetch(`/api/support/tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.user?.id}`,
        },
        body: JSON.stringify({
          message: data.message,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send reply')
      }

      toast.success('Reply sent successfully')
      form.reset()
      fetchTicket()
      onTicketUpdated?.()
    } catch (error) {
      console.error('Error sending reply:', error)
      toast.error('Failed to send reply')
    } finally {
      setSending(false)
    }
  }

  // Close ticket
  const closeTicket = async () => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to close ticket')
      }

      toast.success('Ticket closed successfully')
      fetchTicket()
      onTicketClosed?.()
    } catch (error) {
      console.error('Error closing ticket:', error)
      toast.error('Failed to close ticket')
    }
  }

  // Reopen ticket
  const reopenTicket = async () => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/reopen`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to reopen ticket')
      }

      toast.success('Ticket reopened successfully')
      fetchTicket()
      onTicketUpdated?.()
    } catch (error) {
      console.error('Error reopening ticket:', error)
      toast.error('Failed to reopen ticket')
    }
  }

  // Calculate time since creation
  const getTimeSince = (date: Date): string => {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    return 'Just now'
  }

  // Get user initials for avatar
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  useEffect(() => {
    if (session && ticketId) {
      fetchTicket()
    }
  }, [session, ticketId])

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!ticket) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Ticket not found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Ticket Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl">{ticket.ticket.title}</CardTitle>
                <Badge variant={getStatusVariant(ticket.status)}>
                  {getStatusIcon(ticket.status)}
                  <span className="ml-1">{ticket.status.replace('_', ' ')}</span>
                </Badge>
              </div>
              <CardDescription>
                Ticket #{ticket._id.substring(0, 8)} • Created {getTimeSince(ticket.createdAt)}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {(ticket.status === "resolved" || ticket.status === "closed") ? (
                <Button variant="outline" onClick={reopenTicket}>
                  Reopen Ticket
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline">
                      <X className="h-4 w-4 mr-2" />
                      Close Ticket
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Close Ticket</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to close this ticket? You can reopen it later if needed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={closeTicket}>
                        Close Ticket
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Ticket Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Category</div>
              <div className="font-medium capitalize">{ticket.ticket.category}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Priority</div>
              <Badge variant={getPriorityVariant(ticket.ticket.priority)}>
                {ticket.ticket.priority}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Type</div>
              <div className="font-medium capitalize">{ticket.ticket.type.replace('_', ' ')}</div>
            </div>
            {ticket.assignment && (
              <div>
                <div className="text-sm text-muted-foreground">Assigned To</div>
                <div className="font-medium">{ticket.assignment.assignedToName}</div>
              </div>
            )}
          </div>

          <Separator />

          {/* Original Description */}
          <div>
            <h4 className="font-medium mb-2">Description</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {ticket.ticket.description}
            </p>
          </div>

          {/* SLA Information */}
          {ticket.sla.breachedSla && (
            <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
              <div className="flex items-center text-red-800">
                <AlertCircle className="h-4 w-4 mr-2" />
                <span className="font-medium">SLA Breached</span>
              </div>
              <p className="text-sm text-red-700 mt-1">
                This ticket has exceeded the expected response or resolution time.
              </p>
            </div>
          )}

          {/* Resolution Information */}
          {ticket.resolution && (
            <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
              <div className="space-y-2">
                <div className="flex items-center text-green-800">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  <span className="font-medium">Resolution</span>
                </div>
                <p className="text-sm text-green-900">{ticket.resolution.solution}</p>
                <div className="text-sm text-green-700">
                  Resolved by {ticket.resolution.resolvedByName} on{' '}
                  {ticket.sla.resolvedAt && new Date(ticket.sla.resolvedAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Communication Thread */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            Communication Thread
          </CardTitle>
          <CardDescription>
            {ticket.communication.length} message{ticket.communication.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Messages */}
          <div className="space-y-4">
            {ticket.communication.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No messages yet. Start the conversation below.
              </div>
            ) : (
              ticket.communication.map((message) => (
                <div
                  key={message._id}
                  className={`flex gap-3 ${
                    message.from === session?.user?.id ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarFallback>{getInitials(message.fromName)}</AvatarFallback>
                  </Avatar>

                  <div
                    className={`flex-1 space-y-1 ${
                      message.from === session?.user?.id ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{message.fromName}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.timestamp).toLocaleString()}
                      </span>
                      {message.isInternal && (
                        <Badge variant="outline" className="text-xs">
                          Internal
                        </Badge>
                      )}
                    </div>

                    <div
                      className={`p-3 rounded-lg ${
                        message.from === session?.user?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.message}</p>

                      {/* Attachments */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {message.attachments.map((attachment, index) => (
                            <a
                              key={index}
                              href={attachment}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs hover:underline"
                            >
                              <Paperclip className="h-3 w-3" />
                              Attachment {index + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Reply Form */}
          {ticket.status !== "closed" && (
            <>
              <Separator />
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Reply</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Type your message here..."
                            className="resize-none min-h-[120px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => form.reset()}
                      disabled={sending}
                    >
                      Clear
                    </Button>
                    <Button type="submit" disabled={sending}>
                      {sending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
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
                </form>
              </Form>
            </>
          )}

          {ticket.status === "closed" && (
            <div className="text-center py-4 text-muted-foreground">
              This ticket is closed. Reopen it to continue the conversation.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ticket Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Ticket Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4 p-3 border-l-4 border-blue-500 bg-blue-50">
              <div className="flex-1">
                <p className="font-medium">Ticket Created</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(ticket.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {ticket.sla.firstResponseAt && (
              <div className="flex items-center space-x-4 p-3 border-l-4 border-green-500 bg-green-50">
                <div className="flex-1">
                  <p className="font-medium">First Response</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(ticket.sla.firstResponseAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {ticket.assignment && (
              <div className="flex items-center space-x-4 p-3 border-l-4 border-purple-500 bg-purple-50">
                <div className="flex-1">
                  <p className="font-medium">Assigned to {ticket.assignment.assignedToName}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(ticket.assignment.assignedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {ticket.sla.resolvedAt && (
              <div className="flex items-center space-x-4 p-3 border-l-4 border-green-500 bg-green-50">
                <div className="flex-1">
                  <p className="font-medium">Ticket Resolved</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(ticket.sla.resolvedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {ticket.status === "closed" && (
              <div className="flex items-center space-x-4 p-3 border-l-4 border-gray-500 bg-gray-50">
                <div className="flex-1">
                  <p className="font-medium">Ticket Closed</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(ticket.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}