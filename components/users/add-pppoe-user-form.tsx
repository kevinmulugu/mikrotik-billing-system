"use client"

import { useState } from "react"
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
import {
  Calendar,
  CreditCard,
  Globe,
  HardDrive,
  IdCard,
  Mail,
  Network,
  Phone,
  Save,
  Shield,
  User,
  UserPlus,
  Wifi,
} from "lucide-react"
import { 
  formatDataUsage, 
  formatCurrency, 
  isValidKenyanPhone, 
  formatPhoneNumber 
} from "@/lib/utils"

// Validation schema for PPPoE user
const addPPPoEUserSchema = z.object({
  // Personal Information
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must not exceed 20 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscore, and dash"),
  password: z.string()
    .min(6, "Password must be at least 6 characters")
    .max(50, "Password must not exceed 50 characters"),
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
  uploadSpeed: z.number().min(64, "Minimum upload speed is 64 Kbps").max(10240, "Maximum upload speed is 10 Mbps"),
  downloadSpeed: z.number().min(128, "Minimum download speed is 128 Kbps").max(51200, "Maximum download speed is 50 Mbps"),
  dataLimit: z.number().min(0, "Data limit cannot be negative"),
  monthlyPrice: z.number().min(1, "Monthly price must be greater than 0"),

  // Billing Configuration
  billingCycle: z.enum(["monthly", "weekly", "daily"]),
  gracePeriod: z.number().min(0, "Grace period cannot be negative").max(30, "Maximum grace period is 30 days"),
  autoDisconnect: z.boolean(),
  autoActivate: z.boolean(),

  // Advanced Settings
  serviceName: z.string().optional(),
  maxConcurrentSessions: z.number().min(1).max(10).default(1),
  idleTimeout: z.number().min(0).max(3600).default(0), // 0 = no timeout
  sessionTimeout: z.number().min(0).max(86400).default(0), // 0 = no timeout
})

type AddPPPoEUserForm = z.infer<typeof addPPPoEUserSchema>

// PPPoE Package templates for Kenya market
const pppoePackageTemplates = [
  {
    type: "home_basic",
    name: "Home Basic",
    upload: 512,
    download: 2048,
    dataLimit: 15 * 1024 * 1024 * 1024, // 15GB
    price: 1000,
    description: "Perfect for home browsing and social media"
  },
  {
    type: "home_standard",
    name: "Home Standard",
    upload: 1024,
    download: 5120,
    dataLimit: 50 * 1024 * 1024 * 1024, // 50GB
    price: 2000,
    description: "Great for streaming and video calls"
  },
  {
    type: "home_premium",
    name: "Home Premium",
    upload: 2048,
    download: 10240,
    dataLimit: 100 * 1024 * 1024 * 1024, // 100GB
    price: 3500,
    description: "High-speed internet for heavy users"
  },
  {
    type: "business_starter",
    name: "Business Starter",
    upload: 1024,
    download: 5120,
    dataLimit: 75 * 1024 * 1024 * 1024, // 75GB
    price: 3000,
    description: "Small business internet solution"
  },
  {
    type: "business_pro",
    name: "Business Pro",
    upload: 3072,
    download: 15360,
    dataLimit: 200 * 1024 * 1024 * 1024, // 200GB
    price: 5000,
    description: "Professional business connectivity"
  },
  {
    type: "unlimited_home",
    name: "Unlimited Home",
    upload: 2048,
    download: 8192,
    dataLimit: 0, // Unlimited
    price: 4500,
    description: "Unlimited high-speed home internet"
  },
  {
    type: "unlimited_business",
    name: "Unlimited Business",
    upload: 4096,
    download: 20480,
    dataLimit: 0, // Unlimited
    price: 8000,
    description: "Unlimited enterprise-grade internet"
  },
  {
    type: "custom",
    name: "Custom Package",
    upload: 1024,
    download: 4096,
    dataLimit: 0,
    price: 2500,
    description: "Configure your own package"
  }
]

interface AddPPPoEUserFormProps {
  routerId: string
}

