// src/app/routers/[id]/packages/create/page.tsx
'use client';

import { use, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft, Package, Loader2, Info, AlertCircle,
  Clock, Zap, HardDrive, DollarSign
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CreatePackagePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function CreatePackagePage({ params }: CreatePackagePageProps) {
  const { id: routerId } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [routerData, setRouterData] = useState<any>(null);
  const [syncAfterCreate, setSyncAfterCreate] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    price: '',
    duration: '',
    dataLimit: '0',
    uploadSpeed: '',
    downloadSpeed: '',
    validity: '30',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchRouterData();
    }
  }, [status, routerId]);

  const fetchRouterData = async () => {
    try {
      const response = await fetch(`/api/routers/${routerId}`);
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to fetch router');
        return;
      }

      setRouterData(data.router);
    } catch (error) {
      console.error('Error fetching router:', error);
      toast.error('Failed to fetch router data');
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Name validation (RouterOS naming rules)
    if (!formData.name.trim()) {
      newErrors.name = 'Package name is required';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.name)) {
      newErrors.name = 'Name can only contain letters, numbers, hyphens, and underscores';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Name must be 50 characters or less';
    }

    // Check for duplicate names
    if (routerData?.packages?.hotspot) {
      const duplicate = routerData.packages.hotspot.find(
        (pkg: any) => pkg.name.toLowerCase() === formData.name.toLowerCase()
      );
      if (duplicate) {
        newErrors.name = 'A package with this name already exists';
      }
    }

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
    } else if (duration > 525600) { // 1 year in minutes
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the form errors');
      return;
    }

    setLoading(true);

    try {
      const packageData = {
        name: formData.name.trim(),
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
        syncToRouter: syncAfterCreate,
      };

      const response = await fetch(`/api/routers/${routerId}/packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packageData),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to create package');
        return;
      }

      toast.success(
        syncAfterCreate 
          ? 'Package created and synced to router successfully!' 
          : 'Package created! Remember to sync it to the router.'
      );

      router.push(`/routers/${routerId}/packages/${formData.name}`);
    } catch (error) {
      console.error('Error creating package:', error);
      toast.error('Failed to create package');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!routerData) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="mx-auto h-16 w-16 text-red-500" />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Router not found</h2>
            <p className="text-muted-foreground">
              Cannot create package for this router.
            </p>
          </div>
          <Button asChild>
            <Link href="/routers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Routers
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
          <Link href={`/routers/${routerId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Create New Package</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a WiFi package for {routerData.name}
          </p>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Package names cannot be changed after creation. Choose a descriptive technical name 
          (e.g., "1hour-10ksh", "daily-premium"). Use the display name for customer-facing text.
        </AlertDescription>
      </Alert>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Package identification and pricing details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Package Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Package Name (Technical) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., 1hour-10ksh, daily-premium"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Used in router configuration. Only letters, numbers, hyphens, and underscores.
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
            </div>
          </CardContent>
        </Card>

        {/* Usage Limits */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Limits</CardTitle>
            <CardDescription>
              Define time and data restrictions for this package
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
              <p className="text-xs text-muted-foreground">
                Common values: 60 (1h), 180 (3h), 720 (12h), 1440 (24h), 10080 (7d), 43200 (30d)
              </p>
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
              <p className="text-xs text-muted-foreground">
                Set to 0 for unlimited data. Otherwise specify in megabytes (e.g., 1024 = 1GB).
              </p>
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
                How many days after purchase before voucher expires if unused.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Bandwidth Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Bandwidth Settings</CardTitle>
            <CardDescription>
              Configure upload and download speed limits
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
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Typical values: 0.5-2 Mbps (basic), 2-5 Mbps (standard), 5-10 Mbps (premium)
            </p>
          </CardContent>
        </Card>

        {/* Sync Option */}
        <Card>
          <CardHeader>
            <CardTitle>Router Synchronization</CardTitle>
            <CardDescription>
              Choose whether to sync this package to the router immediately
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="syncAfterCreate">Sync to Router After Creation</Label>
                <p className="text-sm text-muted-foreground">
                  {syncAfterCreate 
                    ? 'Package will be immediately available for voucher generation'
                    : 'You can manually sync the package later from the package details page'
                  }
                </p>
              </div>
              <Switch
                id="syncAfterCreate"
                checked={syncAfterCreate}
                onCheckedChange={setSyncAfterCreate}
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Package className="mr-2 h-4 w-4" />
                Create Package
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}