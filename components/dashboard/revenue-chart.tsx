'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, TrendingUp, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ChartDataPoint {
  date: string;
  revenue: number;
  transactions: number;
}

export function RevenueChart() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');
  const [data, setData] = useState<{
    total: number;
    monthly: number;
    today: number;
    chartData: ChartDataPoint[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/analytics/dashboard');
        if (!res.ok) throw new Error('Failed to fetch analytics');
        const json = await res.json();

        const overview = json?.overview || {};
        const chart = json?.revenueChart || [];

        setData({
          total: overview.totalRevenue || 0,
          monthly: overview.monthlyRevenue || 0,
          today: overview.todayRevenue || 0,
          chartData: chart,
        });
      } catch (error) {
        console.error('Failed to fetch revenue data:', error);
        // Set empty data on error
        setData({
          total: 0,
          monthly: 0,
          today: 0,
          chartData: [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [period]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading revenue data...</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted/50 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Revenue Analytics
          </CardTitle>
          <div className="flex items-center gap-3 mt-2">
            <div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <span className="text-2xl font-bold">
                {formatCurrency(data?.total || 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={period === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('7d')}
          >
            7d
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Simple bar chart visualization */}
        <div className="h-64 flex items-end justify-between gap-2 px-2">
          {data?.chartData && data.chartData.length > 0 ? (
            data.chartData.map((point, index) => {
              const maxRevenue = Math.max(...data.chartData.map(p => p.revenue));
              const heightPercent = maxRevenue > 0 ? (point.revenue / maxRevenue) * 100 : 0;
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full bg-primary rounded-t hover:bg-primary/80 transition-colors relative group"
                    style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                  >
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-popover text-popover-foreground text-xs rounded px-2 py-1 whitespace-nowrap border shadow-md z-10">
                      <div className="font-semibold">{formatCurrency(point.revenue)}</div>
                      <div className="text-muted-foreground">{point.transactions} transactions</div>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(point.date).getDate()}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No revenue data available</p>
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Today</p>
            <p className="text-lg font-semibold">
              {formatCurrency(data?.today || 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">This Month</p>
            <p className="text-lg font-semibold">
              {formatCurrency(data?.monthly || 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">All Time</p>
            <p className="text-lg font-semibold">
              {formatCurrency(data?.total || 0)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}