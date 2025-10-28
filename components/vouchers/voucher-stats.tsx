// src/components/vouchers/voucher-stats.tsx
"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Ticket,
  CheckCircle,
  Clock,
  DollarSign,
  TrendingUp,
  AlertCircle,
} from "lucide-react"

interface VoucherStatsProps {
  routerId: string
}

interface Stats {
  vouchers: {
    total: number
    active: number
    used: number
    expired: number
    cancelled: number
  }
  revenue: {
    total: number
    commission: number
    net: number
    today: number
    week: number
    month: number
  }
  usage: {
    used: number
    unused: number
    percentage: number
    totalDataUsed: number
  }
}

export function VoucherStats({ routerId }: VoucherStatsProps) {
  const { data: session } = useSession()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session && routerId) {
      fetchStats()
    }
  }, [session, routerId])

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/routers/${routerId}/vouchers/stats`, {
        headers: {
          'Authorization': `Bearer ${session?.user?.id}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch statistics')
      }

      const data = await response.json()
      setStats(data.stats)
    } catch (err) {
      console.error('Error fetching stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <>
      {/* Primary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Vouchers</p>
                <p className="text-2xl font-semibold">
                  {stats.vouchers.total}
                </p>
              </div>
              <Ticket className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-semibold text-green-600">
                  {stats.vouchers.active}
                </p>
              </div>
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Used</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {stats.vouchers.used}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats.usage.percentage}% usage rate
                </p>
              </div>
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today Revenue</p>
                <p className="text-2xl font-semibold text-purple-600">
                  {formatCurrency(stats.revenue.today)}
                </p>
              </div>
              <DollarSign className="h-5 w-5 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-lg">Revenue Summary</h3>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">This Week</p>
              <p className="text-xl font-semibold">
                {formatCurrency(stats.revenue.week)}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">This Month</p>
              <p className="text-xl font-semibold">
                {formatCurrency(stats.revenue.month)}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
              <p className="text-xl font-semibold">
                {formatCurrency(stats.revenue.total)}
              </p>
              <p className="text-sm text-green-600">
                Commission: {formatCurrency(stats.revenue.commission)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}