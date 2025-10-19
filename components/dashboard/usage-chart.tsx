'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Users, Wifi } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

export function UsageChart() {
  const [metric, setMetric] = useState<'users' | 'data' | 'sessions'>('users');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 800));
        
        setData({
          users: {
            current: 127,
            peak: 89,
            change: 8.2,
            chartData: [45, 52, 38, 67, 73, 89, 76, 65, 58, 49, 67, 82],
          },
          data: {
            current: 1024 * 1024 * 1024 * 15.7, // 15.7GB
            peak: 1024 * 1024 * 1024 * 23.2, // 23.2GB
            change: -5.1,
            chartData: [12.3, 15.7, 14.2, 18.9, 16.1, 23.2, 19.7, 17.3, 15.8, 14.2, 16.7, 18.9],
          },
          sessions: {
            current: 234,
            peak: 156,
            change: 15.3,
            chartData: [89, 102, 76, 134, 145, 156, 142, 128, 115, 98, 132, 149],
          },
        });
      } catch (error) {
        console.error('Failed to fetch usage data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [metric]);

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

  const currentData = data?.[metric];
  const formatValue = (value: number) => {
    switch (metric) {
      case 'data':
        return formatBytes(value);
      case 'users':
      case 'sessions':
        return value.toString();
      default:
        return value.toString();
    }
  };

  const getIcon = () => {
    switch (metric) {
      case 'users':
        return Users;
      case 'data':
        return Activity;
      case 'sessions':
        return Wifi;
      default:
        return Activity;
    }
  };

  const IconComponent = getIcon();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <IconComponent className="h-5 w-5 text-blue-600" />
            Usage Analytics
          </CardTitle>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-2xl font-bold">
              {formatValue(currentData?.current || 0)}
            </span>
            <span className="text-sm text-gray-500">
              {metric === 'users' ? 'total users' : 
               metric === 'data' ? 'data usage' : 'sessions'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {([
            { key: 'users', label: 'Users', icon: Users },
            { key: 'data', label: 'Data', icon: Activity },
            { key: 'sessions', label: 'Sessions', icon: Wifi },
          ] as const).map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              variant={metric === key ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMetric(key)}
              className="h-8 w-8 p-0"
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-center text-gray-500">
            <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Usage chart will be rendered here</p>
            <p className="text-xs">Showing {metric} over time</p>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-sm text-gray-600">Current</p>
            <p className="text-lg font-semibold">
              {formatValue(currentData?.current || 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Peak</p>
            <p className="text-lg font-semibold">
              {formatValue(currentData?.peak || 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Change</p>
            <p className={`text-lg font-semibold ${
              (currentData?.change || 0) > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {(currentData?.change || 0) > 0 ? '+' : ''}{currentData?.change || 0}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}