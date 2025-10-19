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
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
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
    "Mombasa",
    "Kwale",
    "Kilifi",
    "Tana River",
    "Lamu",
    "Taita-Taveta",
    "Garissa",
    "Wajir",
    "Mandera",
    "Marsabit",
    "Isiolo",
    "Meru",
    "Tharaka-Nithi",
    "Embu",
    "Kitui",
    "Machakos",
    "Makueni",
    "Nyandarua",
    "Nyeri",
    "Kirinyaga",
    "Murang'a",
    "Kiambu",
    "Turkana",
    "West Pokot",
    "Samburu",
    "Trans Nzoia",
    "Uasin Gishu",
    "Elgeyo-Marakwet",
    "Nandi",
    "Baringo",
    "Laikipia",
    "Nakuru",
    "Narok",
    "Kajiado",
    "Kericho",
    "Bomet",
    "Kakamega",
    "Vihiga",
    "Bungoma",
    "Busia",
    "Siaya",
    "Kisumu",
    "Homa Bay",
    "Migori",
    "Kisii",
    "Nyamira",
    "Nairobi",
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
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof RouterFormData] as any),
          [child]: value,
        },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }

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
    }
  };

  const handleTestConnection = async () => {
    setConnectionStatus("testing");
    setIsConnecting(true);

    try {
      const response = await fetch('/api/routers/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ipAddress: formData.ipAddress,
          port: formData.port,
          apiUser: formData.apiUser,
          apiPassword: formData.apiPassword,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setConnectionStatus("success");
        setRouterInfo(result.data?.routerInfo);
        toast.success("Connection successful!");
        setTimeout(() => {
          setCurrentStep(currentStep + 1);
        }, 1500);
      } else {
        setConnectionStatus("error");
        toast.error(result.error || "Connection failed. Please check your credentials.");
      }
    } catch (error) {
      setConnectionStatus("error");
      toast.error("Failed to connect to router. Check your network connection.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSubmit = async () => {
    setIsConnecting(true);

    try {
      const response = await fetch('/api/routers/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success("Router added successfully!");
        
        if (onComplete) {
          onComplete(result.routerId);
        } else {
          router.push('/routers');
        }
      } else {
        toast.error(result.error || "Failed to add router");
      }
    } catch (error) {
      toast.error("Failed to add router. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  const progressPercentage = (currentStep / steps.length) * 100;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Add New Router</h2>
        <p className="text-muted-foreground mt-1">
          Connect your MikroTik router to start earning from WiFi
        </p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {React.createElement(steps[currentStep - 1].icon, { className: "h-5 w-5" })}
            {steps[currentStep - 1].title}
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
                    placeholder="Router serial number"
                    value={formData.serialNumber}
                    onChange={(e) => handleInputChange("serialNumber", e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium">Location Information</h3>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Location Name</label>
                  <Input
                    placeholder="e.g., Kilimani Apartments"
                    value={formData.location.name}
                    onChange={(e) => handleInputChange("location.name", e.target.value)}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Street/Building</label>
                    <Input
                      placeholder="Street address"
                      value={formData.location.street}
                      onChange={(e) => handleInputChange("location.street", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">City</label>
                    <Input
                      placeholder="City"
                      value={formData.location.city}
                      onChange={(e) => handleInputChange("location.city", e.target.value)}
                    />
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
            </div>
          )}

          {/* Step 2: Network Configuration */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Enter your router's connection details. We'll test the connection before proceeding.
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

              {connectionStatus === "testing" && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertTitle>Testing Connection</AlertTitle>
                  <AlertDescription>
                    Connecting to your router... This may take a few seconds.
                  </AlertDescription>
                </Alert>
              )}

              {connectionStatus === "success" && (
                <Alert className="border-green-500 bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertTitle className="text-green-500">Connection Successful!</AlertTitle>
                  <AlertDescription>
                    Successfully connected to your MikroTik router.
                    {routerInfo && (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm">Model: {routerInfo.model}</p>
                        <p className="text-sm">Version: {routerInfo.version}</p>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {connectionStatus === "error" && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Connection Failed</AlertTitle>
                  <AlertDescription>
                    Unable to connect to the router. Please check:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>IP address is correct and router is reachable</li>
                      <li>REST API service is enabled on the router</li>
                      <li>Username and password are correct</li>
                      <li>Firewall is not blocking the API port</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 3: Hotspot Setup */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Configure your hotspot settings. Users will connect using these credentials.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
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
                  <label className="text-sm font-medium">WiFi Password *</label>
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
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Your hotspot will be secured with WPA2 encryption for safe connections.
                </AlertDescription>
              </Alert>
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
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-4">
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
              disabled={isConnecting || connectionStatus === "testing"}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
        </div>

        {currentStep < steps.length ? (
          <Button
            onClick={handleNext}
            disabled={isConnecting || connectionStatus === "testing"}
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
    </div>
  );
};