"use client";

import React, { useState } from "react";
import {
  Clock,
  MessageSquare,
  Paperclip,
  Send,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MoreVertical,
  User,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface TicketMessage {
  id: string;
  from: {
    id: string;
    name: string;
    role: "customer" | "support";
    avatar?: string;
  };
  message: string;
  attachments?: {
    id: string;
    name: string;
    size: number;
    url: string;
  }[];
  timestamp: Date;
  isInternal: boolean;
}

interface TicketData {
  id: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  category: "technical" | "billing" | "general" | "feature_request";
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: {
    id: string;
    name: string;
    avatar?: string;
  };
  router?: {
    id: string;
    name: string;
  };
  messages: TicketMessage[];
  sla: {
    responseTime: number;
    resolutionTime: number;
    firstResponseAt?: Date;
    resolvedAt?: Date;
  };
}

interface TicketDetailsProps {
  ticketId: string;
  onBack?: () => void;
}

export const TicketDetails: React.FC<TicketDetailsProps> = ({ ticketId, onBack }) => {
  const [newMessage, setNewMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const ticket: TicketData = {
    id: ticketId,
    title: "Router not connecting to internet",
    description:
      "My MikroTik router shows as online in the dashboard but users cannot access the internet. The WiFi is working but no internet connection is available. This started happening this morning around 10 AM.",
    status: "in_progress",
    priority: "high",
    category: "technical",
    createdAt: new Date("2025-01-28T10:15:00"),
    updatedAt: new Date("2025-01-28T11:30:00"),
    assignedTo: {
      id: "support-1",
      name: "John Support",
    },
    router: {
      id: "router-123",
      name: "Home Router - Living Room",
    },
    messages: [
      {
        id: "msg-1",
        from: {
          id: "user-1",
          name: "You",
          role: "customer",
        },
        message:
          "My router stopped providing internet access this morning. Users can connect to WiFi but cannot browse. Please help urgently as I have customers waiting.",
        timestamp: new Date("2025-01-28T10:15:00"),
        isInternal: false,
      },
      {
        id: "msg-2",
        from: {
          id: "support-1",
          name: "John Support",
          role: "support",
        },
        message:
          "Hello! I've reviewed your router status and I can see it's online. Let me check a few things:\n\n1. Can you verify the WAN interface is receiving an IP address?\n2. Are there any error messages in the router logs?\n\nI'm checking your router configuration remotely now.",
        timestamp: new Date("2025-01-28T10:45:00"),
        isInternal: false,
      },
      {
        id: "msg-3",
        from: {
          id: "user-1",
          name: "You",
          role: "customer",
        },
        message:
          "I checked and the WAN shows status as 'running'. I'm not sure how to check the logs though. Can you access them remotely?",
        timestamp: new Date("2025-01-28T11:10:00"),
        isInternal: false,
      },
      {
        id: "msg-4",
        from: {
          id: "support-1",
          name: "John Support",
          role: "support",
        },
        message:
          "I found the issue! Your DNS servers were incorrectly configured. I've updated them to use:\n- Primary: 8.8.8.8\n- Secondary: 8.8.4.4\n\nYour internet should be working now. Can you please test and confirm?",
        attachments: [
          {
            id: "att-1",
            name: "dns_configuration_screenshot.png",
            size: 245678,
            url: "#",
          },
        ],
        timestamp: new Date("2025-01-28T11:30:00"),
        isInternal: false,
      },
    ],
    sla: {
      responseTime: 2,
      resolutionTime: 24,
      firstResponseAt: new Date("2025-01-28T10:45:00"),
    },
  };

  const getPriorityColor = (priority: TicketData["priority"]) => {
    switch (priority) {
      case "urgent":
        return "destructive";
      case "high":
        return "default";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && selectedFiles.length === 0) {
      toast.error("Please enter a message or attach a file");
      return;
    }

    setIsSubmitting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      toast.success("Message sent successfully");
      setNewMessage("");
      setSelectedFiles([]);
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast.success(`Ticket status updated to ${newStatus}`);
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleCloseTicket = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast.success("Ticket closed successfully");
    } catch (error) {
      toast.error("Failed to close ticket");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{ticket.title}</h2>
                <Badge variant="outline" className="font-mono">
                  #{ticket.id}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Created {ticket.createdAt.toLocaleString()} • Updated{" "}
                {ticket.updatedAt.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Escalate Ticket</DropdownMenuItem>
            <DropdownMenuItem>Request Callback</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleCloseTicket}>
              Close Ticket
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{ticket.description}</p>
              </div>

              {ticket.router && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Related Router</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{ticket.router.name}</Badge>
                    <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
                      View Router
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {ticket.messages.map((message) => (
                <div key={message.id}>
                  <div
                    className={`flex gap-3 ${
                      message.from.role === "customer" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={message.from.avatar} />
                      <AvatarFallback>
                        {message.from.role === "customer" ? (
                          <User className="h-4 w-4" />
                        ) : (
                          message.from.name.charAt(0)
                        )}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{message.from.name}</span>
                        {message.from.role === "support" && (
                          <Badge variant="secondary" className="text-xs">
                            Support
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      </div>

                      <div
                        className={`rounded-lg p-3 text-sm ${
                          message.from.role === "customer"
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
                              <Button variant="ghost" size="sm">
                                Download
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

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
                          size="sm"
                          onClick={() => handleRemoveFile(index)}
                        >
                          Remove
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
                    onChange={handleFileSelect}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attach Files
                  </Button>
                </div>

                <Button onClick={handleSendMessage} disabled={isSubmitting}>
                  <Send className="h-4 w-4 mr-2" />
                  {isSubmitting ? "Sending..." : "Send Reply"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                defaultValue={ticket.status}
                onValueChange={handleStatusChange}
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ticket Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Priority</span>
                <Badge variant={getPriorityColor(ticket.priority)}>
                  {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Category</span>
                <Badge variant="outline">
                  {ticket.category.replace("_", " ")}
                </Badge>
              </div>

              {ticket.assignedTo && (
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Assigned To</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={ticket.assignedTo.avatar} />
                      <AvatarFallback>
                        {ticket.assignedTo.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{ticket.assignedTo.name}</span>
                  </div>
                </div>
              )}

              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Created</span>
                </div>
                <p className="text-sm">{ticket.createdAt.toLocaleString()}</p>
              </div>

              {ticket.sla.firstResponseAt && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">First Response</span>
                  </div>
                  <p className="text-sm">
                    {ticket.sla.firstResponseAt.toLocaleString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

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
              {ticket.sla.firstResponseAt && (
                <Badge variant="outline" className="w-full justify-center">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  SLA Met
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};