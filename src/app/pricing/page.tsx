import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Building2,
  Wifi,
  ArrowRight,
  HelpCircle
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing - PAY N BROWSE',
  description: 'Simple, transparent pricing for WiFi hotspot and PPPoE management. No hidden fees.',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="bg-primary w-8 h-8 rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">PB</span>
              </div>
              <span className="font-semibold text-foreground">PAY N BROWSE</span>
            </Link>
            <Button asChild variant="outline">
              <Link href="/signin">Sign In</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <Badge variant="secondary" className="mb-2">
              15 Days Free Trial
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-muted-foreground">
              Choose the plan that fits your business. No hidden fees, cancel anytime.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-16 md:pb-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Apartment/Home Owners Plan */}
            <Card className="relative border-2 border-primary shadow-lg">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <Badge className="px-4 py-1">Most Popular</Badge>
              </div>
              <CardHeader className="pt-8">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Personal Plan</CardTitle>
                <CardDescription className="text-base">
                  Perfect for apartments, homes, and small businesses
                </CardDescription>
                <div className="pt-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">20%</span>
                    <span className="text-muted-foreground">commission</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Only charged on your earnings
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">No Monthly Fees</p>
                      <p className="text-sm text-muted-foreground">Pay only when you earn</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">1 Router Included</p>
                      <p className="text-sm text-muted-foreground">Manage your WiFi hotspot</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">M-Pesa Integration</p>
                      <p className="text-sm text-muted-foreground">Automated payment processing</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Voucher Management</p>
                      <p className="text-sm text-muted-foreground">Generate and sell WiFi vouchers</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Hotspot Management</p>
                      <p className="text-sm text-muted-foreground">Manage WiFi hotspot users</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Trial WiFi</p>
                      <p className="text-sm text-muted-foreground">Offer free trials to customers</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Monthly Withdrawals</p>
                      <p className="text-sm text-muted-foreground">Get paid every month</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Mobile Dashboard</p>
                      <p className="text-sm text-muted-foreground">Manage from anywhere</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Email Support</p>
                      <p className="text-sm text-muted-foreground">Get help when you need it</p>
                    </div>
                  </div>
                </div>
                <Button asChild className="w-full" size="lg">
                  <Link href="/signin">
                    Start Free Trial
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* ISP Basic Plan */}
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Wifi className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">ISP Basic</CardTitle>
                <CardDescription className="text-base">
                  For small to medium ISPs
                </CardDescription>
                <div className="pt-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">KSh 2,500</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Billed monthly
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Up to 5 Routers</p>
                      <p className="text-sm text-muted-foreground">Manage multiple locations</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Unlimited Users</p>
                      <p className="text-sm text-muted-foreground">No limits on customers</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">PPPoE Management</p>
                      <p className="text-sm text-muted-foreground">Manage PPPoE connections</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Bulk Voucher Generation</p>
                      <p className="text-sm text-muted-foreground">Create vouchers in bulk</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">M-Pesa Integration</p>
                      <p className="text-sm text-muted-foreground">Automated payments</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Advanced Analytics</p>
                      <p className="text-sm text-muted-foreground">Detailed reports & insights</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Priority Support</p>
                      <p className="text-sm text-muted-foreground">Email & phone support</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">15-Day Free Trial</p>
                      <p className="text-sm text-muted-foreground">Try before you commit</p>
                    </div>
                  </div>
                </div>
                <Button asChild className="w-full" size="lg" variant="outline">
                  <Link href="/signin">
                    Start Free Trial
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* ISP Pro Plan */}
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Wifi className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">ISP Pro</CardTitle>
                <CardDescription className="text-base">
                  For established ISPs & enterprises
                </CardDescription>
                <div className="pt-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">KSh 3,900</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Billed monthly
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Unlimited Routers</p>
                      <p className="text-sm text-muted-foreground">Scale without limits</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Everything in Basic</p>
                      <p className="text-sm text-muted-foreground">All Basic features included</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Multi-User Accounts</p>
                      <p className="text-sm text-muted-foreground">Team collaboration</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">White-Label Option</p>
                      <p className="text-sm text-muted-foreground">Brand it as your own</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Custom Integrations</p>
                      <p className="text-sm text-muted-foreground">API access</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Dedicated Support</p>
                      <p className="text-sm text-muted-foreground">24/7 priority support</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Custom Training</p>
                      <p className="text-sm text-muted-foreground">Onboarding for your team</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">15-Day Free Trial</p>
                      <p className="text-sm text-muted-foreground">Try all features free</p>
                    </div>
                  </div>
                </div>
                <Button asChild className="w-full" size="lg" variant="outline">
                  <Link href="/signin">
                    Start Free Trial
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <HelpCircle className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <CardTitle className="text-lg">How does the 20% commission work?</CardTitle>
                      <CardDescription className="mt-2">
                        For Personal plan users, we only charge 20% on the money you actually earn. For example, if a customer pays KSh 100 for WiFi, you keep KSh 80 and we take KSh 20. There are no monthly fees or hidden charges.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <HelpCircle className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <CardTitle className="text-lg">What happens after the 15-day trial?</CardTitle>
                      <CardDescription className="mt-2">
                        After your free trial, Personal plan users continue with the 20% commission model (no subscription). ISPs are automatically billed monthly based on their selected plan. You can cancel anytime.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <HelpCircle className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <CardTitle className="text-lg">Do I need technical knowledge to setup?</CardTitle>
                      <CardDescription className="mt-2">
                        No! Our automated onboarding process guides you through everything step-by-step. The system handles router configuration automatically. You just need a MikroTik router and internet connection.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <HelpCircle className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <CardTitle className="text-lg">When can I withdraw my earnings?</CardTitle>
                      <CardDescription className="mt-2">
                        You can request withdrawals at the end of every month. Funds are typically processed within 1-3 business days via M-Pesa or bank transfer.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <HelpCircle className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <CardTitle className="text-lg">Can I upgrade or downgrade my plan?</CardTitle>
                      <CardDescription className="mt-2">
                        Yes! ISPs can switch between Basic and Pro plans anytime. Personal plan users can upgrade to ISP plans if they need to manage multiple routers. Changes take effect immediately.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="py-12 text-center">
              <h2 className="text-3xl font-bold mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
                Join WiFi providers making passive income today. Start your 15-day free trial - no credit card required.
              </p>
              <Button asChild size="lg" variant="secondary">
                <Link href="/signin">
                  Start Free Trial
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
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
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
                Home
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