export function AddPPPoEUserForm({ routerId }: AddPPPoEUserFormProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const form = useForm<AddPPPoEUserForm>({
    resolver: zodResolver(addPPPoEUserSchema),
    defaultValues: {
      username: "",
      password: "",
      fullName: "",
      email: "",
      phone: "",
      address: "",
      idNumber: "",
      packageType: "",
      profile: "default-pppoe",
      staticIP: "",
      uploadSpeed: 1024,
      downloadSpeed: 4096,
      dataLimit: 0,
      monthlyPrice: 2500,
      billingCycle: "monthly",
      gracePeriod: 3,
      autoDisconnect: true,
      autoActivate: true,
      serviceName: "",
      maxConcurrentSessions: 1,
      idleTimeout: 0,
      sessionTimeout: 0,
    },
  })

  // Apply package template
  const applyPackageTemplate = (packageType: string) => {
    const template = pppoePackageTemplates.find(pkg => pkg.type === packageType)
    if (template) {
      form.setValue("uploadSpeed", template.upload)
      form.setValue("downloadSpeed", template.download)
      form.setValue("dataLimit", template.dataLimit)
      form.setValue("monthlyPrice", template.price)
    }
  }

  // Generate secure password
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    form.setValue("password", password)
    toast.success("Secure password generated")
  }

  // Generate username from full name
  const generateUsername = () => {
    const fullName = form.getValues("fullName")
    if (!fullName) {
      toast.error("Please enter full name first")
      return
    }
    
    const username = fullName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 15) + Math.floor(Math.random() * 100)
    
    form.setValue("username", username)
    toast.success("Username generated from full name")
  }

  // Calculate next billing date
  const calculateNextBillingDate = (): Date => {
    const now = new Date()
    const billingCycle = form.watch("billingCycle")
    
    switch (billingCycle) {
      case "daily":
        return new Date(now.getTime() + 24 * 60 * 60 * 1000)
      case "weekly":
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      case "monthly":
      default:
        const nextMonth = new Date(now)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        return nextMonth
    }
  }

  // Submit form
  const onSubmit = async (data: AddPPPoEUserForm) => {
    try {
      setLoading(true)

      // Format phone number
      const formattedPhone = formatPhoneNumber(data.phone)

      const response = await fetch(`/api/routers/${routerId}/users/pppoe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.user?.id}`,
        },
        body: JSON.stringify({
          userInfo: {
            username: data.username,
            password: data.password,
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
            currency: "KES",
            serviceName: data.serviceName,
            maxConcurrentSessions: data.maxConcurrentSessions,
            idleTimeout: data.idleTimeout,
            sessionTimeout: data.sessionTimeout,
          },
          billing: {
            billingCycle: data.billingCycle,
            nextBillingDate: calculateNextBillingDate(),
            gracePeriod: data.gracePeriod,
            autoDisconnect: data.autoDisconnect,
            outstandingAmount: 0,
          },
          status: data.autoActivate ? "active" : "suspended",
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create PPPoE user')
      }

      const result = await response.json()
      
      toast.success("PPPoE user created successfully")
      
      // Redirect to user details
      router.push(`/routers/${routerId}/users/pppoe/${result.user._id}`)
      
    } catch (error: any) {
      console.error('Error creating PPPoE user:', error)
      toast.error(error.message || 'Failed to create PPPoE user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <UserPlus className="h-5 w-5 mr-2" />
          Add PPPoE User
        </CardTitle>
        <CardDescription>
          Create a new PPPoE subscriber account with billing and service configuration
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
                        <FormDescription>
                          Customer's full legal name
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Username */}
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username *</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input placeholder="john_doe" {...field} />
                            <Button type="button" variant="outline" onClick={generateUsername}>
                              Generate
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Unique username for PPPoE login
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Password */}
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password *</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input type="password" placeholder="••••••••••••" className="pl-9" {...field} />
                            </div>
                            <Button type="button" variant="outline" onClick={generatePassword}>
                              Generate
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Secure password for authentication
                        </FormDescription>
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
                        <FormDescription>
                          Primary contact number (Kenyan format)
                        </FormDescription>
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
                        <FormDescription>
                          Email for billing and notifications
                        </FormDescription>
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
                        <FormDescription>
                          National ID or Passport number
                        </FormDescription>
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
                          placeholder="Enter complete physical address for service installation..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Address where PPPoE service will be installed
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Service Configuration Tab */}
              <TabsContent value="service" className="space-y-6">
                {/* Package Template Selection */}
                <FormField
                  control={form.control}
                  name="packageType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Package *</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value)
                          applyPackageTemplate(value)
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a service package" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {pppoePackageTemplates.map((pkg) => (
                            <SelectItem key={pkg.type} value={pkg.type}>
                              <div className="flex items-center justify-between w-full min-w-[300px]">
                                <div>
                                  <div className="font-medium">{pkg.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {pkg.description}
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <div className="font-medium text-green-600">{formatCurrency(pkg.price)}/mo</div>
                                  <div className="text-xs text-muted-foreground">
                                    ↓{pkg.download}K ↑{pkg.upload}K
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose a pre-configured service package
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* PPPoE Profile */}
                  <FormField
                    control={form.control}
                    name="profile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PPPoE Profile</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Network className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="default-pppoe" className="pl-9" {...field} />
                          </div>
                        </FormControl>
                        <FormDescription>
                          MikroTik PPP profile name
                        </FormDescription>
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
                            <Input placeholder="192.168.1.100 (optional)" className="pl-9" {...field} />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Leave empty for dynamic IP assignment
                        </FormDescription>
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
                        <FormDescription>
                          Maximum upload speed
                        </FormDescription>
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
                        <FormDescription>
                          Maximum download speed
                        </FormDescription>
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
                          {field.value > 0 ? formatDataUsage(field.value) : "0 = Unlimited data"}
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
                        <FormLabel>Monthly Price (KES) *</FormLabel>
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
                        <FormDescription>
                          Monthly subscription fee
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Data Limit Quick Select */}
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
                            <SelectItem value="monthly">
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-2" />
                                Monthly
                              </div>
                            </SelectItem>
                            <SelectItem value="weekly">
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-2" />
                                Weekly
                              </div>
                            </SelectItem>
                            <SelectItem value="daily">
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-2" />
                                Daily
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          How often the customer will be billed
                        </FormDescription>
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
                          Days after due date before service suspension
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Billing Options */}
                <div className="space-y-4">
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
                            Automatically suspend service when payment is overdue beyond grace period
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="autoActivate"
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
                            Activate account immediately
                          </FormLabel>
                          <FormDescription>
                            Account will be active and ready for use immediately after creation
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Billing Preview */}
                <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                  <h4 className="font-medium mb-3 text-green-800">Billing Preview</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Monthly Fee</div>
                      <div className="font-medium text-green-600">
                        {formatCurrency(form.watch("monthlyPrice"))}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Billing Cycle</div>
                      <div className="font-medium capitalize">
                        {form.watch("billingCycle")}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Next Billing Date</div>
                      <div className="font-medium">
                        {calculateNextBillingDate().toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Grace Period</div>
                      <div className="font-medium">
                        {form.watch("gracePeriod")} days
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
                          Custom service name for this user
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
                          Maximum simultaneous connections allowed
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
                          Disconnect after idle time (0 = disabled)
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
                          Maximum session duration (0 = unlimited)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Advanced Options Info */}
                <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                  <h4 className="font-medium mb-2 text-blue-800">Advanced Settings Information</h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    <p>• <strong>Max Concurrent Sessions:</strong> Controls how many devices can use the same account simultaneously</p>
                    <p>• <strong>Idle Timeout:</strong> Automatically disconnects inactive users to free up bandwidth</p>
                    <p>• <strong>Session Timeout:</strong> Enforces maximum session duration for fair usage</p>
                    <p>• <strong>Service Name:</strong> Appears in user's connection details and billing</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Configuration Summary */}
            <Separator />
            <div className="p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium mb-3">Configuration Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Customer</div>
                  <div className="font-medium">
                    {form.watch("fullName") || "Not specified"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {form.watch("phone") ? formatPhoneNumber(form.watch("phone")) : "No phone"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Username</div>
                  <div className="font-medium font-mono">
                    {form.watch("username") || "Not specified"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Package</div>
                  <div className="font-medium">
                    {form.watch("packageType") ? 
                      pppoePackageTemplates.find(p => p.type === form.watch("packageType"))?.name || form.watch("packageType")
                      : "Not selected"
                    }
                  </div>
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
                  <div className="text-muted-foreground">Billing Cycle</div>
                  <div className="font-medium capitalize">
                    {form.watch("billingCycle")}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div>
                    <Badge variant={form.watch("autoActivate") ? "default" : "secondary"}>
                      {form.watch("autoActivate") ? "Active" : "Suspended"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Next Billing</div>
                  <div className="font-medium">
                    {calculateNextBillingDate().toLocaleDateString()}
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
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !form.watch("fullName") || !form.watch("username") || !form.watch("password") || !form.watch("phone") || !form.watch("packageType")}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Creating PPPoE User...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create PPPoE User Account
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}