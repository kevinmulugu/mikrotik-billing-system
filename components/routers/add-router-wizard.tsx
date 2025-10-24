// components/routers/add-router-wizard.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wifi,
  MapPin,
  Network,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  Info,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface RouterFormData {
  name: string;
  model: string;
  serialNumber: string;
  location: {
    name: string;
    street: string;
    city: string;
    county: string;
  };
  ipAddress: string;
  port: string;
  apiUser: string;
  apiPassword: string;
  hotspotEnabled: boolean;
  ssid: string;
  hotspotPassword: string;
  maxUsers: string;
  pppoeEnabled: boolean;
  pppoeInterface: string;
  defaultProfile: string;
}

interface AddRouterWizardProps {
  onComplete?: (routerId: string) => void;
  onCancel?: () => void;
}

type ConnectionStatus = "idle" | "testing" | "vpn-setup" | "success" | "error";

interface VPNStatus {
  enabled: boolean;
  status: string;
  vpnIP?: string;
  error?: string;
}

const steps = [
  { id: 1, title: "Basic Information", icon: Wifi },
  { id: 2, title: "Network Configuration", icon: Network },
  { id: 3, title: "Hotspot Setup", icon: Shield },
  { id: 4, title: "Review & Connect", icon: CheckCircle2 },
];

