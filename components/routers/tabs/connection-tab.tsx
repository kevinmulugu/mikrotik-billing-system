"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Globe, Save, TestTube } from "lucide-react"

const connectionSchema = z.object({
  ipAddress: z.string().regex(
    /^(\d{1,3}\.){3}\d{1,3}$/,
    "Invalid IP address format"
  ),
  port: z.number().min(1).max(65535),
  apiUser: z.string().min(1, "API user is required"),
  apiPassword: z.string().min(1, "API password is required"),
  restApiEnabled: z.boolean(),
  sshEnabled: z.boolean(),
})

type ConnectionForm = z.infer<typeof connectionSchema>

interface ConnectionTabProps {
  connection: {
    ipAddress: string
    port: number
    apiUser: string
    apiPassword: string
    restApiEnabled: boolean
    sshEnabled: boolean
  }
  onSave: (data: ConnectionForm) => Promise<void>
  onTest: (data: ConnectionForm) => Promise<void>
  saving: boolean
  testing: boolean
}

export function ConnectionTab({ connection, onSave, onTest, saving, testing }: ConnectionTabProps) {
  const form = useForm<ConnectionForm>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      ipAddress: connection.ipAddress || "",
      port: connection.port || 8728,
      apiUser: connection.apiUser || "admin",
      apiPassword: connection.apiPassword || "",
      restApiEnabled: connection.restApiEnabled ?? true,
      sshEnabled: connection.sshEnabled ?? false,
    },
  })

  const handleTest = () => {
    const formData = form.getValues()
    onTest(formData)
  }

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Connection Settings</h3>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="ipAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IP Address</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="192.168.1.1" className="pl-9" {...field} />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Router's IP address
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Port</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="8728"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 8728)}
                    />
                  </FormControl>
                  <FormDescription>
                    MikroTik API port (default: 8728)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiUser"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Username</FormLabel>
                  <FormControl>
                    <Input placeholder="admin" {...field} />
                  </FormControl>
                  <FormDescription>
                    Username for API access
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormDescription>
                    Password for API access
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="restApiEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Enable REST API</FormLabel>
                    <FormDescription>
                      Enable REST API for web-based management
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sshEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Enable SSH Access</FormLabel>
                    <FormDescription>
                      Enable SSH for command-line access
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>

          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>

            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Connection
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}