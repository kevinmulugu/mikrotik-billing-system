"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
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
  Calendar,
  CreditCard,
  Globe,
  HardDrive,
  IdCard,
  Lock,
  Mail,
  Network,
  Phone,
  Save,
  Shield,
  Trash2,
  User,
  Wifi,
  X,
} from "lucide-react"
import { 
  formatDataUsage, 
  formatCurrency, 
  isValidKenyanPhone, 
  formatPhoneNumber 
} from "@/lib/utils"

// Validation schema
const editPPPoEUserSchema = z.object({
  // Personal Information
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().min(1, "Phone number is required").refine((phone) => {
    return isValidKenyanPhone(phone)
  }, "Invalid Kenyan phone number"),
  address: z.string().optional(),
  idNumber: z.string().optional(),

  // Service Configuration
  packageType: z.string().min(1, "Package type is required"),
  profile: z.string().min(1, "Profile is required"),
  staticIP: z.string().optional().refine((ip) => {
    if (!ip) return true
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    return ipRegex.test(ip)
  }, "Invalid IP address format"),
  uploadSpeed: z.number().min(64).max(10240),
  downloadSpeed: z.number().min(128).max(51200),
  dataLimit: z.number().min(0),
  monthlyPrice: z.number().min(1),

  // Billing Configuration
  billingCycle: z.enum(["monthly", "weekly", "daily"]),
  gracePeriod: z.number().min(0).max(30),
  autoDisconnect: z.boolean(),

  // Advanced Settings
  serviceName: z.string().optional(),
  maxConcurrentSessions: z.number().min(1).max(10),
  idleTimeout: z.number().min(0).max(3600),
  sessionTimeout: z.number().min(0).max(86400),
})

type EditPPPoEUserForm = z.infer<typeof editPPPoEUserSchema>

interface EditPPPoEUserFormProps {
  routerId: string
  userId: string
  onUserUpdated?: () => void
  onUserDeleted?: () => void
}

interface PPPoEUser {
  _id: string
  userInfo: {
    username: string
    password: string
    fullName: string
    email?: string
    phone: string
    address?: string
    idNumber?: string
  }
  service: {
    profile: string
    ipAddress?: string
    packageType: string
    bandwidth: {
      upload: number
      download: number
    }
    dataLimit: number
    price: number
    serviceName?: string
    maxConcurrentSessions?: number
    idleTimeout?: number
    sessionTimeout?: number
  }
  billing: {
    billingCycle: string
    nextBillingDate: Date
    gracePeriod: number
    autoDisconnect: boolean
    outstandingAmount: number
  }
  status: string
  createdAt: Date
  updatedAt: Date
}

