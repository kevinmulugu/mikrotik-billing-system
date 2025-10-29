import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Settings,
  User,
  Bell,
  CreditCard,
  Shield,
  Globe,
  Smartphone,
  Mail,
  Lock
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Settings - MikroTik Billing',
  description: 'Manage your account settings and preferences',
};

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-blue-600" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Profile Settings */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" asChild>
          <a href="/settings/profile">
            <CardHeader className="text-center">
              <User className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>Profile Settings</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                Update your personal information, contact details, and business info
              </p>
              <div className="text-sm text-muted-foreground">
                Name, Email, Phone, Business Details
              </div>
            </CardContent>
          </a>
        </Card>

        {/* Notifications */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" asChild>
          <a href="/settings/notifications">
            <CardHeader className="text-center">
              <Bell className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                Configure email, SMS, and push notification preferences
              </p>
              <div className="text-sm text-muted-foreground">
                Email, SMS, Push Notifications
              </div>
            </CardContent>
          </a>
        </Card>

        {/* Billing Settings */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" asChild>
          <a href="/settings/billing">
            <CardHeader className="text-center">
              <CreditCard className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <CardTitle>Billing Settings</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                Manage payment methods, billing address, and commission settings
              </p>
              <div className="text-sm text-muted-foreground">
                Payment Methods, Commission Rates
              </div>
            </CardContent>
          </a>
        </Card>

        {/* Security Settings */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" asChild>
          <a href="/settings/security">
            <CardHeader className="text-center">
              <Shield className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                Password, two-factor authentication, and login activity
              </p>
              <div className="text-sm text-muted-foreground">
                Password, 2FA, Login History
              </div>
            </CardContent>
          </a>
        </Card>

        {/* Language & Region */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <Globe className="h-12 w-12 text-orange-600 mx-auto mb-4" />
            <CardTitle>Language & Region</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              Set your preferred language, timezone, and currency
            </p>
            <div className="flex justify-center gap-2">
              <Button size="sm" variant="outline">English</Button>
              <Button size="sm" variant="ghost">Swahili</Button>
            </div>
          </CardContent>
        </Card>

        {/* App Preferences */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <Smartphone className="h-12 w-12 text-teal-600 mx-auto mb-4" />
            <CardTitle>App Preferences</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              Theme, dashboard layout, and display preferences
            </p>
            <div className="flex justify-center gap-2">
              <Button size="sm" variant="outline">Light</Button>
              <Button size="sm" variant="ghost">Dark</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive updates via email</p>
                  </div>
                </div>
                <Button size="sm" variant="outline">Configure</Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">SMS Alerts</p>
                    <p className="text-sm text-muted-foreground">Critical alerts via SMS</p>
                  </div>
                </div>
                <Button size="sm" variant="outline">Configure</Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium">Two-Factor Authentication</p>
                    <p className="text-sm text-muted-foreground">Extra security for your account</p>
                  </div>
                </div>
                <Button size="sm" variant="outline">Enable</Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium">Payment Method</p>
                    <p className="text-sm text-muted-foreground">Company Paybill (20% commission)</p>
                  </div>
                </div>
                <Button size="sm" variant="outline">Change</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}