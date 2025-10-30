// src/components/vouchers/voucher-generator.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Ticket, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { toast } from 'sonner';

interface Package {
  name: string;
  displayName: string;
  price: number;
  duration: number; // in minutes
  bandwidth: {
    upload: number;
    download: number;
  };
  syncStatus?: string;
}

interface VoucherGeneratorProps {
  routerId: string;
}

export function VoucherGenerator({ routerId }: VoucherGeneratorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetchingPackages, setFetchingPackages] = useState(true);
  const [packages, setPackages] = useState<Package[]>([]);

  // Form state
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('10');
  const [autoExpire, setAutoExpire] = useState<boolean>(false);
  const [expiryDays, setExpiryDays] = useState<string>('30');
  const [usageTimedOnPurchase, setUsageTimedOnPurchase] = useState<boolean>(false);
  const [syncToRouter, setSyncToRouter] = useState<boolean>(true);

  // Result state
  const [generationResult, setGenerationResult] = useState<any>(null);

  // Fetch available packages from router
  useEffect(() => {
    fetchPackages();
  }, [routerId]);

  const fetchPackages = async () => {
    try {
      setFetchingPackages(true);
      const response = await fetch(`/api/routers/${routerId}`);
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to fetch router packages');
        return;
      }

      const hotspotPackages = data.router?.packages?.hotspot || [];

      if (hotspotPackages.length === 0) {
        toast.error('No packages found on router. Please sync packages first.');
        return;
      }

      // Filter only synced packages
      const syncedPackages = hotspotPackages.filter(
        (pkg: Package) => pkg.syncStatus === 'synced'
      );

      if (syncedPackages.length === 0) {
        toast.error('No synced packages found. Please sync packages to router first.');
      }

      setPackages(syncedPackages);

      // Auto-select first package
      if (syncedPackages.length > 0) {
        setSelectedPackage(syncedPackages[0].name);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
      toast.error('Failed to fetch packages');
    } finally {
      setFetchingPackages(false);
    }
  };

  // Convert minutes to human-readable format
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) {
      const hours = minutes / 60;
      return `${hours}${hours === 1 ? ' hour' : ' hours'}`;
    }
    if (minutes < 10080) {
      const days = minutes / 1440;
      return `${days}${days === 1 ? ' day' : ' days'}`;
    }
    const weeks = minutes / 10080;
    return `${weeks}${weeks === 1 ? ' week' : ' weeks'}`;
  };

  // Get selected package details
  const getSelectedPackageDetails = (): Package | null => {
    return packages.find((pkg) => pkg.name === selectedPackage) || null;
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!selectedPackage) {
      toast.error('Please select a package');
      return false;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 1000) {
      toast.error('Quantity must be between 1 and 1000');
      return false;
    }



    if (autoExpire) {
      const expiry = parseInt(expiryDays);
      if (isNaN(expiry) || expiry < 1 || expiry > 365) {
        toast.error('Expiry days must be between 1 and 365');
        return false;
      }
    }

    return true;
  };

  // Handle voucher generation
  const handleGenerate = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setGenerationResult(null);

    try {
      const response = await fetch(`/api/routers/${routerId}/vouchers/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageName: selectedPackage,
          quantity: parseInt(quantity),
          autoExpire,
          expiryDays: autoExpire ? parseInt(expiryDays) : null,
          usageTimedOnPurchase,
          syncToRouter,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to generate vouchers');
        return;
      }

      setGenerationResult(data);
      toast.success(`Successfully generated ${data.vouchers.length} vouchers!`);

      // Show sync warnings if any failed
      if (syncToRouter && data.routerSync?.failed > 0) {
        toast.warning(
          `${data.routerSync.failed} vouchers failed to sync to router. They can be synced manually later.`
        );
      }
    } catch (error) {
      console.error('Error generating vouchers:', error);
      toast.error('Failed to generate vouchers');
    } finally {
      setLoading(false);
    }
  };

  // Download vouchers as CSV
  const handleDownloadCSV = () => {
    if (!generationResult?.vouchers) return;

    const csvContent = [
      ['Payment Reference', 'Code', 'Password', 'Package', 'Duration', 'Price', 'Expires'],
      ...generationResult.vouchers.map((v: any) => [
        v.reference,
        v.code,
        v.password,
        v.packageDisplayName,
        v.duration,
        `KSh ${v.price}`,
        v.expiresAt ? new Date(v.expiresAt).toLocaleDateString() : 'Never',
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vouchers-${generationResult.batchId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success('Vouchers downloaded successfully');
  };

  // Calculate totals
  const selectedPkg = getSelectedPackageDetails();
  const totalValue = selectedPkg ? selectedPkg.price * parseInt(quantity || '0') : 0;

  if (fetchingPackages) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (packages.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">No Packages Available</h3>
              <p className="text-sm text-muted-foreground">
                You need to create and sync packages to the router before generating vouchers.
              </p>
            </div>
            <Button onClick={() => router.push(`/routers/${routerId}`)}>
              Go to Router Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Generation Form */}
      <Card>
        <CardHeader>
          <CardTitle>Voucher Configuration</CardTitle>
          <CardDescription>
            Select package type and quantity for voucher generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Package Selection */}
          <div className="space-y-2">
            <Label htmlFor="package">Select Package *</Label>
            <Select value={selectedPackage} onValueChange={setSelectedPackage}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a package..." />
              </SelectTrigger>
              <SelectContent>
                {packages.map((pkg) => (
                  <SelectItem key={pkg.name} value={pkg.name}>
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium">{pkg.displayName}</span>
                      <span className="text-muted-foreground text-xs">
                        KSh {pkg.price} • {formatDuration(pkg.duration)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPkg && (
              <div className="mt-3 p-3 bg-muted rounded-lg space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-medium">{formatDuration(selectedPkg.duration)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price:</span>
                  <span className="font-medium text-green-600">KSh {selectedPkg.price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Speed:</span>
                  <span className="font-medium">
                    {selectedPkg.bandwidth.upload}M ↑ / {selectedPkg.bandwidth.download}M ↓
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max="1000"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity (1-1000)"
            />
            <p className="text-xs text-muted-foreground">
              Number of vouchers to generate (max 1000)
            </p>
          </div>

          {/* Auto Expiry */}
          <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
            <div className="flex-1">
              <Label htmlFor="autoExpire" className="font-medium">
                Auto Expire Vouchers
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Automatically expire unused vouchers after specified days (prevents stale/hoarded vouchers)
              </p>
            </div>
            <Switch
              id="autoExpire"
              checked={autoExpire}
              onCheckedChange={setAutoExpire}
            />
          </div>

          {/* Expiry Days */}
          {autoExpire && (
            <div className="space-y-2">
              <Label htmlFor="expiryDays">Expiry Period (Days)</Label>
              <Input
                id="expiryDays"
                type="number"
                min="1"
                max="365"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                placeholder="Days until expiry"
              />
              <p className="text-xs text-muted-foreground">
                Unused vouchers will expire after this many days (1-365)
              </p>
            </div>
          )}

          {/* Usage deadline on purchase */}
          <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
            <div className="flex-1">
              <Label htmlFor="usageTimedOnPurchase" className="font-medium">
                Time usage after purchase
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Voucher expires automatically after the package duration elapses from purchase time. For example, a 1-hour package purchased at 7am expires at 8am, even if unused or partially used.
              </p>
            </div>
            <Switch
              id="usageTimedOnPurchase"
              checked={usageTimedOnPurchase}
              onCheckedChange={setUsageTimedOnPurchase}
            />
          </div>

          {/* Note: Auto Terminate behavior is handled by the cron expiry job for both Auto Expire and Time-usage-after-purchase options. */}

          {/* Sync to Router */}
          <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
            <div className="flex-1">
              <Label htmlFor="syncToRouter" className="font-medium">
                Sync to Router Immediately
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Create hotspot users on router. Disable if router is offline.
              </p>
            </div>
            <Switch
              id="syncToRouter"
              checked={syncToRouter}
              onCheckedChange={setSyncToRouter}
            />
          </div>

          {/* Summary */}
          {selectedPkg && parseInt(quantity || '0') > 0 && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4 space-y-2">
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Generation Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-300">Package:</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    {selectedPkg.displayName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-300">Quantity:</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    {quantity} vouchers
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-300">Unit Price:</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    KSh {selectedPkg.price}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-blue-300 dark:border-blue-800">
                  <span className="font-semibold text-blue-900 dark:text-blue-100">Total Value:</span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    KSh {totalValue.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={loading || !selectedPackage || parseInt(quantity || '0') < 1}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Vouchers...
              </>
            ) : (
              <>
                <Ticket className="mr-2 h-4 w-4" />
                Generate {quantity} Vouchers
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generation Results */}
      {generationResult && (
        <Card className="border-green-200 dark:border-green-900">
          <CardHeader className="bg-green-50 dark:bg-green-950/20">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-green-900 dark:text-green-100">
                Vouchers Generated Successfully!
              </CardTitle>
            </div>
            <CardDescription>
              Batch ID: {generationResult.batchId}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {/* Summary Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Generated</p>
                <p className="text-2xl font-bold">{generationResult.summary.totalGenerated}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold text-green-600">
                  KSh {generationResult.summary.totalValue.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Commission</p>
                <p className="text-2xl font-bold text-purple-600">
                  KSh {generationResult.summary.commission.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Sync Status */}
            {generationResult.routerSync?.enabled && (
              <Alert>
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Router Sync Status:</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-green-600">
                        ✓ {generationResult.routerSync.synced} synced
                      </span>
                      {generationResult.routerSync.failed > 0 && (
                        <span className="text-red-600">
                          ✗ {generationResult.routerSync.failed} failed
                        </span>
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={handleDownloadCSV} variant="outline" className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Download CSV
              </Button>
              <Button
                onClick={() => router.push(`/routers/${routerId}/vouchers`)}
                className="flex-1"
              >
                View All Vouchers
              </Button>
            </div>

            {/* Payment Reference Info */}
            <Alert>
              <AlertDescription className="text-sm">
                <p className="font-medium mb-1">📱 Payment Reference</p>
                <p className="text-muted-foreground">
                  The <span className="font-mono text-blue-600">Payment Reference</span> is used for M-Pesa payments
                  (as BillRefNumber). After payment confirmation, share the actual voucher code
                  (username/password) with your customer.
                </p>
              </AlertDescription>
            </Alert>

            {/* Preview vouchers (first 5) */}
            <div className="rounded-lg border p-4 space-y-2">
              <p className="font-medium text-sm">Sample Vouchers (first 5):</p>
              <div className="space-y-2 text-xs">
                {generationResult.vouchers.slice(0, 5).map((v: any) => (
                  <div key={v.code} className="space-y-1 py-2 border-b last:border-0">
                    <div className="flex justify-between font-mono">
                      <span className="text-muted-foreground">Payment Ref:</span>
                      <span className="font-semibold text-blue-600">{v.reference}</span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span className="text-muted-foreground">Code:</span>
                      <span>{v.code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Package:</span>
                      <span>{v.packageDisplayName}</span>
                    </div>
                  </div>
                ))}
              </div>
              {generationResult.vouchers.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  ...and {generationResult.vouchers.length - 5} more
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}