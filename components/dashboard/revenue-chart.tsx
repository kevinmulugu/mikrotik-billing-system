'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export function RevenueChart() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch revenue data based on period
    const fetchData = async () => {
      setLoading(true);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock data
        setData({
          total: 45750,
          change: 12.5,
          chartData: [
            { date: '2024-01-01', revenue: 1200 },
            { date: '2024-01-02', revenue: 1800 },
            { date: '2024-01-03', revenue: 1500 },
            { date: '2024-01-04', revenue: 2200 },
            { date: '2024-01-05', revenue: 1900 },
            { date: '2024-01-06', revenue: 2500 },
            { date: '2024-01-07', revenue: 2100 },
          ],
        });
      } catch (error) {
        console.error('Failed to fetch revenue data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Revenue Analytics
          </CardTitle>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-2xl font-bold">
              {formatCurrency(data?.total || 0)}
            </span>
            <Badge variant={data?.change > 0 ? 'default' : 'destructive'}>
              {data?.change > 0 ? '+' : ''}{data?.change}%
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-center text-gray-500">
            <CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Revenue chart will be rendered here</p>
            <p className="text-xs">Using recharts or similar chart library</p>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-sm text-gray-600">Avg. Daily</p>
            <p className="text-lg font-semibold">
              {formatCurrency((data?.total || 0) / 30)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Peak Day</p>
            <p className="text-lg font-semibold">
              {formatCurrency(Math.max(...(data?.chartData?.map((d: any) => d.revenue) || [0])))}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Commission</p>
            <p className="text-lg font-semibold text-green-600">
              {formatCurrency((data?.total || 0) * 0.15)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}