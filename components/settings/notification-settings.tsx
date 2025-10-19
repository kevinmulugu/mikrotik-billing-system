"use client";

import React, { useState } from "react";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  DollarSign,
  Wifi,
  Users,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface NotificationChannel {
  email: boolean;
  sms: boolean;
  push: boolean;
}

interface NotificationCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  channels: NotificationChannel;
  frequency?: "instant" | "hourly" | "daily" | "weekly";
}

interface NotificationSettingsState {
  payments: NotificationCategory;
  routers: NotificationCategory;
  users: NotificationCategory;
  support: NotificationCategory;
  system: NotificationCategory;
  marketing: NotificationCategory;
}

export const NotificationSettings: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [settings, setSettings] = useState<NotificationSettingsState>({
    payments: {
      id: "payments",
      title: "Payments & Revenue",
      description: "Get notified about payments, commissions, and revenue updates",
      icon: <DollarSign className="h-5 w-5" />,
      channels: { email: true, sms: true, push: true },
      frequency: "instant",
    },
    routers: {
      id: "routers",
      title: "Router Status",
      description: "Alerts about router connectivity, health, and performance issues",
      icon: <Wifi className="h-5 w-5" />,
      channels: { email: true, sms: true, push: true },
      frequency: "instant",
    },
    users: {
      id: "users",
      title: "User Activity",
      description: "Updates about new users, voucher purchases, and usage patterns",
      icon: <Users className="h-5 w-5" />,
      channels: { email: true, sms: false, push: true },
      frequency: "daily",
    },
    support: {
      id: "support",
      title: "Support Tickets",
      description: "Notifications about your support tickets and responses",
      icon: <MessageSquare className="h-5 w-5" />,
      channels: { email: true, sms: false, push: true },
      frequency: "instant",
    },
    system: {
      id: "system",
      title: "System Updates",
      description: "Important system updates, maintenance, and new features",
      icon: <AlertTriangle className="h-5 w-5" />,
      channels: { email: true, sms: false, push: true },
      frequency: "instant",
    },
    marketing: {
      id: "marketing",
      title: "Tips & Promotions",
      description: "Product tips, best practices, and promotional offers",
      icon: <Mail className="h-5 w-5" />,
      channels: { email: true, sms: false, push: false },
      frequency: "weekly",
    },
  });

  const [globalChannels, setGlobalChannels] = useState({
    email: true,
    sms: true,
    push: true,
  });

  const [quietHours, setQuietHours] = useState({
    enabled: false,
    start: "22:00",
    end: "07:00",
  });

  const handleChannelToggle = (
    categoryId: keyof NotificationSettingsState,
    channel: keyof NotificationChannel
  ) => {
    setSettings((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        channels: {
          ...prev[categoryId].channels,
          [channel]: !prev[categoryId].channels[channel],
        },
      },
    }));
    setHasChanges(true);
  };

  const handleFrequencyChange = (
    categoryId: keyof NotificationSettingsState,
    frequency: string
  ) => {
    setSettings((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        frequency: frequency as NotificationCategory["frequency"],
      },
    }));
    setHasChanges(true);
  };

  const handleGlobalChannelToggle = (channel: keyof typeof globalChannels) => {
    setGlobalChannels((prev) => ({
      ...prev,
      [channel]: !prev[channel],
    }));
    setHasChanges(true);
  };

  const toggleAllInCategory = (
    categoryId: keyof NotificationSettingsState,
    enabled: boolean
  ) => {
    setSettings((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        channels: {
          email: enabled,
          sms: enabled,
          push: enabled,
        },
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // API call to save notification settings
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success("Notification settings saved successfully");
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    // Reset to default settings
    toast.info("Settings reset to defaults");
    setHasChanges(false);
  };

  const getCategoryStatus = (category: NotificationCategory): {
    enabled: number;
    total: number;
  } => {
    const channels = Object.values(category.channels);
    return {
      enabled: channels.filter(Boolean).length,
      total: channels.length,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Notification Settings</h2>
        <p className="text-muted-foreground mt-1">
          Manage how and when you receive notifications about your routers and business
        </p>
      </div>

      {/* Unsaved Changes Alert */}
      {hasChanges && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Click "Save Changes" to apply your settings.
          </AlertDescription>
        </Alert>
      )}

      {/* Global Channel Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Channels
          </CardTitle>
          <CardDescription>
            Enable or disable notification channels globally
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-xs text-muted-foreground">
                    Delivered to your inbox
                  </p>
                </div>
              </div>
              <Switch
                checked={globalChannels.email}
                onCheckedChange={() => handleGlobalChannelToggle("email")}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">SMS</p>
                  <p className="text-xs text-muted-foreground">
                    Text messages to phone
                  </p>
                </div>
              </div>
              <Switch
                checked={globalChannels.sms}
                onCheckedChange={() => handleGlobalChannelToggle("sms")}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Push</p>
                  <p className="text-xs text-muted-foreground">
                    Mobile & desktop alerts
                  </p>
                </div>
              </div>
              <Switch
                checked={globalChannels.push}
                onCheckedChange={() => handleGlobalChannelToggle("push")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Categories</CardTitle>
          <CardDescription>
            Customize notifications for each category
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(settings).map(([key, category], index) => {
            const status = getCategoryStatus(category);
            const allEnabled = status.enabled === status.total;

            return (
              <div key={category.id}>
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        {category.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{category.title}</h3>
                          <Badge variant="outline" className="text-xs">
                            {status.enabled}/{status.total} enabled
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {category.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={allEnabled}
                      onCheckedChange={(checked) =>
                        toggleAllInCategory(key as keyof NotificationSettingsState, checked)
                      }
                    />
                  </div>

                  <div className="ml-14 space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Email</span>
                        </div>
                        <Switch
                          checked={category.channels.email && globalChannels.email}
                          disabled={!globalChannels.email}
                          onCheckedChange={() =>
                            handleChannelToggle(key as keyof NotificationSettingsState, "email")
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">SMS</span>
                        </div>
                        <Switch
                          checked={category.channels.sms && globalChannels.sms}
                          disabled={!globalChannels.sms}
                          onCheckedChange={() =>
                            handleChannelToggle(key as keyof NotificationSettingsState, "sms")
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Push</span>
                        </div>
                        <Switch
                          checked={category.channels.push && globalChannels.push}
                          disabled={!globalChannels.push}
                          onCheckedChange={() =>
                            handleChannelToggle(key as keyof NotificationSettingsState, "push")
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2">
                        <span className="text-sm text-muted-foreground">Frequency</span>
                        <Select
                          value={category.frequency}
                          onValueChange={(value) =>
                            handleFrequencyChange(key as keyof NotificationSettingsState, value)
                          }
                        >
                          <SelectTrigger className="w-[120px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="instant">Instant</SelectItem>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                {index < Object.keys(settings).length - 1 && (
                  <Separator className="mt-6" />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Quiet Hours</CardTitle>
          <CardDescription>
            Pause non-urgent notifications during specific hours
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Quiet Hours</p>
              <p className="text-sm text-muted-foreground">
                Critical alerts will still be delivered
              </p>
            </div>
            <Switch
              checked={quietHours.enabled}
              onCheckedChange={(checked) => {
                setQuietHours((prev) => ({ ...prev, enabled: checked }));
                setHasChanges(true);
              }}
            />
          </div>

          {quietHours.enabled && (
            <div className="grid gap-4 md:grid-cols-2 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Time</label>
                <Select
                  value={quietHours.start}
                  onValueChange={(value) => {
                    setQuietHours((prev) => ({ ...prev, start: value }));
                    setHasChanges(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, "0");
                      return (
                        <SelectItem key={hour} value={`${hour}:00`}>
                          {hour}:00
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">End Time</label>
                <Select
                  value={quietHours.end}
                  onValueChange={(value) => {
                    setQuietHours((prev) => ({ ...prev, end: value }));
                    setHasChanges(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, "0");
                      return (
                        <SelectItem key={hour} value={`${hour}:00`}>
                          {hour}:00
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" onClick={handleReset} disabled={!hasChanges || isSaving}>
          Reset to Defaults
        </Button>
        <div className="flex gap-2">
          {hasChanges && (
            <Button variant="outline" onClick={() => window.location.reload()}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
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
    </div>
  );
};