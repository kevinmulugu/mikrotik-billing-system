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
  AlertTriangle,
  Zap,
  Copy,
  Terminal,
  CheckCheck,
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

type SetupStatus = "idle" | "generating-script" | "waiting-for-user" | "verifying" | "verified" | "error";

interface VPNSetup {
  setupToken: string;
  script: string;
  vpnIP: string;
  expiresIn: number;
  instructions: {
    steps: string[];
  };
}

interface VPNVerification {
  verified: boolean;
  vpnIP: string;
  publicKey: string;
  routerInfo?: any;
}

const steps = [
  { id: 1, title: "Basic Information", icon: Wifi },
  { id: 2, title: "VPN Setup", icon: Lock },
  { id: 3, title: "Hotspot Setup", icon: Shield },
  { id: 4, title: "Review & Connect", icon: CheckCircle2 },
];

export const AddRouterWizard: React.FC<AddRouterWizardProps> = ({
  onComplete,
  onCancel,
}) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [setupStatus, setSetupStatus] = useState<SetupStatus>("idle");
  const [vpnSetup, setVpnSetup] = useState<VPNSetup | null>(null);
  const [vpnVerification, setVpnVerification] = useState<VPNVerification | null>(null);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showHotspotPassword, setShowHotspotPassword] = useState(false);

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
    ipAddress: "192.168.88.1",
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
      if (!formData.ipAddress) {
        newErrors.ipAddress = "IP address is required";
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
      if (currentStep === 1) {
        // Moving from step 1 to step 2 (VPN setup)
        handleGenerateVPNScript();
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
      
      // Reset VPN setup if going back from step 2
      if (currentStep === 2) {
        setSetupStatus("idle");
        setVpnSetup(null);
        setVpnVerification(null);
        setScriptCopied(false);
      }
    }
  };

  /**
   * Generate VPN setup script
   */
  const handleGenerateVPNScript = async () => {
    setSetupStatus("generating-script");

    try {
      console.log("[Wizard] Generating VPN setup script...");

      const response = await fetch("/api/vpn/generate-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routerName: formData.name,
          routerModel: formData.model,
          ipAddress: formData.ipAddress,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate script");
      }

      const data = await response.json();

      if (!data.success || !data.data) {
        throw new Error("Invalid response from server");
      }

      setVpnSetup(data.data);
      setSetupStatus("waiting-for-user");
      setCurrentStep(2);

      console.log("[Wizard] ✓ VPN script generated successfully");
      toast.success("VPN setup script ready!");

    } catch (error) {
      console.error("[Wizard] Script generation error:", error);
      
      setSetupStatus("error");
      toast.error(
        `Failed to generate setup script: ${error instanceof Error ? error.message : "Unknown error"}`,
        { duration: 7000 }
      );
    }
  };

  /**
   * Copy script to clipboard
   */
  const handleCopyScript = async () => {
    if (!vpnSetup?.script) return;

    try {
      await navigator.clipboard.writeText(vpnSetup.script);
      setScriptCopied(true);
      toast.success("Script copied to clipboard!");

      // Reset copied state after 3 seconds
      setTimeout(() => setScriptCopied(false), 3000);
    } catch (error) {
      toast.error("Failed to copy script");
    }
  };

  /**
   * Verify VPN connection
   */
  const handleVerifyVPN = async () => {
    if (!vpnSetup?.setupToken) {
      toast.error("No setup token found");
      return;
    }

    setSetupStatus("verifying");

    try {
      console.log("[Wizard] Verifying VPN connection...");

      const response = await fetch("/api/vpn/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          setupToken: vpnSetup.setupToken,
          routerIP: formData.ipAddress,
          apiUser: formData.apiUser,
          apiPassword: formData.apiPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "VPN verification failed");
      }

      setVpnVerification({
        verified: true,
        vpnIP: data.data.vpnIP,
        publicKey: data.data.vpnConfig.publicKey,
        routerInfo: data.data.routerInfo,
      });

      setSetupStatus("verified");

      console.log("[Wizard] ✅ VPN verified successfully");
      toast.success("VPN connection verified! Moving to next step...", { duration: 3000 });

      // Automatically move to next step after 2 seconds
      setTimeout(() => {
        setCurrentStep(3);
      }, 2000);

    } catch (error) {
      console.error("[Wizard] VPN verification error:", error);
      
      setSetupStatus("error");
      toast.error(
        error instanceof Error ? error.message : "VPN verification failed",
        { duration: 7000 }
      );
    }
  };

  /**
   * Submit router with VPN configuration
   */
  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      toast.error("Please fix all errors before submitting");
      return;
    }

    if (!vpnVerification?.verified) {
      toast.error("Please verify VPN connection first");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        // Include VPN configuration
        vpnConfigured: true,
        vpnIP: vpnVerification.vpnIP,
        vpnPublicKey: vpnVerification.publicKey,
      };

      console.log("[Wizard] Submitting router with VPN config...");

      const response = await fetch("/api/routers/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add router");
      }

      console.log("[Wizard] ✅ Router added successfully:", data.routerId);

      toast.success("Router added successfully with secure remote access!", { duration: 5000 });

      if (onComplete) {
        onComplete(data.routerId);
      } else {
        router.push(`/routers/${data.routerId}`);
      }
    } catch (error) {
      console.error("[Wizard] Submit error:", error);
      
      toast.error(
        `Failed to add router: ${error instanceof Error ? error.message : "Unknown error"}`,
        { duration: 7000 }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`
                      w-12 h-12 rounded-full flex items-center justify-center transition-colors
                      ${isCompleted
                        ? "bg-green-500 text-white"
                        : isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                      }
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <StepIcon className="h-6 w-6" />
                    )}
                  </div>
                  <span
                    className={`
                      text-xs mt-2 text-center font-medium
                      ${isActive ? "text-foreground" : "text-muted-foreground"}
                    `}
                  >
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`
                      h-1 flex-1 mx-2 rounded transition-colors
                      ${isCompleted ? "bg-green-500" : "bg-muted"}
                    `}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {steps[currentStep - 1].icon &&
              React.createElement(steps[currentStep - 1].icon, {
                className: "h-5 w-5",
              })}
            {steps[currentStep - 1].title}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Router Name *</label>
                <Input
                  placeholder="e.g., Home Router, Office WiFi"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Router Model *</label>
                <Select
                  value={formData.model}
                  onValueChange={(value) => handleInputChange("model", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select router model" />
                  </SelectTrigger>
                  <SelectContent>
                    {routerModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.model && <p className="text-sm text-destructive">{errors.model}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Serial Number (Optional)</label>
                <Input
                  placeholder="Router serial number"
                  value={formData.serialNumber}
                  onChange={(e) => handleInputChange("serialNumber", e.target.value)}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium">Location</label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Location Name</label>
                <Input
                  placeholder="e.g., Home, Office, Shop"
                  value={formData.location.name}
                  onChange={(e) => handleInputChange("location.name", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Street/Building</label>
                  <Input
                    placeholder="Street address"
                    value={formData.location.street}
                    onChange={(e) => handleInputChange("location.street", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">City/Town</label>
                  <Input
                    placeholder="City or town"
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

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium">Router Connection</label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                  <label className="text-sm font-medium">API Port</label>
                  <Input
                    placeholder="8728"
                    value={formData.port}
                    onChange={(e) => handleInputChange("port", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">API Username</label>
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
                    placeholder="Router admin password"
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

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <p className="text-sm mb-2">
                    Make sure the MikroTik API is enabled on your router.
                  </p>
                  <code className="text-xs bg-muted p-1 rounded">
                    /ip/service/enable api
                  </code>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Step 2: VPN Setup (MANUAL SCRIPT) */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {setupStatus === "generating-script" && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                    <p className="text-lg font-medium">Generating VPN setup script...</p>
                    <p className="text-sm text-muted-foreground">
                      Creating secure configuration for your router
                    </p>
                  </div>
                </div>
              )}

              {(setupStatus === "waiting-for-user" || setupStatus === "verifying" || setupStatus === "verified") && vpnSetup && (
                <div className="space-y-6">
                  <Alert className="border-blue-500 bg-blue-500/10">
                    <Terminal className="h-5 w-5 text-blue-500" />
                    <AlertTitle className="text-blue-500 text-lg">
                      Quick VPN Setup - One Command
                    </AlertTitle>
                    <AlertDescription className="mt-2">
                      <p className="text-sm text-muted-foreground mb-3">
                        Copy the script below and paste it into your router's terminal to enable secure remote management.
                        This takes about 30 seconds.
                      </p>
                      <div className="bg-background/50 rounded-lg p-3 border border-blue-200">
                        <p className="text-xs font-semibold mb-2 text-blue-600">
                          VPN IP: <code className="bg-muted px-1.5 py-0.5 rounded">{vpnSetup.vpnIP}</code>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Script expires in: {Math.floor(vpnSetup.expiresIn / 60)} minutes
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>

                  {/* Script Display */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Router Setup Script</label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyScript}
                        disabled={scriptCopied}
                      >
                        {scriptCopied ? (
                          <>
                            <CheckCheck className="h-4 w-4 mr-2" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Script
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-64 border">
                        <code>{vpnSetup.script}</code>
                      </pre>
                    </div>
                  </div>

                  {/* Instructions */}
                  <Card className="border-2 border-amber-200 bg-amber-50/50">
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        How to Apply This Script
                      </h3>
                      <ol className="space-y-2 text-sm">
                        {vpnSetup.instructions.steps.map((step, index) => (
                          <li key={index} className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </span>
                            <span className="text-muted-foreground">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>

                  {/* Verification Status */}
                  {setupStatus === "verifying" && (
                    <Card className="border-blue-500 bg-blue-500/5">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                          <div>
                            <p className="font-medium">Verifying VPN connection...</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Testing connection to {vpnSetup.vpnIP}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {setupStatus === "verified" && vpnVerification && (
                    <Card className="border-green-500 bg-green-500/10">
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-green-600">
                            <CheckCircle2 className="h-6 w-6" />
                            <div>
                              <p className="font-semibold text-lg">VPN Connected Successfully!</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Your router is now securely accessible from anywhere
                              </p>
                            </div>
                          </div>

                          {vpnVerification.routerInfo && (
                            <div className="mt-4 p-3 bg-background/50 rounded-lg border border-green-200">
                              <p className="text-xs font-semibold mb-2">Router Details:</p>
                              <div className="text-xs space-y-1 text-muted-foreground">
                                <p>Identity: {vpnVerification.routerInfo.identity}</p>
                                <p>Version: {vpnVerification.routerInfo.version}</p>
                                <p>MAC: {vpnVerification.routerInfo.macAddress}</p>
                                <p>VPN IP: <code className="bg-muted px-1 py-0.5 rounded">{vpnVerification.vpnIP}</code></p>
                              </div>
                            </div>
                          )}

                          <p className="text-sm text-green-700">
                            Moving to next step...
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {setupStatus === "error" && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>VPN Setup Failed</AlertTitle>
                      <AlertDescription>
                        <p className="text-sm mb-2">Could not verify VPN connection. Please check:</p>
                        <ul className="list-disc list-inside text-xs space-y-1">
                          <li>You pasted the complete script in router terminal</li>
                          <li>Script executed without errors</li>
                          <li>Wait 15 seconds and try verifying again</li>
                          <li>Router has internet connection</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Verify Button */}
                  {setupStatus === "waiting-for-user" && (
                    <Button
                      onClick={handleVerifyVPN}
                      size="lg"
                      className="w-full"
                    >
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      I've Pasted the Script - Verify VPN
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Hotspot Setup */}
          {currentStep === 3 && (
            <div className="space-y-6">
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
                <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                  <Alert>
                    <Wifi className="h-4 w-4" />
                    <AlertDescription>
                      Hotspot will allow customers to connect and purchase internet packages
                      through a captive portal.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">WiFi Network Name (SSID) *</label>
                    <Input
                      placeholder="e.g., MyWiFi-Hotspot"
                      value={formData.ssid}
                      onChange={(e) => handleInputChange("ssid", e.target.value)}
                    />
                    {errors.ssid && <p className="text-sm text-destructive">{errors.ssid}</p>}
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
                      <span className="text-muted-foreground">Local IP:</span>
                      <span className="font-medium">{formData.ipAddress}</span>
                    </div>
                    {vpnVerification?.vpnIP && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">VPN IP:</span>
                        <span className="font-medium flex items-center gap-2">
                          <code className="bg-muted px-2 py-0.5 rounded">{vpnVerification.vpnIP}</code>
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <Lock className="h-3 w-3 mr-1" />
                            Secured
                          </Badge>
                        </span>
                      </div>
                    )}
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

                {vpnVerification?.verified && (
                  <Alert className="border-green-500 bg-green-500/10">
                    <Zap className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-600">
                      Secure Remote Management Enabled
                    </AlertTitle>
                    <AlertDescription className="text-sm">
                      Your router is now accessible from anywhere through a secure VPN tunnel.
                      You can manage it remotely without being on the same network.
                    </AlertDescription>
                  </Alert>
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
              {currentStep > 1 && currentStep !== 2 && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
            </div>

            {currentStep < steps.length ? (
              <Button
                onClick={handleNext}
                disabled={
                  isSubmitting ||
                  setupStatus === "generating-script" ||
                  setupStatus === "verifying" ||
                  (currentStep === 2 && setupStatus !== "verified")
                }
              >
                {setupStatus === "generating-script" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Script...
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting || !vpnVerification?.verified}>
                {isSubmitting ? (
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