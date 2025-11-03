// src/app/page.tsx
import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Wifi,
  Smartphone,
  TrendingUp,
  Shield,
  Zap,
  Users,
  Building2,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'PAY N BROWSE - WiFi Hotspot & PPPoE Management',
  description: 'Monetize your internet with WiFi hotspots and PPPoE management. Perfect for apartments and ISPs. Accept M-Pesa payments and earn revenue.',
};

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  // Redirect authenticated users to dashboard
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="border-b">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            <Badge variant="secondary" className="mb-4">
              15 Days Free Trial
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground">
              Share Your WiFi.
              <span className="text-primary block mt-2">Earn Monthly Income.</span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Turn your WiFi into a business with our automated hotspot and PPPoE management system.
              Perfect for apartments, businesses, and ISPs. Accept M-Pesa payments,
              manage vouchers and PPPoE users, withdraw earnings monthly.
            </p>            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button asChild size="lg">
                <Link href="/signin">
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/pricing">
                  View Pricing
                </Link>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground pt-2">
              No technical knowledge required • Automated onboarding • 15-day trial
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need for WiFi & PPPoE Management
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Built for non-technical users with seamless automation
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Wifi className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>WiFi Hotspot Management</CardTitle>
                <CardDescription>
                  Create and manage WiFi hotspots for your customers. Support for vouchers, trials, and package management.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Smartphone className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>M-Pesa Integration</CardTitle>
                <CardDescription>
                  Customers buy packages directly via M-Pesa. Automatic payment processing and voucher generation.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Automated Setup</CardTitle>
                <CardDescription>
                  No technical knowledge needed. Our system guides you through router setup and configuration automatically.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Hotspot & PPPoE Management</CardTitle>
                <CardDescription>
                  Manage both WiFi hotspots and PPPoE users. Generate vouchers for hotspots and manage PPPoE connections seamlessly.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Monthly Withdrawals</CardTitle>
                <CardDescription>
                  Earn revenue from your WiFi. Withdraw your earnings at the end of every month with ease.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Real-time Monitoring</CardTitle>
                <CardDescription>
                  Track users, revenue, and router performance. Get insights on your business from anywhere.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Target Markets Section */}
      <section className="py-16 md:py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Perfect For
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Apartment/Home Owners */}
            <Card className="relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <Badge>Most Popular</Badge>
                </div>
                <CardTitle className="text-2xl">Personal Plan</CardTitle>
                <CardDescription className="text-base">
                  For individuals sharing WiFi in apartments & homes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Only 20% platform fee on earnings</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm">No monthly subscription</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm">WiFi hotspot management</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Automated setup & onboarding</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm">M-Pesa payment integration</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Monthly withdrawals</p>
                  </div>
                </div>
                <Button asChild className="w-full" size="lg">
                  <Link href="/signin">
                    Start Free Trial
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* ISPs */}
            <Card className="relative overflow-hidden">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Wifi className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">ISP Plans</CardTitle>
                <CardDescription className="text-base">
                  Manage multiple routers, hotspots & PPPoE users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm">KSh 2,500/month for up to 5 routers</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm">KSh 3,900/month for unlimited routers</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Hotspot & PPPoE management</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Advanced user management</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Bulk voucher generation</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm">15-day free trial</p>
                  </div>
                </div>
                <Button asChild className="w-full" size="lg" variant="outline">
                  <Link href="/pricing">
                    View ISP Plans
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="py-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Start Earning?
              </h2>
              <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
                Join hundreds of WiFi providers making passive income.
                Start your 15-day free trial today - no credit card required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="secondary">
                  <Link href="/signin">
                    Start Free Trial
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="bg-primary-foreground text-primary border-primary-foreground hover:bg-primary-foreground/90">
                  <Link href="/pricing">
                    See Pricing
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} PAY N BROWSE. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
                Pricing
              </Link>
              <Link href="/support/knowledge-base" className="text-sm text-muted-foreground hover:text-foreground">
                Support
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}