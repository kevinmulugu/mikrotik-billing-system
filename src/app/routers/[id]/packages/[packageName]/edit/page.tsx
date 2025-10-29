// src/app/routers/[id]/packages/[packageName]/edit/page.tsx
'use client';

import { use, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Package, Loader2, AlertTriangle, Info,
  Clock, Zap, HardDrive, DollarSign, Lock, Save
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EditPackagePageProps {
  params: Promise<{
    id: string;
    packageName: string;
  }>;
}

export default function EditPackagePage({ params }: EditPackagePageProps) {
  const { id: routerId, packageName } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [packageData, setPackageData] = useState<any>(null);
  const [routerData, setRouterData] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    displayName: '',
    description: '',
    price: '',
    duration: '',
    dataLimit: '',
    uploadSpeed: '',
    downloadSpeed: '',
    validity: '',
  });

  const [originalFormData, setOriginalFormData] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasRouterChanges, setHasRouterChanges] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPackageData();
    }
  }, [status, routerId, packageName]);

  const fetchPackageData = async () => {
    try {
      setLoading(true);

      // Fetch router data to get package info
      const routerResponse = await fetch(`/api/routers/${routerId}`);
      const routerDataResult = await routerResponse.json();

      if (!routerResponse.ok) {
        toast.error(routerDataResult.error || 'Failed to fetch router');
        return;
      }

      setRouterData(routerDataResult.router);

      // Find the specific package
      const pkg = routerDataResult.router.packages?.hotspot?.find(
        (p: any) => p.name === packageName
      );

      if (!pkg) {
        toast.error('Package not found');
        return;
      }

      setPackageData(pkg);

      // Initialize form with package data
      const initialData = {
        displayName: pkg.displayName || pkg.name,
        description: pkg.description || '',
        price: pkg.price?.toString() || '',
        duration: pkg.duration?.toString() || '',
        dataLimit: pkg.dataLimit?.toString() || '0',
        uploadSpeed: pkg.bandwidth?.upload?.toString() || '',
        downloadSpeed: pkg.bandwidth?.download?.toString() || '',
        validity: pkg.validity?.toString() || '30',
      };

      setFormData(initialData);
      setOriginalFormData(initialData);
    } catch (error) {
      console.error('Error fetching package:', error);
      toast.error('Failed to fetch package data');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Display name validation
    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    }

    // Price validation
    const price = parseFloat(formData.price);
    if (!formData.price || isNaN(price)) {
      newErrors.price = 'Valid price is required';
    } else if (price <= 0) {
      newErrors.price = 'Price must be greater than 0';
    } else if (price > 100000) {
      newErrors.price = 'Price seems too high. Maximum is KSh 100,000';
    }

    // Duration validation (in minutes)
    const duration = parseInt(formData.duration);
    if (!formData.duration || isNaN(duration)) {
      newErrors.duration = 'Valid duration is required';
    } else if (duration <= 0) {
      newErrors.duration = 'Duration must be greater than 0';
    } else if (duration > 525600) {
      newErrors.duration = 'Duration cannot exceed 1 year';
    }

    // Data limit validation (in MB, 0 = unlimited)
    const dataLimit = parseInt(formData.dataLimit);
    if (formData.dataLimit && isNaN(dataLimit)) {
      newErrors.dataLimit = 'Data limit must be a valid number';
    } else if (dataLimit < 0) {
      newErrors.dataLimit = 'Data limit cannot be negative';
    }

    // Upload speed validation
    const uploadSpeed = parseInt(formData.uploadSpeed);
    if (!formData.uploadSpeed || isNaN(uploadSpeed)) {
      newErrors.uploadSpeed = 'Valid upload speed is required';
    } else if (uploadSpeed <= 0) {
      newErrors.uploadSpeed = 'Upload speed must be greater than 0';
    } else if (uploadSpeed > 10000) {
      newErrors.uploadSpeed = 'Upload speed seems too high';
    }

    // Download speed validation
    const downloadSpeed = parseInt(formData.downloadSpeed);
    if (!formData.downloadSpeed || isNaN(downloadSpeed)) {
      newErrors.downloadSpeed = 'Valid download speed is required';
    } else if (downloadSpeed <= 0) {
      newErrors.downloadSpeed = 'Download speed must be greater than 0';
    } else if (downloadSpeed > 10000) {
      newErrors.downloadSpeed = 'Download speed seems too high';
    }

    // Validity validation (in days)
    const validity = parseInt(formData.validity);
    if (!formData.validity || isNaN(validity)) {
      newErrors.validity = 'Valid validity period is required';
    } else if (validity <= 0) {
      newErrors.validity = 'Validity must be greater than 0';
    } else if (validity > 365) {
      newErrors.validity = 'Validity cannot exceed 365 days';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Check if router-synced fields changed
    if (originalFormData) {
      const routerFields = ['duration', 'dataLimit', 'uploadSpeed', 'downloadSpeed'];
      const changedRouterFields = routerFields.some(f => {
        const currentValue = field === f ? value : formData[f as keyof typeof formData];
        return currentValue !== originalFormData[f];
      });
      setHasRouterChanges(changedRouterFields);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the form errors');
      return;
    }

    setSaving(true);

    try {
      const updateData = {
        displayName: formData.displayName.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        duration: parseInt(formData.duration),
        dataLimit: parseInt(formData.dataLimit),
        bandwidth: {
          upload: parseInt(formData.uploadSpeed),
          download: parseInt(formData.downloadSpeed),
        },
        validity: parseInt(formData.validity),
      };

      const response = await fetch(`/api/routers/${routerId}/packages/${packageName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to update package');
        return;
      }

      // Show appropriate message based on sync status
      const syncStatus = data.package?.syncStatus;

      if (syncStatus === 'synced') {
        toast.success('Package updated and synced to router successfully!');
      } else if (syncStatus === 'failed') {
        toast.warning('Package updated in database, but router sync failed. Please try syncing manually.');
      } else if (syncStatus === 'out_of_sync') {
        toast.success('Package updated! Sync to router to apply changes.');
      } else {
        toast.success('Package updated successfully!');
      }

      router.push(`/routers/${routerId}/packages/${packageName}`);
    } catch (error) {
      console.error('Error updating package:', error);
      toast.error('Failed to update package');
    } finally {
      setSaving(false);
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!packageData || !routerData) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle className="mx-auto h-16 w-16 text-red-500" />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Package not found</h2>
            <p className="text-muted-foreground">
              This package doesn't exist or you don't have access to it.
            </p>
          </div>
          <Button asChild>
            <Link href={`/routers/${routerId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Router
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/routers/${routerId}/packages/${packageName}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Edit Package</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {packageData.displayName || packageData.name}
          </p>
        </div>
      </div>

      {/* Info Alerts */}
      <div className="space-y-3">
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Package name cannot be changed to maintain data integrity and router configuration consistency.
          </AlertDescription>
        </Alert>

        {hasRouterChanges && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You've modified duration, data limit, or bandwidth settings. These changes require
              syncing to the router before they take effect. The package will be marked as "Out of Sync"
              after saving.
            </AlertDescription>
          </Alert>
        )}

        {packageData.activeUsers > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This package currently has {packageData.activeUsers} active users. Changes to bandwidth
              or limits will only affect new sessions.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Editable package identification and pricing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Package Name (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Package Name (Technical)
                <Badge variant="secondary" className="ml-2">Read-only</Badge>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  value={packageData.name}
                  disabled
                  className="pl-9 bg-muted cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Cannot be changed to maintain router configuration integrity.
              </p>
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName">
                Display Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="displayName"
                placeholder="e.g., 1 Hour Package, Daily Premium"
                value={formData.displayName}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                className={errors.displayName ? 'border-red-500' : ''}
              />
              {errors.displayName && (
                <p className="text-sm text-red-500">{errors.displayName}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Customer-facing name shown in vouchers and user interface.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the package benefits..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Marketing description for customers.
              </p>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="price">
                Price (KSh) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="price"
                  type="number"
                  placeholder="100"
                  min="1"
                  step="1"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                  className={`pl-9 ${errors.price ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.price && (
                <p className="text-sm text-red-500">{errors.price}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Price changes take effect immediately and don't require router sync.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Usage Limits (Router Sync Required) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Usage Limits
              <Badge variant="outline" className="text-xs">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Sync Required
              </Badge>
            </CardTitle>
            <CardDescription>
              Changes to these fields require syncing to the router
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration">
                Duration (Minutes) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="duration"
                  type="number"
                  placeholder="60"
                  min="1"
                  step="1"
                  value={formData.duration}
                  onChange={(e) => handleInputChange('duration', e.target.value)}
                  className={`pl-9 ${errors.duration ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.duration && (
                <p className="text-sm text-red-500">{errors.duration}</p>
              )}
              {formData.duration !== originalFormData?.duration && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Router sync required for this change
                </p>
              )}
            </div>

            {/* Data Limit */}
            <div className="space-y-2">
              <Label htmlFor="dataLimit">
                Data Limit (MB) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <HardDrive className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dataLimit"
                  type="number"
                  placeholder="0"
                  min="0"
                  step="100"
                  value={formData.dataLimit}
                  onChange={(e) => handleInputChange('dataLimit', e.target.value)}
                  className={`pl-9 ${errors.dataLimit ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.dataLimit && (
                <p className="text-sm text-red-500">{errors.dataLimit}</p>
              )}
              {formData.dataLimit !== originalFormData?.dataLimit && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Router sync required for this change
                </p>
              )}
            </div>

            {/* Validity */}
            <div className="space-y-2">
              <Label htmlFor="validity">
                Validity Period (Days) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="validity"
                type="number"
                placeholder="30"
                min="1"
                step="1"
                value={formData.validity}
                onChange={(e) => handleInputChange('validity', e.target.value)}
                className={errors.validity ? 'border-red-500' : ''}
              />
              {errors.validity && (
                <p className="text-sm text-red-500">{errors.validity}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Validity changes don't require router sync (managed by database).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Bandwidth Settings (Router Sync Required) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Bandwidth Settings
              <Badge variant="outline" className="text-xs">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Sync Required
              </Badge>
            </CardTitle>
            <CardDescription>
              Speed limit changes require syncing to the router
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Upload Speed */}
              <div className="space-y-2">
                <Label htmlFor="uploadSpeed">
                  Upload Speed (Mbps) <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Zap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="uploadSpeed"
                    type="number"
                    placeholder="1"
                    min="0.1"
                    step="0.1"
                    value={formData.uploadSpeed}
                    onChange={(e) => handleInputChange('uploadSpeed', e.target.value)}
                    className={`pl-9 ${errors.uploadSpeed ? 'border-red-500' : ''}`}
                  />
                </div>
                {errors.uploadSpeed && (
                  <p className="text-sm text-red-500">{errors.uploadSpeed}</p>
                )}
                {formData.uploadSpeed !== originalFormData?.uploadSpeed && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Sync required
                  </p>
                )}
              </div>

              {/* Download Speed */}
              <div className="space-y-2">
                <Label htmlFor="downloadSpeed">
                  Download Speed (Mbps) <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Zap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="downloadSpeed"
                    type="number"
                    placeholder="2"
                    min="0.1"
                    step="0.1"
                    value={formData.downloadSpeed}
                    onChange={(e) => handleInputChange('downloadSpeed', e.target.value)}
                    className={`pl-9 ${errors.downloadSpeed ? 'border-red-500' : ''}`}
                  />
                </div>
                {errors.downloadSpeed && (
                  <p className="text-sm text-red-500">{errors.downloadSpeed}</p>
                )}
                {formData.downloadSpeed !== originalFormData?.downloadSpeed && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Sync required
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}