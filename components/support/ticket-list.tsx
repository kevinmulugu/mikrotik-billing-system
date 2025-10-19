"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge, BadgeProps } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  XCircle,
} from "lucide-react"
import { debounce } from "@/lib/utils"

// Types
interface TicketItem {
  _id: string
  ticket: {
    title: string
    description: string
    category: string
    priority: string
    type: string
  }
  status: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed"
  assignment?: {
    assignedToName: string
    department: string
  }
  sla: {
    breachedSla: boolean
    firstResponseAt?: Date
  }
  communication: any[]
  createdAt: Date
  updatedAt: Date
}

interface TicketListProps {
  routerId?: string
}

interface FilterOptions {
  status: string
  priority: string
  category: string
  search: string
}

interface TicketStats {
  total: number
  open: number
  inProgress: number
  resolved: number
  breachedSla: number
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
      return <AlertCircle className="h-3 w-3" />
    case "in_progress":
      return <Clock className="h-3 w-3" />
    case "waiting_customer":
      return <MessageSquare className="h-3 w-3" />
    case "resolved":
      return <CheckCircle className="h-3 w-3" />
    case "closed":
      return <XCircle className="h-3 w-3" />
    default:
      return <Ticket className="h-3 w-3" />
  }
}

export function TicketList({ routerId }: TicketListProps) {
  const { data: session } = useSession()
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [filteredTickets, setFilteredTickets] = useState<TicketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterOptions>({
    status: "all",
    priority: "all",
    category: "all",
    search: ""
  })

  // Statistics
  const [stats, setStats] = useState<TicketStats>({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    breachedSla: 0
  })

  // Fetch tickets
  const fetchTickets = async () => {
    try {
      setLoading(true)
      const url = routerId 
        ? `/api/support/tickets?routerId=${routerId}`
        : `/api/support/tickets`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch tickets')
      }

      const data = await response.json()
      setTickets(data.tickets || [])
      setStats(data.stats || stats)
    } catch (error) {
      console.error('Error fetching tickets:', error)
      toast.error('Failed to load support tickets')
    } finally {
      setLoading(false)
    }
  }

  // Filter tickets
  const filterTickets = () => {
    let filtered = [...tickets]

    // Status filter
    if (filters.status !== "all") {
      filtered = filtered.filter(t => t.status === filters.status)
    }

    // Priority filter
    if (filters.priority !== "all") {
      filtered = filtered.filter(t => t.ticket.priority === filters.priority)
    }

    // Category filter
    if (filters.category !== "all") {
      filtered = filtered.filter(t => t.ticket.category === filters.category)
    }

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      filtered = filtered.filter(t => 
        t.ticket.title.toLowerCase().includes(searchTerm) ||
        t.ticket.description.toLowerCase().includes(searchTerm) ||
        t._id.toLowerCase().includes(searchTerm)
      )
    }

    setFilteredTickets(filtered)
  }

  // Debounced search
  const debouncedSearch = debounce((searchTerm: string) => {
    setFilters(prev => ({ ...prev, search: searchTerm }))
  }, 300)

  // Get time since
  const getTimeSince = (date: Date): string => {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  // Effects
  useEffect(() => {
    if (session) {
      fetchTickets()
    }
  }, [session, routerId])

  useEffect(() => {
    filterTickets()
  }, [tickets, filters])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle>Support Tickets</CardTitle>
            <CardDescription>
              Manage your support requests and track issue resolution
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={fetchTickets}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button asChild>
              <a href={routerId ? `/routers/${routerId}/support/tickets/create` : "/support/tickets/create"}>
                <Plus className="h-4 w-4 mr-2" />
                New Ticket
              </a>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
                <div className="text-sm text-muted-foreground">Open</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.inProgress}</div>
                <div className="text-sm text-muted-foreground">In Progress</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
                <div className="text-sm text-muted-foreground">Resolved</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.breachedSla}</div>
                <div className="text-sm text-muted-foreground">SLA Breach</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets by title, description, or ID..."
                className="pl-9"
                onChange={(e) => debouncedSearch(e.target.value)}
              />
            </div>
          </div>

          <Select
            value={filters.status}
            onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="waiting_customer">Waiting</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.priority}
            onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.category}
            onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="billing">Billing</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="feature_request">Feature Request</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tickets Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {tickets.length === 0 ? (
                      <div className="space-y-2">
                        <p>No support tickets found</p>
                        <Button asChild size="sm">
                          <a href={routerId ? `/routers/${routerId}/support/tickets/create` : "/support/tickets/create"}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create First Ticket
                          </a>
                        </Button>
                      </div>
                    ) : (
                      "No tickets match the current filters"
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTickets.map((ticket) => (
                  <TableRow key={ticket._id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{ticket.ticket.title}</div>
                        <div className="text-sm text-muted-foreground">
                          #{ticket._id.substring(0, 8)}
                        </div>
                        {ticket.sla.breachedSla && (
                          <Badge variant="destructive" className="text-xs mt-1">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            SLA Breach
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {ticket.ticket.category}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant={getPriorityVariant(ticket.ticket.priority)} className="capitalize">
                        {ticket.ticket.priority}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant={getStatusVariant(ticket.status)}>
                        {getStatusIcon(ticket.status)}
                        <span className="ml-1 capitalize">{ticket.status.replace('_', ' ')}</span>
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {ticket.assignment ? (
                        <div>
                          <div className="text-sm font-medium">{ticket.assignment.assignedToName}</div>
                          <div className="text-xs text-muted-foreground">
                            {ticket.assignment.department}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{ticket.communication.length}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm">
                        <div>{new Date(ticket.createdAt).toLocaleDateString()}</div>
                        <div className="text-muted-foreground text-xs">
                          {getTimeSince(ticket.createdAt)}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={routerId ? `/routers/${routerId}/support/tickets/${ticket._id}` : `/support/tickets/${ticket._id}`}>
                          <Eye className="h-4 w-4" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Results Summary */}
        {filteredTickets.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Showing {filteredTickets.length} of {tickets.length} tickets
            </div>
            <div className="flex items-center gap-4">
              <div>
                Open: <span className="font-medium text-blue-600">
                  {filteredTickets.filter(t => t.status === 'open').length}
                </span>
              </div>
              <div>
                In Progress: <span className="font-medium text-orange-600">
                  {filteredTickets.filter(t => t.status === 'in_progress').length}
                </span>
              </div>
              <div>
                Resolved: <span className="font-medium text-green-600">
                  {filteredTickets.filter(t => t.status === 'resolved').length}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}