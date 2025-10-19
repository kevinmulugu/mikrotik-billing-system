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
import { Globe, Network, Save } from "lucide-react"

const networkConfigSchema = z.object({
  lanInterface: z.string().min(1, "LAN interface is required"),
  wanInterface: z.string().min(1, "WAN interface is required"),
  lanSubnet: z.string().regex(
    /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/,
    "Invalid subnet format (e.g., 192.168.1.0/24)"
  ),
  dhcpRange: z.string().min(1, "DHCP range is required"),
})

type NetworkConfigForm = z.infer<typeof networkConfigSchema>

interface NetworkTabProps {
  network: {
    lanInterface: string
    wanInterface: string
    lanSubnet: string
    dhcpRange: string
  }
  onSave: (data: NetworkConfigForm) => Promise<void>
  saving: boolean
}

export function NetworkTab({ network, onSave, saving }: NetworkTabProps) {
  const form = useForm<NetworkConfigForm>({
    resolver: zodResolver(networkConfigSchema),
    defaultValues: {
      lanInterface: network.lanInterface || "bridge",
      wanInterface: network.wanInterface || "ether1",
      lanSubnet: network.lanSubnet || "192.168.88.0/24",
      dhcpRange: network.dhcpRange || "192.168.88.10-192.168.88.254",
    },
  })

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Network Configuration</h3>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="lanInterface"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LAN Interface</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Network className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="bridge" className="pl-9" {...field} />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Local network interface
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="wanInterface"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WAN Interface</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="ether1" className="pl-9" {...field} />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Internet connection interface
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lanSubnet"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LAN Subnet</FormLabel>
                  <FormControl>
                    <Input placeholder="192.168.88.0/24" {...field} />
                  </FormControl>
                  <FormDescription>
                    Local network subnet (CIDR notation)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dhcpRange"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>DHCP Range</FormLabel>
                  <FormControl>
                    <Input placeholder="192.168.88.10-192.168.88.254" {...field} />
                  </FormControl>
                  <FormDescription>
                    DHCP IP address range
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Network Config
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}