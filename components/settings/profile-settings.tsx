"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  Camera,
  Loader2,
  CheckCircle2,
  Briefcase,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

interface ProfileData {
  name: string;
  email: string;
  image: string | null;
  role: string;
  phone: string;
  businessName: string;
  address: {
    street: string;
    city: string;
    county: string;
    postalCode: string;
  };
  connectedProviders: string[];
}

const kenyanCounties = [
  "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Malindi",
  "Kakamega", "Meru", "Nyeri", "Machakos", "Kiambu", "Kajiado", "Nanyuki",
  "Kitale", "Garissa", "Naivasha", "Voi", "Kericho", "Bungoma",
];

const ROLE_LABELS: Record<string, string> = {
  homeowner: "Homeowner",
  individual: "Individual",
  isp: "ISP Basic",
  isp_pro: "ISP Pro",
  system_admin: "System Admin",
};

export const ProfileSettings: React.FC = () => {
  const { data: session } = useSession();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [profile, setProfile] = useState<ProfileData>({
    name: "",
    email: "",
    image: null,
    role: "homeowner",
    phone: "",
    businessName: "",
    address: { street: "", city: "", county: "", postalCode: "" },
    connectedProviders: [],
  });

  useEffect(() => {
    if (!session?.user) return;

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/user/profile');
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to fetch profile');
        }
        const data = await res.json();
        setProfile({
          name: data.name || "",
          email: data.email || "",
          image: data.image || null,
          role: data.role || "homeowner",
          phone: data.businessInfo?.contact?.phone || "",
          businessName: data.businessInfo?.name || "",
          address: {
            street: data.businessInfo?.address?.street || "",
            city: data.businessInfo?.address?.city || "",
            county: data.businessInfo?.address?.county || "",
            postalCode: data.businessInfo?.address?.postalCode || "",
          },
          connectedProviders: data.connectedProviders || [],
        });
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [session]);

  const set = (field: keyof ProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const setAddr = (field: keyof ProfileData['address'], value: string) => {
    setProfile((prev) => ({ ...prev, address: { ...prev.address, [field]: value } }));
    setHasChanges(true);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }

    setIsUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile((prev) => ({ ...prev, image: reader.result as string }));
        setHasChanges(true);
      };
      reader.readAsDataURL(file);
      toast.success("Profile picture selected — save to apply");
    } catch {
      toast.error("Failed to read image");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!profile.name || profile.name.trim().length < 2) {
      toast.error("Full name must be at least 2 characters");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name.trim(),
          image: profile.image,
          businessInfo: {
            name: profile.businessName,
            contact: { phone: profile.phone, email: profile.email },
            address: {
              street: profile.address.street,
              city: profile.address.city,
              county: profile.address.county,
              country: 'Kenya',
              postalCode: profile.address.postalCode,
            },
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update profile');
      }

      toast.success("Profile updated successfully");
      setHasChanges(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Loading profile…</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Profile Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your personal information and business details</p>
      </div>

      {hasChanges && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>You have unsaved changes. Click "Save Changes" to apply.</AlertDescription>
        </Alert>
      )}

      {/* Profile Picture */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Profile Picture
          </CardTitle>
          <CardDescription>Upload a profile picture to personalise your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <Avatar className="h-20 w-20 shrink-0">
              <AvatarImage src={profile.image || undefined} />
              <AvatarFallback className="text-2xl">{getInitials(profile.name || session?.user?.name || "U")}</AvatarFallback>
            </Avatar>
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap gap-2">
                <input type="file" id="avatar-upload" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                <Button variant="outline" size="sm" onClick={() => document.getElementById("avatar-upload")?.click()} disabled={isUploadingAvatar}>
                  {isUploadingAvatar ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
                  {isUploadingAvatar ? "Reading…" : "Upload Photo"}
                </Button>
                {profile.image && (
                  <Button variant="outline" size="sm" onClick={() => { setProfile((p) => ({ ...p, image: null })); setHasChanges(true); }}>
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 2 MB. Recommended: 400×400 px</p>
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
          <CardDescription>Update your name and contact details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Full Name *</label>
              <Input
                placeholder="Enter your full name"
                value={profile.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Account Type</label>
              <div className="h-9 flex items-center">
                <Badge variant="outline" className="text-sm capitalize">
                  {ROLE_LABELS[profile.role] ?? profile.role}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Role is managed by the platform</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="email" className="pl-10" value={profile.email} disabled readOnly />
              </div>
              <p className="text-xs text-muted-foreground">Email is linked to your authentication and cannot be changed</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="+254 712 345 678"
                  className="pl-10"
                  value={profile.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>
            </div>
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
          <CardDescription>Your business name shown on invoices and the captive portal</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <label className="text-sm font-medium">Business Name</label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Your business name"
                className="pl-10"
                value={profile.businessName}
                onChange={(e) => set("businessName", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Address
          </CardTitle>
          <CardDescription>Your physical location</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Street Address</label>
            <Input
              placeholder="Street name and building number"
              value={profile.address.street}
              onChange={(e) => setAddr("street", e.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">City</label>
              <Input placeholder="City" value={profile.address.city} onChange={(e) => setAddr("city", e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">County</label>
              <Select value={profile.address.county} onValueChange={(v) => setAddr("county", v)}>
                <SelectTrigger><SelectValue placeholder="Select county" /></SelectTrigger>
                <SelectContent>
                  {kenyanCounties.map((county) => (
                    <SelectItem key={county} value={county}>{county}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Postal Code</label>
              <Input placeholder="00100" value={profile.address.postalCode} onChange={(e) => setAddr("postalCode", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      {profile.connectedProviders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Connected Accounts</CardTitle>
            <CardDescription>Social accounts linked to your login</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile.connectedProviders.map((provider) => (
              <div key={provider} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{provider === 'google' ? '🔵' : provider === 'facebook' ? '🔷' : '⚫'}</span>
                  <div>
                    <p className="font-medium capitalize">{provider}</p>
                    <p className="text-sm text-muted-foreground">{profile.email}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">Connected</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
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
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
          ) : (
            <><CheckCircle2 className="h-4 w-4 mr-2" />Save Changes</>
          )}
        </Button>
      </div>
    </div>
  );
};
