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
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
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
import { MapPin, Power, Save } from "lucide-react"

const routerInfoSchema = z.object({
  name: z.string().min(1, "Router name is required").max(50, "Name too long"),
  model: z.string().min(1, "Model is required"),
  location: z.object({
    name: z.string().min(1, "Location name is required"),
    address: z.string().optional(),
    coordinates: z.object({
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
    }).optional(),
  }),
})

type RouterInfoForm = z.infer<typeof routerInfoSchema>

interface GeneralTabProps {
  router: {
    name: string
    model: string
    serialNumber: string
    location: {
      name: string
      address: string
      coordinates: {
        latitude: number
        longitude: number
      }
    }
  }
  onSave: (data: RouterInfoForm) => Promise<void>
  onRestart: () => Promise<void>
  saving: boolean
}

export function GeneralTab({ router, onSave, onRestart, saving }: GeneralTabProps) {
  const form = useForm<RouterInfoForm>({
    resolver: zodResolver(routerInfoSchema),
    defaultValues: {
      name: router.name || "",
      model: router.model || "",
      location: {
        name: router.location?.name || "",
        address: router.location?.address || "",
        coordinates: {
          latitude: router.location?.coordinates?.latitude || 0,
          longitude: router.location?.coordinates?.longitude || 0,
        },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Router Information</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Router Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Router" {...field} />
                    </FormControl>
                    <FormDescription>
                      Friendly name for this router
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input placeholder="hAP ac²" {...field} />
                    </FormControl>
                    <FormDescription>
                      MikroTik router model
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location.name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Home Office" className="pl-9" {...field} />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Location description
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">Serial Number</label>
                <Input value={router.serialNumber || 'N/A'} disabled />
                <p className="text-sm text-muted-foreground">Read-only</p>
              </div>
            </div>

            <FormField
              control={form.control}
              name="location.address"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="location.coordinates.latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="-1.2921"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location.coordinates.longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="36.8219"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
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
                  Save Router Info
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>

      <Separator />

      {/* Router Actions */}
      <div>
        <h3 className="text-lg font-medium mb-4">Router Actions</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <div className="font-medium">Restart Router</div>
              <div className="text-sm text-muted-foreground">
                Restart the router to apply configuration changes
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <Power className="h-4 w-4 mr-2" />
                  Restart
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restart Router</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will restart the router and temporarily disconnect all users. 
                    The router should come back online within 1-2 minutes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onRestart}>
                    Restart Router
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  )
}