export function EditPPPoEUserForm({ 
  routerId, 
  userId, 
  onUserUpdated,
  onUserDeleted 
}: EditPPPoEUserFormProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<PPPoEUser | null>(null)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [newPassword, setNewPassword] = useState("")

  const form = useForm<EditPPPoEUserForm>({
    resolver: zodResolver(editPPPoEUserSchema),
  })

  // Fetch user data
  const fetchUser = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/routers/${routerId}/users/pppoe/${userId}`, {
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch user data')
      }

      const data = await response.json()
      setUser(data.user)

      // Populate form with user data
      form.reset({
        fullName: data.user.userInfo.fullName,
        email: data.user.userInfo.email || "",
        phone: data.user.userInfo.phone,
        address: data.user.userInfo.address || "",
        idNumber: data.user.userInfo.idNumber || "",
        packageType: data.user.service.packageType,
        profile: data.user.service.profile,
        staticIP: data.user.service.ipAddress || "",
        uploadSpeed: data.user.service.bandwidth.upload,
        downloadSpeed: data.user.service.bandwidth.download,
        dataLimit: data.user.service.dataLimit,
        monthlyPrice: data.user.service.price,
        billingCycle: data.user.billing.billingCycle,
        gracePeriod: data.user.billing.gracePeriod,
        autoDisconnect: data.user.billing.autoDisconnect,
        serviceName: data.user.service.serviceName || "",
        maxConcurrentSessions: data.user.service.maxConcurrentSessions || 1,
        idleTimeout: data.user.service.idleTimeout || 0,
        sessionTimeout: data.user.service.sessionTimeout || 0,
      })

    } catch (error) {
      console.error('Error fetching user:', error)
      toast.error('Failed to load user data')
    } finally {
      setLoading(false)
    }
  }

  // Generate secure password
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNewPassword(password)
    toast.success("Secure password generated")
  }

  // Update password
  const updatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    try {
      setSaving(true)
      const response = await fetch(`/api/routers/${routerId}/users/pppoe/${userId}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.user?.id}`,
        },
        body: JSON.stringify({ password: newPassword }),
      })

      if (!response.ok) {
        throw new Error('Failed to update password')
      }

      toast.success("Password updated successfully")
      setShowPasswordChange(false)
      setNewPassword("")
      fetchUser()
    } catch (error: any) {
      console.error('Error updating password:', error)
      toast.error(error.message || 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  // Submit form
  const onSubmit = async (data: EditPPPoEUserForm) => {
    try {
      setSaving(true)

      // Format phone number
      const formattedPhone = formatPhoneNumber(data.phone)

      const response = await fetch(`/api/routers/${routerId}/users/pppoe/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.user?.id}`,
        },
        body: JSON.stringify({
          userInfo: {
            fullName: data.fullName,
            email: data.email,
            phone: formattedPhone,
            address: data.address,
            idNumber: data.idNumber,
          },
          service: {
            profile: data.profile,
            ipAddress: data.staticIP,
            packageType: data.packageType,
            bandwidth: {
              upload: data.uploadSpeed,
              download: data.downloadSpeed,
            },
            dataLimit: data.dataLimit,
            price: data.monthlyPrice,
            serviceName: data.serviceName,
            maxConcurrentSessions: data.maxConcurrentSessions,
            idleTimeout: data.idleTimeout,
            sessionTimeout: data.sessionTimeout,
          },
          billing: {
            billingCycle: data.billingCycle,
            gracePeriod: data.gracePeriod,
            autoDisconnect: data.autoDisconnect,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update user')
      }

      toast.success("PPPoE user updated successfully")
      
      // Notify parent and refresh data
      onUserUpdated?.()
      fetchUser()
      
    } catch (error: any) {
      console.error('Error updating user:', error)
      toast.error(error.message || 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  // Delete user
  const deleteUser = async () => {
    try {
      setSaving(true)
      const response = await fetch(`/api/routers/${routerId}/users/pppoe/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete user')
      }

      toast.success("PPPoE user deleted successfully")
      
      // Notify parent and redirect
      onUserDeleted?.()
      router.push(`/routers/${routerId}/users/pppoe`)
      
    } catch (error: any) {
      console.error('Error deleting user:', error)
      toast.error(error.message || 'Failed to delete user')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (session && routerId && userId) {
      fetchUser()
    }
  }, [session, routerId, userId])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">User not found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* User Info Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                {user.userInfo.fullName}
              </CardTitle>
              <CardDescription>
                Username: {user.userInfo.username} • Status: <Badge variant={user.status === "active" ? "default" : "secondary"}>{user.status}</Badge>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPasswordChange(!showPasswordChange)}
              >
                <Lock className="h-4 w-4 mr-2" />
                Change Password
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete User
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete PPPoE User</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete user "{user.userInfo.username}"? 
                      This will permanently remove the account and all associated data. 
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={deleteUser}
                      className="bg-red-600 hover:bg-red-700"
                      disabled={saving}
                    >
                      {saving ? "Deleting..." : "Delete User"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>

        {/* Password Change Section */}
        {showPasswordChange && (
          <CardContent className="border-t pt-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-3">Change Password</h4>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="Enter new password"
                      className="pl-9"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={generatePassword}>
                    Generate
                  </Button>
                  <Button onClick={updatePassword} disabled={saving || !newPassword}>
                    Update
                  </Button>
                  <Button variant="ghost" onClick={() => {
                    setShowPasswordChange(false)
                    setNewPassword("")
                  }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Password must be at least 6 characters long
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>Edit User Information</CardTitle>
          <CardDescription>
            Update customer details, service configuration, and billing settings
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="personal" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="personal">Personal Info</TabsTrigger>
                  <TabsTrigger value="service">Service Config</TabsTrigger>
                  <TabsTrigger value="billing">Billing Setup</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>

                {/* Personal Information Tab */}
                <TabsContent value="personal" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Username (Read-only) */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Username</label>
                      <Input value={user.userInfo.username} disabled />
                      <p className="text-sm text-muted-foreground">Username cannot be changed</p>
                    </div>

                    {/* Full Name */}
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="John Doe" className="pl-9" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Phone */}
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="+254700000000" className="pl-9" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Email */}
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="john@example.com" className="pl-9" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* ID Number */}
                    <FormField
                      control={form.control}
                      name="idNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ID Number</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <IdCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="12345678" className="pl-9" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Address */}
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Physical Address</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter complete physical address..."
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* Service Configuration Tab */}
                <TabsContent value="service" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Package Type */}
                    <FormField
                      control={form.control}
                      name="packageType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Package Type</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Profile */}
                    <FormField
                      control={form.control}
                      name="profile"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PPPoE Profile</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Network className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input className="pl-9" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Static IP */}
                    <FormField
                      control={form.control}
                      name="staticIP"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Static IP Address</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="Optional" className="pl-9" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Upload Speed */}
                    <FormField
                      control={form.control}
                      name="uploadSpeed"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Upload Speed (Kbps)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Wifi className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="number"
                                min={64}
                                max={10240}
                                className="pl-9"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Download Speed */}
                    <FormField
                      control={form.control}
                      name="downloadSpeed"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Download Speed (Kbps)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Wifi className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="number"
                                min={128}
                                max={51200}
                                className="pl-9"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Data Limit */}
                    <FormField
                      control={form.control}
                      name="dataLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monthly Data Limit (Bytes)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <HardDrive className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="number"
                                min={0}
                                className="pl-9"
                                placeholder="0 for unlimited"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            {field.value > 0 ? formatDataUsage(field.value) : "0 = Unlimited"}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Monthly Price */}
                    <FormField
                      control={form.control}
                      name="monthlyPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monthly Price (KES)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="number"
                                min={1}
                                className="pl-9"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Quick Data Limit Select */}
                  <div className="space-y-3">
                    <FormLabel>Quick Data Limit Selection</FormLabel>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { label: "10GB", value: 10 * 1024 * 1024 * 1024 },
                        { label: "25GB", value: 25 * 1024 * 1024 * 1024 },
                        { label: "50GB", value: 50 * 1024 * 1024 * 1024 },
                        { label: "100GB", value: 100 * 1024 * 1024 * 1024 },
                        { label: "200GB", value: 200 * 1024 * 1024 * 1024 },
                        { label: "500GB", value: 500 * 1024 * 1024 * 1024 },
                        { label: "1TB", value: 1024 * 1024 * 1024 * 1024 },
                        { label: "Unlimited", value: 0 },
                      ].map((option) => (
                        <Button
                          key={option.label}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => form.setValue("dataLimit", option.value)}
                          className={form.watch("dataLimit") === option.value ? "bg-primary text-primary-foreground" : ""}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* Billing Configuration Tab */}
                <TabsContent value="billing" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Billing Cycle */}
                    <FormField
                      control={form.control}
                      name="billingCycle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Cycle</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Grace Period */}
                    <FormField
                      control={form.control}
                      name="gracePeriod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Grace Period (Days)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={30}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>
                            Days after due date before suspension
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Auto Disconnect */}
                  <FormField
                    control={form.control}
                    name="autoDisconnect"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Auto-disconnect on overdue payment
                          </FormLabel>
                          <FormDescription>
                            Automatically suspend service when payment is overdue
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Current Billing Info */}
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-medium mb-3">Current Billing Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Next Billing Date</div>
                        <div className="font-medium">
                          {new Date(user.billing.nextBillingDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Outstanding Amount</div>
                        <div className={`font-medium ${user.billing.outstandingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(user.billing.outstandingAmount)}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Advanced Settings Tab */}
                <TabsContent value="advanced" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Service Name */}
                    <FormField
                      control={form.control}
                      name="serviceName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Name</FormLabel>
                          <FormControl>
                            <Input placeholder="High Speed Internet" {...field} />
                          </FormControl>
                          <FormDescription>
                            Custom service name
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Max Concurrent Sessions */}
                    <FormField
                      control={form.control}
                      name="maxConcurrentSessions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Concurrent Sessions</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={10}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum simultaneous connections
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Idle Timeout */}
                    <FormField
                      control={form.control}
                      name="idleTimeout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Idle Timeout (seconds)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={3600}
                              placeholder="0 = no timeout"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>
                            Disconnect after idle time
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Session Timeout */}
                    <FormField
                      control={form.control}
                      name="sessionTimeout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Session Timeout (seconds)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={86400}
                              placeholder="0 = no timeout"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum session duration
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {/* Configuration Summary */}
              <Separator />
              <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium mb-3">Current Configuration</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Username</div>
                    <div className="font-medium font-mono">{user.userInfo.username}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Package</div>
                    <div className="font-medium">{form.watch("packageType")}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Bandwidth</div>
                    <div className="font-medium">
                      ↓{form.watch("downloadSpeed")}K / ↑{form.watch("uploadSpeed")}K
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Data Limit</div>
                    <div className="font-medium">
                      {form.watch("dataLimit") > 0 
                        ? formatDataUsage(form.watch("dataLimit"))
                        : "Unlimited"
                      }
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Monthly Fee</div>
                    <div className="font-medium text-green-600">
                      {formatCurrency(form.watch("monthlyPrice"))}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Status</div>
                    <div>
                      <Badge variant={user.status === "active" ? "default" : "secondary"}>
                        {user.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Timeline */}
              <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                <h4 className="font-medium mb-3 text-blue-800">Account Timeline</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Created</div>
                    <div className="font-medium">
                      {new Date(user.createdAt).toLocaleDateString()} at {new Date(user.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Last Updated</div>
                    <div className="font-medium">
                      {new Date(user.updatedAt).toLocaleDateString()} at {new Date(user.updatedAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <Separator />
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}