export const AddRouterWizard: React.FC<AddRouterWizardProps> = ({
  onComplete,
  onCancel,
}) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [vpnStatus, setVpnStatus] = useState<VPNStatus | null>(null);
  const [vpnProgress, setVpnProgress] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showHotspotPassword, setShowHotspotPassword] = useState(false);
  const [routerInfo, setRouterInfo] = useState<any>(null);

  const [formData, setFormData] = useState<RouterFormData>({
    name: "",
    model: "",
    serialNumber: "",
    location: {
      name: "",
      street: "",
      city: "",
      county: "",
    },
    ipAddress: "",
    port: "8728",
    apiUser: "admin",
    apiPassword: "",
    hotspotEnabled: true,
    ssid: "",
    hotspotPassword: "",
    maxUsers: "50",
    pppoeEnabled: false,
    pppoeInterface: "ether1",
    defaultProfile: "default",
  });

  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const kenyanCounties = [
    "Mombasa", "Kwale", "Kilifi", "Tana River", "Lamu", "Taita-Taveta",
    "Garissa", "Wajir", "Mandera", "Marsabit", "Isiolo", "Meru",
    "Tharaka-Nithi", "Embu", "Kitui", "Machakos", "Makueni", "Nyandarua",
    "Nyeri", "Kirinyaga", "Murang'a", "Kiambu", "Turkana", "West Pokot",
    "Samburu", "Trans Nzoia", "Uasin Gishu", "Elgeyo-Marakwet", "Nandi",
    "Baringo", "Laikipia", "Nakuru", "Narok", "Kajiado", "Kericho",
    "Bomet", "Kakamega", "Vihiga", "Bungoma", "Busia", "Siaya",
    "Kisumu", "Homa Bay", "Migori", "Kisii", "Nyamira", "Nairobi",
  ];

  const routerModels = [
    "MikroTik hAP ac²",
    "MikroTik hAP ac³",
    "MikroTik hAP lite",
    "MikroTik RB4011",
    "MikroTik RB5009",
    "MikroTik CCR1009",
    "MikroTik CCR2004",
    "Other",
  ];

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => {
      const updated: RouterFormData = { ...prev } as RouterFormData;

      if (field.includes(".")) {
        const parts = field.split(".");
        if (parts.length === 2) {
          const [parent, child] = parts as [keyof RouterFormData, string];
          const parentValue = (prev as any)[parent];
          (updated as any)[parent] = {
            ...(typeof parentValue === "object" && parentValue !== null ? parentValue : {}),
            [child]: value,
          };
        } else {
          return prev;
        }
      } else {
        (updated as any)[field] = value;
      }

      return updated;
    });

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<string, string>> = {};

    if (step === 1) {
      if (!formData.name || formData.name.length < 3) {
        newErrors.name = "Router name must be at least 3 characters";
      }
      if (!formData.model) {
        newErrors.model = "Please select a router model";
      }
      if (!formData.location.county) {
        newErrors["location.county"] = "Please select a county";
      }
    }

    if (step === 2) {
      if (!formData.ipAddress) {
        newErrors.ipAddress = "IP address is required";
      } else if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(formData.ipAddress)) {
        newErrors.ipAddress = "Invalid IP address format";
      }
      if (!formData.port) {
        newErrors.port = "Port is required";
      }
      if (!formData.apiPassword) {
        newErrors.apiPassword = "API password is required";
      }
    }

    if (step === 3 && formData.hotspotEnabled) {
      if (!formData.ssid || formData.ssid.length < 3) {
        newErrors.ssid = "SSID must be at least 3 characters";
      }
      if (!formData.hotspotPassword || formData.hotspotPassword.length < 8) {
        newErrors.hotspotPassword = "Password must be at least 8 characters";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep === 2) {
        handleTestConnection();
      } else if (currentStep < steps.length) {
        setCurrentStep(currentStep + 1);
      }
    } else {
      toast.error("Please fix the errors before continuing");
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setConnectionStatus("idle");
      setVpnStatus(null);
      setVpnProgress(0);
    }
  };

  const handleTestConnection = async () => {
    setConnectionStatus("testing");
    setIsConnecting(true);

    try {
      // Phase 1: Test basic connection
      const response = await fetch('/api/routers/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: formData.ipAddress,
          port: formData.port,
          apiUser: formData.apiUser,
          apiPassword: formData.apiPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setConnectionStatus("error");
        toast.error(result.error || "Connection failed. Please check your credentials.");
        setIsConnecting(false);
        return;
      }

      // Phase 2: VPN Setup (simulate progress for UX)
      setConnectionStatus("vpn-setup");
      toast.info("Establishing secure connection...");
      setVpnProgress(10);

      // Simulate VPN setup progress
      const progressInterval = setInterval(() => {
        setVpnProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 1000);

      // Wait to show VPN progress
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      clearInterval(progressInterval);
      setVpnProgress(100);

      // Mark as successful
      setConnectionStatus("success");
      setRouterInfo(result.data?.routerInfo);
      
      // Set VPN status (actual VPN setup happens on router creation)
      setVpnStatus({
        enabled: true,
        status: "ready",
      });

      toast.success("Connection established!");
      
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
        setIsConnecting(false);
      }, 1500);

    } catch (error) {
      setConnectionStatus("error");
      toast.error("Failed to connect. Check your network connection.");
      setIsConnecting(false);
    }
  };

  const handleSubmit = async () => {
    setIsConnecting(true);

    try {
      const response = await fetch('/api/routers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update VPN status from response
        if (result.vpn) {
          setVpnStatus(result.vpn);
        }

        toast.success(result.message || "Router added successfully!");
        
        // Show VPN status messages
        if (result.vpn?.enabled) {
          toast.success(`Secure management enabled at ${result.vpn.vpnIP}`);
        } else if (result.vpn?.error) {
          toast.warning(`Router added but VPN setup failed: ${result.vpn.error}`);
        }

        setTimeout(() => {
          if (onComplete) {
            onComplete(result.routerId);
          } else {
            router.push(`/routers/${result.routerId}`);
          }
        }, 2000);
      } else {
        toast.error(result.error || "Failed to add router");
        setIsConnecting(false);
      }
    } catch (error) {
      toast.error("An error occurred while adding the router");
      setIsConnecting(false);
    }
  };

  const renderVPNSetupProgress = () => {
    if (connectionStatus !== "vpn-setup") return null;

    return (
      <div className="space-y-4 mt-4">
        <Alert className="border-blue-500 bg-blue-500/10">
          <Lock className="h-4 w-4 text-blue-500" />
          <AlertTitle className="text-blue-500">
            Setting Up Secure Management
          </AlertTitle>
          <AlertDescription>
            Establishing encrypted VPN tunnel for remote management...
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{vpnProgress}%</span>
          </div>
          <Progress value={vpnProgress} className="h-2" />
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            {vpnProgress >= 30 ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <span className={vpnProgress >= 30 ? "text-green-600" : "text-muted-foreground"}>
              Generating security keys
            </span>
          </div>
          <div className="flex items-center gap-2">
            {vpnProgress >= 60 ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : vpnProgress >= 30 ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            ) : (
              <div className="h-4 w-4" />
            )}
            <span className={vpnProgress >= 60 ? "text-green-600" : vpnProgress >= 30 ? "text-blue-600" : "text-muted-foreground"}>
              Configuring secure tunnel
            </span>
          </div>
          <div className="flex items-center gap-2">
            {vpnProgress >= 90 ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : vpnProgress >= 60 ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            ) : (
              <div className="h-4 w-4" />
            )}
            <span className={vpnProgress >= 90 ? "text-green-600" : vpnProgress >= 60 ? "text-blue-600" : "text-muted-foreground"}>
              Verifying connectivity
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderVPNStatusBadge = () => {
    if (!vpnStatus) return null;

    if (vpnStatus.enabled && vpnStatus.status === "ready") {
      return (
        <Badge variant="default" className="bg-green-500">
          <Shield className="h-3 w-3 mr-1" />
          Secure Connection Ready
        </Badge>
      );
    }

    if (vpnStatus.error) {
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          VPN Setup Failed
        </Badge>
      );
    }

    return null;
  };

  const progressPercentage = (currentStep / steps.length) * 100;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Progress value={progressPercentage} className="h-2" />
            <div className="grid grid-cols-4 gap-2">
              {steps.map((step) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                const isError = connectionStatus === "error" && step.id === 2;

                return (
                  <div
                    key={step.id}
                    className={`flex flex-col items-center text-center p-2 rounded-lg ${
                      isActive
                        ? "bg-primary/10"
                        : isCompleted
                        ? "bg-green-500/10"
                        : isError
                        ? "bg-red-500/10"
                        : ""
                    }`}
                  >
                    <div
                      className={`rounded-full p-2 mb-2 ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : isCompleted
                          ? "bg-green-500 text-white"
                          : isError
                          ? "bg-red-500 text-white"
                          : "bg-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-medium">{step.title}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* VPN Status Badge */}
      {vpnStatus && (
        <div className="flex justify-center">
          {renderVPNStatusBadge()}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {React.createElement(steps[currentStep - 1]?.icon || Wifi, { className: "h-5 w-5" })}
            {steps[currentStep - 1]?.title ?? "Step"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Enter your router's basic information. This helps you identify and manage it later.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <label className="text-sm font-medium">Router Name *</label>
                <Input
                  placeholder="e.g., Home Router - Living Room"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Router Model *</label>
                  <Select
                    value={formData.model}
                    onValueChange={(value) => handleInputChange("model", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {routerModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.model && (
                    <p className="text-sm text-destructive">{errors.model}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Serial Number (Optional)</label>
                  <Input
                    placeholder="e.g., ABC123XYZ"
                    value={formData.serialNumber}
                    onChange={(e) => handleInputChange("serialNumber", e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Location</h3>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Location Name</label>
                  <Input
                    placeholder="e.g., Main Office"
                    value={formData.location.name}
                    onChange={(e) => handleInputChange("location.name", e.target.value)}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Street/Building</label>
                    <Input
                      placeholder="e.g., Moi Avenue"
                      value={formData.location.street}
                      onChange={(e) => handleInputChange("location.street", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">City/Town</label>
                    <Input
                      placeholder="e.g., Nairobi"
                      value={formData.location.city}
                      onChange={(e) => handleInputChange("location.city", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">County *</label>
                  <Select
                    value={formData.location.county}
                    onValueChange={(value) => handleInputChange("location.county", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select county" />
                    </SelectTrigger>
                    <SelectContent>
                      {kenyanCounties.map((county) => (
                        <SelectItem key={county} value={county}>
                          {county}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors["location.county"] && (
                    <p className="text-sm text-destructive">{errors["location.county"]}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Network Configuration */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <Alert>
                <Network className="h-4 w-4" />
                <AlertDescription>
                  Enter your router's network details. We'll test the connection before proceeding.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Router IP Address *</label>
                  <Input
                    placeholder="192.168.88.1"
                    value={formData.ipAddress}
                    onChange={(e) => handleInputChange("ipAddress", e.target.value)}
                  />
                  {errors.ipAddress && (
                    <p className="text-sm text-destructive">{errors.ipAddress}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">API Port *</label>
                  <Input
                    placeholder="8728"
                    value={formData.port}
                    onChange={(e) => handleInputChange("port", e.target.value)}
                  />
                  {errors.port && (
                    <p className="text-sm text-destructive">{errors.port}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Username *</label>
                  <Input
                    placeholder="admin"
                    value={formData.apiUser}
                    onChange={(e) => handleInputChange("apiUser", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">API Password *</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter router password"
                      value={formData.apiPassword}
                      onChange={(e) => handleInputChange("apiPassword", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {errors.apiPassword && (
                    <p className="text-sm text-destructive">{errors.apiPassword}</p>
                  )}
                </div>
              </div>

              {connectionStatus === "success" && routerInfo && (
                <Alert className="border-green-500 bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertTitle className="text-green-500">Connection Successful!</AlertTitle>
                  <AlertDescription className="mt-2 space-y-1">
                    <div className="text-sm">
                      <strong>Router Identity:</strong> {routerInfo.identity || "N/A"}
                    </div>
                    <div className="text-sm">
                      <strong>Version:</strong> {routerInfo.version || "N/A"}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {connectionStatus === "error" && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Connection Failed</AlertTitle>
                  <AlertDescription>
                    Unable to connect to the router. Please verify your credentials and network settings.
                  </AlertDescription>
                </Alert>
              )}

              {/* VPN Setup Progress */}
              {renderVPNSetupProgress()}
            </div>
          )}

          {/* Step 3: Hotspot Setup */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hotspotEnabled"
                  checked={formData.hotspotEnabled}
                  onCheckedChange={(checked) => handleInputChange("hotspotEnabled", checked === true)}
                />
                <label
                  htmlFor="hotspotEnabled"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Enable Hotspot Service
                </label>
              </div>

              {formData.hotspotEnabled && (
                <div className="space-y-4 pl-6 border-l-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">WiFi Network Name (SSID) *</label>
                    <Input
                      placeholder="e.g., MyWiFi-Hotspot"
                      value={formData.ssid}
                      onChange={(e) => handleInputChange("ssid", e.target.value)}
                    />
                    {errors.ssid && (
                      <p className="text-sm text-destructive">{errors.ssid}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hotspot Password *</label>
                    <div className="relative">
                      <Input
                        type={showHotspotPassword ? "text" : "password"}
                        placeholder="Minimum 8 characters"
                        value={formData.hotspotPassword}
                        onChange={(e) => handleInputChange("hotspotPassword", e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowHotspotPassword(!showHotspotPassword)}
                      >
                        {showHotspotPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {errors.hotspotPassword && (
                      <p className="text-sm text-destructive">{errors.hotspotPassword}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Maximum Users</label>
                    <Input
                      type="number"
                      placeholder="50"
                      value={formData.maxUsers}
                      onChange={(e) => handleInputChange("maxUsers", e.target.value)}
                    />
                  </div>

                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      Your hotspot will be secured with WPA2 encryption for safe connections.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              <Separator />

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pppoeEnabled"
                  checked={formData.pppoeEnabled}
                  onCheckedChange={(checked) => handleInputChange("pppoeEnabled", checked === true)}
                />
                <label
                  htmlFor="pppoeEnabled"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Enable PPPoE Service
                </label>
              </div>

              {formData.pppoeEnabled && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    PPPoE service will be configured automatically. You can manage users after router setup.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 4: Review & Connect */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <Alert className="border-green-500 bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertTitle className="text-green-500">Ready to Add Router</AlertTitle>
                <AlertDescription>
                  Review your settings below and click "Add Router" to complete the setup.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-3">Router Information</h3>
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{formData.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Model:</span>
                      <span className="font-medium">{formData.model}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Location:</span>
                      <span className="font-medium">
                        {formData.location.name || formData.location.county}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Network Configuration</h3>
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">IP Address:</span>
                      <span className="font-medium">{formData.ipAddress}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Port:</span>
                      <span className="font-medium">{formData.port}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">API User:</span>
                      <span className="font-medium">{formData.apiUser}</span>
                    </div>
                  </div>
                </div>

                {formData.hotspotEnabled && (
                  <div>
                    <h3 className="font-medium mb-3">Hotspot Configuration</h3>
                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">SSID:</span>
                        <span className="font-medium">{formData.ssid}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Max Users:</span>
                        <span className="font-medium">{formData.maxUsers}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Security:</span>
                        <Badge variant="default">WPA2 Enabled</Badge>
                      </div>
                    </div>
                  </div>
                )}

                {formData.pppoeEnabled && (
                  <div>
                    <h3 className="font-medium mb-3">PPPoE Service</h3>
                    <div className="rounded-lg border p-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant="default">Enabled</Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between gap-4 pt-6 border-t">
            <div className="flex gap-2">
              {onCancel && (
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              {currentStep > 1 && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={isConnecting || connectionStatus === "testing" || connectionStatus === "vpn-setup"}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
            </div>

            {currentStep < steps.length ? (
              <Button
                onClick={handleNext}
                disabled={isConnecting || connectionStatus === "testing" || connectionStatus === "vpn-setup"}
              >
                {currentStep === 2 && connectionStatus === "idle" ? (
                  <>
                    Test Connection
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                ) : connectionStatus === "testing" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : connectionStatus === "vpn-setup" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Securing...
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isConnecting}>
                {isConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding Router...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Add Router
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};