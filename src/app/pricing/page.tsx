// src/app/pricing/page.tsx
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
  HelpCircle,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing - PAY N BROWSE',
  description: 'Simple, transparent pricing for WiFi hotspot and PPPoE management. Supports MikroTik & UniFi. No hidden fees.',
};

export default function PricingPage() {
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
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Home</Link>
              <Link href="/support/knowledge-base" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Support</Link>
            </nav>
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
              15 Days Free Trial — No Credit Card Required
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-muted-foreground">
              Choose the plan that fits your operation. No hidden fees, cancel anytime.
              All plans include MikroTik & UniFi router support.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-16 md:pb-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">

            {/* Personal Plan */}
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
                  Apartments, homes, guesthouses & small offices
                </CardDescription>
                <div className="pt-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">20%</span>
                    <span className="text-muted-foreground">commission</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Only charged on your actual earnings
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  {[
                    { title: 'No Monthly Fees', desc: 'Pay only when you earn' },
                    { title: '1 Router Included', desc: 'MikroTik or UniFi' },
                    { title: 'M-Pesa STK Push', desc: 'Automated payment processing' },
                    { title: 'Branded Captive Portal', desc: 'Your business name & colors' },
                    { title: 'Voucher Management', desc: 'Generate and sell WiFi vouchers' },
                    { title: 'SMS Customer Alerts', desc: 'Payment & expiry notifications' },
                    { title: 'Free Trial WiFi', desc: 'Offer timed trials to customers' },
                    { title: 'Monthly Withdrawals', desc: 'Paid to M-Pesa every month' },
                    { title: 'Support Tickets', desc: 'Manage customer issues' },
                    { title: 'Email Support', desc: 'Help when you need it' },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button asChild className="w-full" size="lg">
                  <Link href="/signup?plan=individual">
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
                  Small to medium ISPs and WISPs
                </CardDescription>
                <div className="pt-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">KSh 2,500</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Billed monthly • 0% commission</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  {[
                    { title: 'Up to 5 Routers', desc: 'MikroTik & UniFi supported' },
                    { title: 'Unlimited Customers', desc: 'No limits on users' },
                    { title: 'PPPoE Management', desc: 'Bandwidth profiles & subscriber control' },
                    { title: 'Bulk Voucher Generation', desc: 'Print or export in batches' },
                    { title: 'M-Pesa Paybill Integration', desc: 'Use your own paybill number' },
                    { title: 'Branded Captive Portal', desc: 'Custom portal for each router' },
                    { title: 'SMS Customer Notifications', desc: 'Buy SMS credits as needed' },
                    { title: 'Commission Tracking', desc: 'Per-router revenue reports' },
                    { title: 'Advanced Analytics', desc: 'Detailed reports & insights' },
                    { title: 'Priority Support', desc: 'Email & in-platform tickets' },
                    { title: '15-Day Free Trial', desc: 'Try before you commit' },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button asChild className="w-full" size="lg" variant="outline">
                  <Link href="/signup?plan=isp">
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
                  Established ISPs and enterprise operators
                </CardDescription>
                <div className="pt-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">KSh 3,900</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Billed monthly • 0% commission</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  {[
                    { title: 'Unlimited Routers', desc: 'Scale to any number of sites' },
                    { title: 'Everything in Basic', desc: 'All ISP Basic features included' },
                    { title: 'UniFi Controller Support', desc: 'Full UniFi provisioning & sync' },
                    { title: 'PPPoE Bandwidth Profiles', desc: 'Custom speed tiers per user' },
                    { title: 'Bulk SMS Credits', desc: 'Higher volume at better rates' },
                    { title: 'Automated Commission Payouts', desc: 'Scheduled M-Pesa disbursements' },
                    { title: 'Full Audit Logs', desc: 'Complete activity trail for all users' },
                    { title: 'Router Health Monitoring', desc: 'Alerts when routers go offline' },
                    { title: 'Dedicated Support', desc: 'Priority queue & faster response' },
                    { title: '15-Day Free Trial', desc: 'Try all Pro features free' },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button asChild className="w-full" size="lg" variant="outline">
                  <Link href="/signup?plan=isp_pro">
                    Start Free Trial
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* SMS Credits Note */}
          <div className="max-w-3xl mx-auto mt-10">
            <Card className="bg-muted/50">
              <CardContent className="py-4 px-6">
                <p className="text-sm text-center text-muted-foreground">
                  <strong className="text-foreground">SMS Credits</strong> are separate from your plan and used for customer notifications.
                  Purchase credits as needed — starting from KSh 1 per SMS. Credits never expire.
                </p>
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
              {[
                {
                  q: 'How does the 20% commission work?',
                  a: 'For the Personal plan, we only charge 20% on money you actually earn. If a customer pays KSh 100 for WiFi, you keep KSh 80 and we take KSh 20. ISP plans pay a flat monthly fee with 0% commission on all sales.',
                },
                {
                  q: 'Which routers are supported?',
                  a: 'We support MikroTik RouterOS routers (hotspot and PPPoE) and Ubiquiti UniFi controllers (hotspot). Our provisioning wizard handles configuration automatically — you just need the router credentials.',
                },
                {
                  q: 'What happens after the 15-day trial?',
                  a: 'Personal plan users continue with the 20% commission model — no subscription needed. ISPs are billed monthly from day 16. You can cancel anytime before that with no charge.',
                },
                {
                  q: 'Do I need technical knowledge to set up?',
                  a: 'No. Our automated onboarding guides you step-by-step. The system pushes hotspot configuration, IP pools, and captive portal settings directly to your router. Most users are live in under 30 minutes.',
                },
                {
                  q: 'How do SMS notifications work?',
                  a: 'SMS credits are purchased separately and used to send payment confirmations, voucher codes, and expiry reminders to your customers. Credits are consumed per message sent and never expire.',
                },
                {
                  q: 'When can I withdraw my earnings?',
                  a: 'You can request withdrawals at the end of every month. Funds are processed via M-Pesa or bank transfer within 1–3 business days.',
                },
                {
                  q: 'Can I use my own M-Pesa Paybill?',
                  a: 'Yes. ISP plans support linking your own M-Pesa Paybill or Till number so customer payments go directly to your account. Personal plan users collect via the platform\'s shared paybill.',
                },
              ].map(({ q, a }) => (
                <Card key={q}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <HelpCircle className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <div>
                        <CardTitle className="text-lg">{q}</CardTitle>
                        <CardDescription className="mt-2">{a}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="py-12 text-center">
              <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
              <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
                Join WiFi providers making passive income today. 15-day free trial — no credit card required.
              </p>
              <Button asChild size="lg" variant="secondary">
                <Link href="/signup">
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
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <Link href="/legal/terms-of-service" className="hover:text-foreground">Terms of Service</Link>
            <Link href="/legal/privacy-policy" className="hover:text-foreground">Privacy Policy</Link>
            <Link href="/legal/acceptable-use" className="hover:text-foreground">Acceptable Use</Link>
            <Link href="/legal/sla" className="hover:text-foreground">SLA</Link>
            <Link href="/support/knowledge-base" className="hover:text-foreground">Support</Link>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} PAY N BROWSE. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
