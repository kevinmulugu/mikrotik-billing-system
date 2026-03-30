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
  ArrowRight,
  MessageSquare,
  Globe,
  Router,
  BarChart3,
  Ticket,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'PAY N BROWSE - WiFi Hotspot & PPPoE Management',
  description: 'Monetize your internet with WiFi hotspots and PPPoE management. Supports MikroTik & UniFi. Accept M-Pesa payments and earn revenue.',
};

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="bg-primary w-8 h-8 rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">PB</span>
              </div>
              <span className="font-semibold text-foreground">PAY N BROWSE</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </Link>
              <Link href="/support/knowledge-base" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Support
              </Link>
            </nav>
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="sm">
                <Link href="/signin">Sign In</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b">
        <div className="container mx-auto px-4 py-16 md:py-28">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            <Badge variant="secondary" className="mb-4">
              15 Days Free Trial — No Credit Card Required
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
              Share Your WiFi.
              <span className="text-primary block mt-2">Earn Monthly Income.</span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
              Turn your MikroTik or UniFi router into a revenue-generating hotspot.
              Automated M-Pesa payments, branded captive portal, PPPoE management,
              and real-time monitoring — all in one dashboard.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button asChild size="lg">
                <Link href="/signup">
                  Start Free Trial
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground pt-2">
              Works with MikroTik & UniFi • No technical knowledge required • Automated onboarding
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to Run a WiFi Business
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Built for operators in Kenya — from apartment owners to ISPs
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Router className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>MikroTik & UniFi Support</CardTitle>
                <CardDescription>
                  Full support for both MikroTik RouterOS and Ubiquiti UniFi controllers. Automated provisioning — plug in, connect, and you're live.
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
                  Customers pay directly via M-Pesa STK Push or Paybill. Payments auto-trigger voucher generation and account activation — zero manual work.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Globe className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Branded Captive Portal</CardTitle>
                <CardDescription>
                  Your business name and colors on the customer sign-in page. Includes M-Pesa payment form, voucher login, and optional free trial button.
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
                  Manage hotspot vouchers and PPPoE subscribers from one dashboard. Set bandwidth profiles, track usage, and control expiry dates.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <MessageSquare className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>SMS Customer Notifications</CardTitle>
                <CardDescription>
                  Send automated SMS alerts for payment confirmations, expiry reminders, and voucher delivery. Keep your customers informed automatically.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Commission & Payouts</CardTitle>
                <CardDescription>
                  Automatic commission tracking on every sale. Request your monthly earnings via M-Pesa. Transparent breakdowns in your dashboard.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Real-Time Analytics</CardTitle>
                <CardDescription>
                  Track active users, revenue trends, router health, and connected devices. Know exactly how your business is performing at any moment.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Ticket className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Support Ticket System</CardTitle>
                <CardDescription>
                  Built-in helpdesk for your customers. Manage issues, track resolutions, and keep a history of all support interactions from your dashboard.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Secure by Design</CardTitle>
                <CardDescription>
                  SMS OTP and Google sign-in for your account. Role-based access, audit logs, and M-Pesa webhook validation keep your revenue protected.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 md:py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg">Up and running in under 30 minutes</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-bold flex items-center justify-center mx-auto">
                1
              </div>
              <h3 className="text-xl font-semibold">Connect Your Router</h3>
              <p className="text-muted-foreground text-sm">
                Enter your MikroTik or UniFi router credentials. Our system automatically configures hotspot profiles, IP pools, and the captive portal redirect.
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-bold flex items-center justify-center mx-auto">
                2
              </div>
              <h3 className="text-xl font-semibold">Create Packages</h3>
              <p className="text-muted-foreground text-sm">
                Set your data packages — 1 hour for KSh 10, 1 day for KSh 50, or monthly PPPoE plans. Customers see them instantly on the captive portal.
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-bold flex items-center justify-center mx-auto">
                3
              </div>
              <h3 className="text-xl font-semibold">Earn & Withdraw</h3>
              <p className="text-muted-foreground text-sm">
                Customers pay via M-Pesa and get instant access. Your earnings are tracked automatically. Withdraw every month via M-Pesa.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Target Markets Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Perfect For</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Personal Plan */}
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
                  Apartments, homes, guesthouses, and small offices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {[
                    'No monthly subscription — pay only 20% on earnings',
                    '1 router, unlimited hotspot vouchers',
                    'M-Pesa STK Push for customer payments',
                    'Branded captive portal with your business name',
                    'SMS notifications to customers',
                    'Monthly withdrawals to M-Pesa',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{item}</p>
                    </div>
                  ))}
                </div>
                <Button asChild className="w-full" size="lg">
                  <Link href="/signup?plan=individual">Start Free Trial</Link>
                </Button>
              </CardContent>
            </Card>

            {/* ISP Plans */}
            <Card className="relative overflow-hidden">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Wifi className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">ISP Plans</CardTitle>
                <CardDescription className="text-base">
                  ISPs, WISPs, and multi-location operators
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {[
                    'KSh 2,500/month — up to 5 routers',
                    'KSh 3,900/month — unlimited routers',
                    'Full PPPoE subscriber management',
                    'Bulk voucher generation',
                    'UniFi & MikroTik router support',
                    'Advanced analytics and commission tracking',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{item}</p>
                    </div>
                  ))}
                </div>
                <Button asChild className="w-full" size="lg" variant="outline">
                  <Link href="/pricing">View ISP Plans</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="py-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Start Earning?
              </h2>
              <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
                Join WiFi providers making passive income across Kenya.
                Start your 15-day free trial today — no credit card required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="secondary">
                  <Link href="/signup">
                    Start Free Trial
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="bg-primary-foreground text-primary border-primary-foreground hover:bg-primary-foreground/90">
                  <Link href="/pricing">See Pricing</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <p className="font-semibold text-sm mb-3">Product</p>
              <div className="space-y-2">
                <Link href="/pricing" className="block text-sm text-muted-foreground hover:text-foreground">Pricing</Link>
                <Link href="/signup" className="block text-sm text-muted-foreground hover:text-foreground">Sign Up</Link>
                <Link href="/signin" className="block text-sm text-muted-foreground hover:text-foreground">Sign In</Link>
              </div>
            </div>
            <div>
              <p className="font-semibold text-sm mb-3">Support</p>
              <div className="space-y-2">
                <Link href="/support/knowledge-base" className="block text-sm text-muted-foreground hover:text-foreground">Knowledge Base</Link>
                <Link href="/support/tickets" className="block text-sm text-muted-foreground hover:text-foreground">Support Tickets</Link>
              </div>
            </div>
            <div>
              <p className="font-semibold text-sm mb-3">Legal</p>
              <div className="space-y-2">
                <Link href="/legal/terms-of-service" className="block text-sm text-muted-foreground hover:text-foreground">Terms of Service</Link>
                <Link href="/legal/privacy-policy" className="block text-sm text-muted-foreground hover:text-foreground">Privacy Policy</Link>
                <Link href="/legal/acceptable-use" className="block text-sm text-muted-foreground hover:text-foreground">Acceptable Use</Link>
              </div>
            </div>
            <div>
              <p className="font-semibold text-sm mb-3">More Legal</p>
              <div className="space-y-2">
                <Link href="/legal/cookie-policy" className="block text-sm text-muted-foreground hover:text-foreground">Cookie Policy</Link>
                <Link href="/legal/sla" className="block text-sm text-muted-foreground hover:text-foreground">SLA</Link>
              </div>
            </div>
          </div>
          <div className="border-t pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} PAY N BROWSE. All rights reserved. Serving Kenya 🇰🇪
            </p>
            <p className="text-xs text-muted-foreground">
              Supports MikroTik RouterOS & Ubiquiti UniFi
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
