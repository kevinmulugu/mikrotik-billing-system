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
import { Network, Save } from "lucide-react"

const pppoeConfigSchema = z.object({
  enabled: z.boolean(),
  interface: z.string().min(1, "Interface is required"),
  ipPool: z.string().min(1, "IP pool is required"),
  dnsServers: z.array(z.string()),
  defaultProfile: z.string().min(1, "Default profile is required"),
})

type PPPoEConfigForm = z.infer<typeof pppoeConfigSchema>

interface PPPoETabProps {
  pppoe: {
    enabled: boolean
    interface: string
    ipPool: string
    dnsServers: string[]
    defaultProfile: string
  }
  onSave: (data: PPPoEConfigForm) => Promise<void>
  saving: boolean
}

export function PPPoETab({ pppoe, onSave, saving }: PPPoETabProps) {
  const form = useForm<PPPoEConfigForm>({
    resolver: zodResolver(pppoeConfigSchema),
    defaultValues: {
      enabled: pppoe.enabled ?? false,
      interface: pppoe.interface || "ether1",
      ipPool: pppoe.ipPool || "10.10.10.0/24",
      dnsServers: pppoe.dnsServers || ["8.8.8.8", "8.8.4.4"],
      defaultProfile: pppoe.defaultProfile || "default",
    },
  })

  const isEnabled = form.watch("enabled")

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">PPPoE Configuration</h3>
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
                  <FormLabel>Enable PPPoE Service</FormLabel>
                  <FormDescription>
                    Enable PPPoE server for subscriber accounts
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
                  name="interface"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interface</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Network className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="ether2" className="pl-9" {...field} />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Network interface for PPPoE server
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
                        <Input placeholder="10.10.10.0/24" {...field} />
                      </FormControl>
                      <FormDescription>
                        IP pool for PPPoE users
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defaultProfile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Profile</FormLabel>
                      <FormControl>
                        <Input placeholder="default-pppoe" {...field} />
                      </FormControl>
                      <FormDescription>
                        Default PPP profile for new users
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
                Save PPPoE Config
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}