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
import { Save, Shield, Wifi } from "lucide-react"

const hotspotConfigSchema = z.object({
  enabled: z.boolean(),
  ssid: z.string().min(1, "SSID is required").max(32, "SSID too long"),
  password: z.string().optional(),
  interface: z.string().min(1, "Interface is required"),
  ipPool: z.string().min(1, "IP pool is required"),
  dnsServers: z.array(z.string()),
  maxUsers: z.number().min(1).max(1000),
})

type HotspotConfigForm = z.infer<typeof hotspotConfigSchema>

interface HotspotTabProps {
  hotspot: {
    enabled: boolean
    ssid: string
    password: string
    interface: string
    ipPool: string
    dnsServers: string[]
    maxUsers: number
  }
  onSave: (data: HotspotConfigForm) => Promise<void>
  saving: boolean
}

export function HotspotTab({ hotspot, onSave, saving }: HotspotTabProps) {
  const form = useForm<HotspotConfigForm>({
    resolver: zodResolver(hotspotConfigSchema),
    defaultValues: {
      enabled: hotspot.enabled ?? false,
      ssid: hotspot.ssid || "",
      password: hotspot.password || "",
      interface: hotspot.interface || "wlan1",
      ipPool: hotspot.ipPool || "10.5.50.0/24",
      dnsServers: hotspot.dnsServers || ["8.8.8.8", "8.8.4.4"],
      maxUsers: hotspot.maxUsers || 50,
    },
  })

  const isEnabled = form.watch("enabled")

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Hotspot Configuration</h3>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
          <FormField
            control={form.control}
            name="enabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Enable Hotspot Service</FormLabel>
                  <FormDescription>
                    Enable WiFi hotspot for voucher-based access
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          {isEnabled && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="ssid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WiFi Network Name (SSID)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Wifi className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="MyWiFi" className="pl-9" {...field} />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Name of the WiFi network
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WiFi Password (Optional)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Leave empty for open network" className="pl-9" {...field} />
                        </div>
                      </FormControl>
                      <FormDescription>
                        WiFi password (leave empty for open hotspot)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="interface"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interface</FormLabel>
                      <FormControl>
                        <Input placeholder="wlan1" {...field} />
                      </FormControl>
                      <FormDescription>
                        Network interface for hotspot
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ipPool"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IP Pool</FormLabel>
                      <FormControl>
                        <Input placeholder="10.5.50.0/24" {...field} />
                      </FormControl>
                      <FormDescription>
                        IP pool for hotspot users
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxUsers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Concurrent Users</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={1000}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 50)}
                        />
                      </FormControl>
                      <FormDescription>
                        Maximum number of concurrent users
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="dnsServers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNS Servers</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="8.8.8.8,1.1.1.1"
                        value={field.value?.join(',') || ''}
                        onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()))}
                      />
                    </FormControl>
                    <FormDescription>
                      Comma-separated list of DNS servers
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Hotspot Config
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}