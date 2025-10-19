// src/app/routers/[id]/vouchers/page.tsx
'use client'

import React, { use, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { VoucherList } from '@/components/vouchers/voucher-list'
import { VoucherStats } from '@/components/vouchers/voucher-stats'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { 
  ArrowLeft, 
  Ticket, 
  Plus, 
  Download,
  RefreshCw,
  Loader2
} from 'lucide-react'

interface VouchersPageProps {
  params: Promise<{
    id: string
  }>
}

export default function VouchersPage({ params }: VouchersPageProps) {
  const { id } = use(params)
  const { data: session } = useSession()
  const router = useRouter()
  const [showSyncDialog, setShowSyncDialog] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResults, setSyncResults] = useState<any>(null)

  // Handle bulk sync
  const handleBulkSync = async () => {
    try {
      setSyncing(true)
      
      const response = await fetch(`/api/routers/${id}/vouchers/bulk-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to sync vouchers')
      }

      const data = await response.json()
      setSyncResults(data.results)
      
      if (data.results.failed === 0) {
        toast.success(`Successfully synced ${data.results.synced} vouchers to router`)
      } else if (data.results.synced > 0) {
        toast.warning(
          `Synced ${data.results.synced} vouchers, ${data.results.failed} failed. Check details.`
        )
      } else {
        toast.error(`Failed to sync vouchers. ${data.results.failed} errors occurred.`)
      }
    } catch (error) {
      console.error('Error syncing vouchers:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to sync vouchers')
    } finally {
      setSyncing(false)
      setShowSyncDialog(false)
    }
  }

  if (!session) {
    router.push('/signin')
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <a href={`/routers/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Ticket className="h-6 w-6 text-blue-600" />
            Voucher Management
          </h1>
          <p className="text-gray-600 mt-1">
            Generate, manage, and track your hotspot vouchers
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/routers/${id}/vouchers/export`}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </a>
          </Button>
          <Button asChild>
            <a href={`/routers/${id}/vouchers/generate`}>
              <Plus className="h-4 w-4 mr-2" />
              Generate
            </a>
          </Button>
        </div>
      </div>

      {/* Stats Component - Fetches real data */}
      <VoucherStats routerId={id} />

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" asChild>
              <a href={`/routers/${id}/vouchers/generate`}>
                <Plus className="h-4 w-4 mr-2" />
                Generate New Vouchers
              </a>
            </Button>
            
            <Button className="w-full justify-start" variant="outline" asChild>
              <a href={`/routers/${id}/vouchers/history`}>
                <Ticket className="h-4 w-4 mr-2" />
                View Sales History
              </a>
            </Button>
            
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => setShowSyncDialog(true)}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync All Vouchers
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Router Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Router Status</span>
              <Badge variant="default">Online</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Active Packages</span>
              <span className="font-semibold">8</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last Sync</span>
              <span className="text-sm">Just now</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Voucher Management Tabs */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="used">Used</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <VoucherList routerId={id} filterStatus="all" />
        </TabsContent>

        <TabsContent value="active">
          <VoucherList routerId={id} filterStatus="active" />
        </TabsContent>

        <TabsContent value="used">
          <VoucherList routerId={id} filterStatus="used" />
        </TabsContent>

        <TabsContent value="expired">
          <VoucherList routerId={id} filterStatus="expired" />
        </TabsContent>

        <TabsContent value="cancelled">
          <VoucherList routerId={id} filterStatus="cancelled" />
        </TabsContent>
      </Tabs>
    </div>
  );
}