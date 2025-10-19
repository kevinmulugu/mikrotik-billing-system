"use client";

import React, { useState } from "react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  Camera,
  Loader2,
  CheckCircle2,
  Globe,
  Briefcase,
  Calendar,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface ProfileFormData {
  fullName: string;
  email: string;
  phoneNumber: string;
  businessName: string;
  businessType: string;
  idNumber: string;
  address: {
    street: string;
    city: string;
    county: string;
    postalCode: string;
  };
  bio: string;
  website: string;
}

interface SocialAccount {
  provider: "google" | "facebook" | "apple";
  email: string;
  connectedAt: Date;
}

export const ProfileSettings: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [profileData, setProfileData] = useState<ProfileFormData>({
    fullName: "John Kamau",
    email: "john.kamau@example.com",
    phoneNumber: "+254 712 345 678",
    businessName: "Kamau WiFi Services",
    businessType: "homeowner",
    idNumber: "12345678",
    address: {
      street: "Ngong Road, Kilimani",
      city: "Nairobi",
      county: "Nairobi",
      postalCode: "00100",
    },
    bio: "Providing reliable WiFi services to my community since 2023",
    website: "https://kamau-wifi.co.ke",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ProfileFormData, string>>>({});

  // Sample connected accounts - replace with API
  const connectedAccounts: SocialAccount[] = [
    {
      provider: "google",
      email: "john.kamau@gmail.com",
      connectedAt: new Date("2024-01-15"),
    },
  ];

  const kenyanCounties = [
    "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Malindi",
    "Kakamega", "Meru", "Nyeri", "Machakos", "Kiambu", "Kajiado", "Nanyuki",
    "Kitale", "Garissa", "Naivasha", "Voi", "Kericho", "Bungoma",
  ];

  const businessTypes = [
    { value: "homeowner", label: "Homeowner" },
    { value: "isp", label: "Internet Service Provider" },
    { value: "business", label: "Business/Enterprise" },
  ];

  const handleInputChange = (field: keyof ProfileFormData, value: string) => {
    setProfileData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleAddressChange = (field: keyof ProfileFormData["address"], value: string) => {
    setProfileData((prev) => ({
      ...prev,
      address: { ...prev.address, [field]: value },
    }));
    setHasChanges(true);
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ProfileFormData, string>> = {};

    if (!profileData.fullName || profileData.fullName.length < 3) {
      newErrors.fullName = "Full name must be at least 3 characters";
    }

    if (!profileData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!profileData.phoneNumber || !/^\+254\s?\d{9}$/.test(profileData.phoneNumber.replace(/\s/g, ""))) {
      newErrors.phoneNumber = "Please enter a valid Kenyan phone number (+254...)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      toast.error("Image size must be less than 2MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // API call to upload avatar
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success("Profile picture updated successfully");
      setHasChanges(true);
    } catch (error) {
      toast.error("Failed to upload profile picture");
      setAvatarPreview(null);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      // API call to remove avatar
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setAvatarPreview(null);
      toast.success("Profile picture removed");
      setHasChanges(true);
    } catch (error) {
      toast.error("Failed to remove profile picture");
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    setIsSaving(true);

    try {
      // API call to save profile
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast.success("Profile updated successfully");
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnectAccount = async (provider: string) => {
    try {
      // API call to disconnect social account
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success(`${provider} account disconnected`);
    } catch (error) {
      toast.error("Failed to disconnect account");
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getProviderIcon = (provider: SocialAccount["provider"]) => {
    switch (provider) {
      case "google":
        return "🔵";
      case "facebook":
        return "🔷";
      case "apple":
        return "⚫";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Profile Settings</h2>
        <p className="text-muted-foreground mt-1">
          Manage your personal information and business details
        </p>
      </div>

      {/* Unsaved Changes Alert */}
      {hasChanges && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Click "Save Changes" to apply your updates.
          </AlertDescription>
        </Alert>
      )}

      {/* Profile Picture */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Profile Picture
          </CardTitle>
          <CardDescription>
            Upload a profile picture to personalize your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarPreview || undefined} />
              <AvatarFallback className="text-2xl">
                {getInitials(profileData.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <input
                  type="file"
                  id="avatar-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("avatar-upload")?.click()}
                  disabled={isUploadingAvatar}
                >
                  {isUploadingAvatar ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Upload Photo
                    </>
                  )}
                </Button>
                {avatarPreview && (
                  <Button variant="outline" onClick={handleRemoveAvatar}>
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                JPG, PNG or GIF. Max size 2MB. Recommended: 400x400px
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
          <CardDescription>
            Update your personal details and contact information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Full Name *</label>
              <Input
                placeholder="Enter your full name"
                value={profileData.fullName}
                onChange={(e) => handleInputChange("fullName", e.target.value)}
              />
              {errors.fullName && (
                <p className="text-sm text-destructive">{errors.fullName}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">ID Number</label>
              <Input
                placeholder="National ID number"
                value={profileData.idNumber}
                onChange={(e) => handleInputChange("idNumber", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="your.email@example.com"
                  className="pl-10"
                  value={profileData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="+254 712 345 678"
                  className="pl-10"
                  value={profileData.phoneNumber}
                  onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                />
              </div>
              {errors.phoneNumber && (
                <p className="text-sm text-destructive">{errors.phoneNumber}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Bio (Optional)</label>
            <Textarea
              placeholder="Tell us a bit about yourself and your business..."
              rows={3}
              value={profileData.bio}
              onChange={(e) => handleInputChange("bio", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {profileData.bio.length}/200 characters
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Business Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Business Information
          </CardTitle>
          <CardDescription>
            Manage your business details and type
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Business Name</label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Your business name"
                  className="pl-10"
                  value={profileData.businessName}
                  onChange={(e) => handleInputChange("businessName", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Business Type</label>
              <Select
                value={profileData.businessType}
                onValueChange={(value) => handleInputChange("businessType", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {businessTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Website (Optional)</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="url"
                placeholder="https://your-website.com"
                className="pl-10"
                value={profileData.website}
                onChange={(e) => handleInputChange("website", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Address
          </CardTitle>
          <CardDescription>
            Your physical location and mailing address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Street Address</label>
            <Input
              placeholder="Street name and building number"
              value={profileData.address.street}
              onChange={(e) => handleAddressChange("street", e.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">City</label>
              <Input
                placeholder="City"
                value={profileData.address.city}
                onChange={(e) => handleAddressChange("city", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">County</label>
              <Select
                value={profileData.address.county}
                onValueChange={(value) => handleAddressChange("county", value)}
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
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Postal Code</label>
              <Input
                placeholder="00100"
                value={profileData.address.postalCode}
                onChange={(e) => handleAddressChange("postalCode", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            Manage your social login connections
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {connectedAccounts.map((account) => (
            <div
              key={account.provider}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">{getProviderIcon(account.provider)}</div>
                <div>
                  <p className="font-medium capitalize">{account.provider}</p>
                  <p className="text-sm text-muted-foreground">{account.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Connected {account.connectedAt.toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDisconnectAccount(account.provider)}
              >
                Disconnect
              </Button>
            </div>
          ))}

          <div className="pt-2">
            <p className="text-sm text-muted-foreground mb-3">
              Connect more accounts for easier sign-in:
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Connect Facebook
              </Button>
              <Button variant="outline" size="sm">
                Connect Apple
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          disabled={!hasChanges || isSaving}
        >
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving Changes...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
};