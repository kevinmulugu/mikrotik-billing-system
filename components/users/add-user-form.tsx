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
import {
  Globe,
  HardDrive,
  Mail,
  Phone,
  Save,
  User,
  UserPlus,
  Wifi,
} from "lucide-react"
import { formatDataUsage, formatCurrency, isValidKenyanPhone } from "@/lib/utils"

// Validation schema
const addUserSchema = z.object({
  // Personal Information
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must not exceed 20 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscore, and dash"),
  password: z.string()
    .min(6, "Password must be at least 6 characters")
    .max(50, "Password must not exceed 50 characters"),
  fullName: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional().refine((phone) => {
    if (!phone) return true
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
  monthlyPrice: z.number().min(0, "Price cannot be negative"),

  // Billing Configuration
  billingCycle: z.enum(["monthly", "weekly", "daily"]),
  gracePeriod: z.number().min(0, "Grace period cannot be negative").max(30, "Maximum grace period is 30 days"),
  autoDisconnect: z.boolean(),
  autoActivate: z.boolean(),
})

type AddUserForm = z.infer<typeof addUserSchema>

// Package templates
const packageTemplates = [
  {
    type: "basic",
    name: "Basic Package",
    upload: 512,
    download: 1024,
    dataLimit: 10 * 1024 * 1024 * 1024, // 10GB
    price: 500,
    description: "Perfect for light browsing and social media"
  },
  {
    type: "standard",
    name: "Standard Package",
    upload: 1024,
    download: 2048,
    dataLimit: 25 * 1024 * 1024 * 1024, // 25GB
    price: 1000,
    description: "Great for streaming and video calls"
  },
  {
    type: "premium",
    name: "Premium Package",
    upload: 2048,
    download: 5120,
    dataLimit: 50 * 1024 * 1024 * 1024, // 50GB
    price: 1500,
    description: "High-speed internet for heavy users"
  },
  {
    type: "unlimited",
    name: "Unlimited Package",
    upload: 2048,
    download: 5120,
    dataLimit: 0, // Unlimited
    price: 2000,
    description: "Unlimited high-speed internet"
  },
  {
    type: "custom",
    name: "Custom Package",
    upload: 1024,
    download: 2048,
    dataLimit: 0,
    price: 1000,
    description: "Configure your own package"
  }
]

interface AddUserFormProps {
  routerId: string
  userType: "pppoe" | "hotspot"
}

export function AddUserForm({ routerId, userType }: AddUserFormProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const form = useForm<AddUserForm>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      username: "",
      password: "",
      fullName: "",
      email: "",
      phone: "",
      address: "",
      idNumber: "",
      packageType: "",
      profile: userType === "pppoe" ? "default-pppoe" : "default-hotspot",
      staticIP: "",
      uploadSpeed: 1024,
      downloadSpeed: 2048,
      dataLimit: 0,
      monthlyPrice: 1000,
      billingCycle: "monthly",
      gracePeriod: 3,
      autoDisconnect: true,
      autoActivate: true,
    },
  })

  // Apply package template
  const applyPackageTemplate = (packageType: string) => {
    const template = packageTemplates.find(pkg => pkg.type === packageType)
    if (template) {
      form.setValue("uploadSpeed", template.upload)
      form.setValue("downloadSpeed", template.download)
      form.setValue("dataLimit", template.dataLimit)
      form.setValue("monthlyPrice", template.price)
    }
  }

  // Generate random password
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let password = ''
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    form.setValue("password", password)
    toast.success("Password generated")
  }

  // Submit form
  const onSubmit = async (data: AddUserForm) => {
    try {
      setLoading(true)

      const response = await fetch(`/api/routers/${routerId}/users/${userType}`, {
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
            phone: data.phone,
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
          },
          billing: {
            billingCycle: data.billingCycle,
            gracePeriod: data.gracePeriod,
            autoDisconnect: data.autoDisconnect,
          },
          status: data.autoActivate ? "active" : "suspended",
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create user')
      }

      const result = await response.json()
      
      toast.success(`${userType.toUpperCase()} user created successfully`)
      
      // Redirect to user details or list
      router.push(`/routers/${routerId}/users/${userType}/${result.user._id}`)
      
    } catch (error: any) {
      console.error('Error creating user:', error)
      toast.error(error.message || 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <UserPlus className="h-5 w-5 mr-2" />
          Add {userType.toUpperCase()} User
        </CardTitle>
        <CardDescription>
          Create a new {userType === "pppoe" ? "PPPoE" : "Hotspot"} user account with service configuration
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="personal">Personal Info</TabsTrigger>
                <TabsTrigger value="service">Service Config</TabsTrigger>
                <TabsTrigger value="billing">Billing Setup</TabsTrigger>
              </TabsList>

              {/* Personal Information Tab */}
              <TabsContent value="personal" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Username */}
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username *</FormLabel>
                        <FormControl>
                          <Input placeholder="john_doe" {...field} />
                        </FormControl>
                        <FormDescription>
                          Unique username for login (3-20 characters)
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
                            <Input type="password" placeholder="••••••••" {...field} />
                            <Button type="button" variant="outline" onClick={generatePassword}>
                              Generate
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Password for user authentication
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Full Name */}
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
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

                  {/* Phone */}
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="+254700000000" className="pl-9" {...field} />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Kenyan phone number format (+254, 07xx, or 7xx)
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
                          <Input placeholder="12345678" {...field} />
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
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter full address..."
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
                {/* Package Template Selection */}
                <FormField
                  control={form.control}
                  name="packageType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Package Template</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value)
                          applyPackageTemplate(value)
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a package template" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {packageTemplates.map((pkg) => (
                            <SelectItem key={pkg.type} value={pkg.type}>
                              <div>
                                <div className="font-medium">{pkg.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {pkg.description} - {formatCurrency(pkg.price)}/month
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose a template to auto-fill service configuration
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Profile */}
                  <FormField
                    control={form.control}
                    name="profile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MikroTik Profile</FormLabel>
                        <FormControl>
                          <Input placeholder="default-pppoe" {...field} />
                        </FormControl>
                        <FormDescription>
                          MikroTik profile name for this user
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
                            <Input placeholder="192.168.1.100" className="pl-9" {...field} />
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
                          Maximum upload speed in Kbps
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
                          Maximum download speed in Kbps
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
                        <FormLabel>Monthly Price (KES)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">KES</span>
                            <Input
                              type="number"
                              min={0}
                              className="pl-12"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Monthly subscription fee in Kenyan Shillings
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
                      { label: "5GB", value: 5 * 1024 * 1024 * 1024 },
                      { label: "10GB", value: 10 * 1024 * 1024 * 1024 },
                      { label: "25GB", value: 25 * 1024 * 1024 * 1024 },
                      { label: "50GB", value: 50 * 1024 * 1024 * 1024 },
                      { label: "100GB", value: 100 * 1024 * 1024 * 1024 },
                      { label: "200GB", value: 200 * 1024 * 1024 * 1024 },
                      { label: "500GB", value: 500 * 1024 * 1024 * 1024 },
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
                        <FormDescription>
                          How often the user will be billed
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
                            User account will be active and ready for use immediately
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Summary */}
                <div className="p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-3">Configuration Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Package</div>
                      <div className="font-medium">
                        {form.watch("packageType") || "Not selected"}
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
                      <div className="text-muted-foreground">Monthly Price</div>
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
                      <div className="font-medium">
                        {form.watch("autoActivate") ? "Active" : "Suspended"}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

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
                disabled={loading || !form.watch("username") || !form.watch("password") || !form.watch("packageType")}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Creating User...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create {userType.toUpperCase()} User
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