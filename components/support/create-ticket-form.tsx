// components/support/create-ticket-form.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Paperclip, X, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Validation schema
const ticketSchema = z.object({
  title: z.string()
    .min(10, "Title must be at least 10 characters")
    .max(200, "Title must not exceed 200 characters"),
  description: z.string()
    .min(50, "Description must be at least 50 characters")
    .max(2000, "Description must not exceed 2000 characters"),
  category: z.enum(["technical", "billing", "general", "feature_request"], {
    error: "Please select a category",
  }),
  priority: z.enum(["low", "medium", "high", "urgent"], {
    error: "Please select a priority",
  }),
  type: z.enum(["router_issue", "payment_issue", "user_management", "other"], {
    error: "Please select a ticket type",
  }),
  routerId: z.string().optional(),
})

type TicketFormValues = z.infer<typeof ticketSchema>

interface Router {
  id: string
  name: string
  status: string
  health: {
    lastSeen?: string
    uptime: number
    cpuUsage: number
    memoryUsage: number
    temperature: number
    connectedUsers: number
  }
}

export function CreateTicketForm() {
  const router = useRouter()
  const { data: session } = useSession()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [routers, setRouters] = useState<Router[]>([])
  const [loadingRouters, setLoadingRouters] = useState(true)
  const [attachments, setAttachments] = useState<File[]>([])

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "technical",
      priority: "medium",
      type: "router_issue",
      routerId: undefined,
    },
  })

  // Fetch user's routers
  useEffect(() => {
    const fetchRouters = async () => {
      try {
        const response = await fetch('/api/routers', {
          headers: {
            'Authorization': `Bearer ${session?.user?.id}`,
          },
        })

        if (!response.ok) throw new Error('Failed to fetch routers')

        const data = await response.json()
        setRouters(data.routers || [])
      } catch (error) {
        console.error('Error fetching routers:', error)
        toast.error('Failed to load your routers')
      } finally {
        setLoadingRouters(false)
      }
    }

    if (session) {
      fetchRouters()
    }
  }, [session])

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    
    // Validate file size (max 5MB per file)
    const maxSize = 5 * 1024 * 1024 // 5MB
    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        toast.error(`${file.name} exceeds 5MB limit`)
        return false
      }
      return true
    })

    // Limit total attachments to 5
    if (attachments.length + validFiles.length > 5) {
      toast.error('Maximum 5 attachments allowed')
      return
    }

    setAttachments(prev => [...prev, ...validFiles])
  }

  // Remove attachment
  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Submit handler
  const onSubmit = async (values: TicketFormValues) => {
    setIsSubmitting(true)

    try {
      // Create FormData for file upload
      const formData = new FormData()
      
      // Append ticket data
      formData.append('title', values.title)
      formData.append('description', values.description)
      formData.append('category', values.category)
      formData.append('priority', values.priority)
      formData.append('type', values.type)
      
      // Only append routerId if it exists and is not "none"
      if (values.routerId && values.routerId !== 'none') {
        formData.append('routerId', values.routerId)
      }

      // Append attachments
      attachments.forEach((file) => {
        formData.append('attachments', file)
      })

      // Submit to API
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create ticket')
      }

      const data = await response.json()

      toast.success('Support ticket created successfully!')
      
      // Redirect to ticket details
      router.push(`/support/tickets/${data.ticket._id}`)
    } catch (error) {
      console.error('Error creating ticket:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create ticket')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Support Ticket</CardTitle>
        <CardDescription>
          Provide detailed information about your issue to help us resolve it quickly
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Brief summary of your issue"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A clear, concise title helps us categorize your request
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category and Priority */}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="technical">Technical Support</SelectItem>
                        <SelectItem value="billing">Billing & Payments</SelectItem>
                        <SelectItem value="general">General Inquiry</SelectItem>
                        <SelectItem value="feature_request">Feature Request</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low - General question</SelectItem>
                        <SelectItem value="medium">Medium - Issue affecting service</SelectItem>
                        <SelectItem value="high">High - Service disruption</SelectItem>
                        <SelectItem value="urgent">Urgent - Complete outage</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Type *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select issue type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="router_issue">Router Issue</SelectItem>
                      <SelectItem value="payment_issue">Payment Issue</SelectItem>
                      <SelectItem value="user_management">User Management</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Router Selection */}
            <FormField
              control={form.control}
              name="routerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Related Router (Optional)</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      // Set to undefined if "none" is selected
                      field.onChange(value === "none" ? undefined : value)
                    }}
                    value={field.value || "none"}
                    disabled={loadingRouters}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          loadingRouters 
                            ? "Loading routers..." 
                            : routers.length === 0 
                              ? "No routers available"
                              : "Select a router"
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {routers.map((router) => (
                        <SelectItem key={router.id} value={router.id}>
                          {router.name}
                          <Badge 
                            variant={router.status === 'online' ? 'default' : 'destructive'}
                            className="ml-2"
                          >
                            {router.status}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Link this ticket to a specific router if applicable
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your issue in detail. Include steps to reproduce, error messages, and any other relevant information..."
                      className="min-h-[150px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The more details you provide, the faster we can help you (minimum 50 characters)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Attachments */}
            <div className="space-y-4">
              <div>
                <FormLabel>Attachments (Optional)</FormLabel>
                <FormDescription className="mb-2">
                  Add screenshots, logs, or other files (max 5 files, 5MB each)
                </FormDescription>
                
                <div className="space-y-2">
                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      {attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 rounded-lg border bg-background p-3"
                        >
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveAttachment(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {attachments.length < 5 && (
                    <div>
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.txt,.log"
                        onChange={handleFileSelect}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('file-upload')?.click()}
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Add Files
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Information Alert */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Our support team typically responds within 2 hours during business hours.
                For urgent issues, please ensure you select the appropriate priority level.
              </AlertDescription>
            </Alert>

            {/* Submit Buttons */}
            <div className="flex items-center gap-4">
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Ticket...
                  </>
                ) : (
                  'Create Ticket'
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}