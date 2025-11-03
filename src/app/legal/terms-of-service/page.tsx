// src/app/legal/terms-of-service/page.tsx
import { Metadata } from 'next';
import { FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'PAY N BROWSE Terms of Service - Legal agreement governing the use of our WiFi hotspot and PPPoE management platform',
};

export default function TermsOfServicePage() {
  return (
    <div className="prose prose-gray dark:prose-invert max-w-none">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-8 w-8 text-primary" />
        <h1 className="text-4xl font-bold m-0">Terms of Service</h1>
      </div>
      
      <p className="text-muted-foreground text-lg">
        Last Updated: {new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 my-6">
        <p className="font-semibold m-0">
          Please read these Terms of Service carefully before using PAY N BROWSE. By accessing or using our services, you agree to be bound by these terms.
        </p>
      </div>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By creating an account or using PAY N BROWSE services, you agree to comply with and be bound by these Terms of Service, our Privacy Policy, and all applicable laws and regulations in Kenya.
      </p>

      <h2>2. Service Description</h2>
      <p>PAY N BROWSE provides:</p>
      <ul>
        <li>WiFi hotspot management platform</li>
        <li>PPPoE user management</li>
        <li>Voucher generation and sales system</li>
        <li>M-Pesa payment integration</li>
        <li>Router configuration and monitoring</li>
        <li>Commission-based revenue sharing for individual users</li>
        <li>Subscription plans for ISP businesses</li>
      </ul>

      <h2>3. User Eligibility</h2>
      <p>To use our services, you must:</p>
      <ul>
        <li>Be at least 18 years of age</li>
        <li>Have legal capacity to enter into binding contracts</li>
        <li>Provide accurate and complete registration information</li>
        <li>Maintain the security of your account credentials</li>
        <li>Comply with all applicable Kenyan laws and regulations</li>
      </ul>

      <h2>4. Account Registration</h2>
      
      <h3>4.1 Account Types</h3>
      <ul>
        <li><strong>Individual/Homeowner:</strong> Free plan with 80% commission on voucher sales</li>
        <li><strong>ISP Basic:</strong> KES 2,500/month, up to 5 routers, 0% commission</li>
        <li><strong>ISP Pro:</strong> KES 3,900/month, unlimited routers, 0% commission</li>
      </ul>

      <h3>4.2 Account Responsibilities</h3>
      <p>You are responsible for:</p>
      <ul>
        <li>Maintaining confidentiality of your account credentials</li>
        <li>All activities that occur under your account</li>
        <li>Notifying us immediately of any unauthorized access</li>
        <li>Ensuring your contact information is current</li>
      </ul>

      <h2>5. Payment Terms</h2>
      
      <h3>5.1 Payment Methods</h3>
      <ul>
        <li>We use Safaricom M-Pesa for all transactions</li>
        <li>You can use our company paybill or your own M-Pesa paybill</li>
        <li>Payment processing fees may apply</li>
      </ul>

      <h3>5.2 Commission Structure (Individual Plans)</h3>
      <ul>
        <li>You earn 80% commission on all voucher sales</li>
        <li>Commission is calculated on successful completed transactions</li>
        <li>Minimum payout threshold: KES 1,000</li>
        <li>Payouts processed monthly or as configured</li>
      </ul>

      <h3>5.3 Subscription Fees (ISP Plans)</h3>
      <ul>
        <li>Monthly fees are billed in advance</li>
        <li>15-day free trial for new ISP accounts</li>
        <li>No refunds for partial months</li>
        <li>Automatic renewal unless cancelled 7 days before renewal date</li>
      </ul>

      <h3>5.4 Price Changes</h3>
      <p>
        We reserve the right to modify our pricing with 30 days' notice. Continued use of services after price changes constitutes acceptance of the new rates.
      </p>

      <h2>6. Service Availability</h2>
      <p>
        We strive for 99.5% uptime but cannot guarantee uninterrupted service. Scheduled maintenance will be communicated in advance. See our <a href="/legal/sla">Service Level Agreement</a> for details.
      </p>

      <h2>7. User Conduct and Acceptable Use</h2>
      <p>You agree NOT to:</p>
      <ul>
        <li>Use the service for any illegal purposes</li>
        <li>Violate Kenya's cybercrime laws or regulations</li>
        <li>Transmit harmful code, viruses, or malware</li>
        <li>Attempt unauthorized access to our systems</li>
        <li>Resell or redistribute our services without permission</li>
        <li>Generate fraudulent transactions or vouchers</li>
        <li>Interfere with other users' use of the service</li>
        <li>Scrape or harvest data from our platform</li>
      </ul>
      <p>See our <a href="/legal/acceptable-use">Acceptable Use Policy</a> for complete details.</p>

      <h2>8. Intellectual Property</h2>
      
      <h3>8.1 Our Rights</h3>
      <p>
        All content, features, and functionality of PAY N BROWSE, including but not limited to text, graphics, logos, software, and trademarks, are owned by us and protected by Kenyan and international intellectual property laws.
      </p>

      <h3>8.2 Your License</h3>
      <p>
        We grant you a limited, non-exclusive, non-transferable license to access and use our services for their intended purpose. This license terminates upon account closure or service termination.
      </p>

      <h3>8.3 Your Content</h3>
      <p>
        You retain ownership of content you create (e.g., voucher configurations, custom branding). By using our service, you grant us a license to use, store, and display this content as necessary to provide our services.
      </p>

      <h2>9. Data Protection and Privacy</h2>
      <p>
        We process your personal data in accordance with our <a href="/legal/privacy-policy">Privacy Policy</a> and the Kenya Data Protection Act, 2019. By using our services, you consent to such processing.
      </p>

      <h2>10. Termination</h2>
      
      <h3>10.1 By You</h3>
      <p>You may terminate your account at any time through your account settings. You remain responsible for fees incurred before termination.</p>

      <h3>10.2 By Us</h3>
      <p>We may suspend or terminate your account if you:</p>
      <ul>
        <li>Violate these Terms of Service</li>
        <li>Fail to pay required fees</li>
        <li>Engage in fraudulent activities</li>
        <li>Pose a security risk to our platform or other users</li>
      </ul>

      <h3>10.3 Effect of Termination</h3>
      <p>Upon termination:</p>
      <ul>
        <li>Your access to the service will be revoked</li>
        <li>Outstanding fees remain payable</li>
        <li>We may delete your data after a reasonable retention period</li>
        <li>Accrued commissions will be paid according to our payout schedule</li>
      </ul>

      <h2>11. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY KENYAN LAW:
      </p>
      <ul>
        <li>We provide services "AS IS" without warranties of any kind</li>
        <li>We are not liable for indirect, incidental, or consequential damages</li>
        <li>Our total liability shall not exceed fees paid in the last 12 months</li>
        <li>We are not responsible for third-party services (e.g., M-Pesa, internet connectivity)</li>
        <li>We are not liable for loss of revenue, data, or business interruption</li>
      </ul>

      <h2>12. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless PAY N BROWSE, its officers, directors, and employees from any claims, damages, or expenses arising from:
      </p>
      <ul>
        <li>Your use of our services</li>
        <li>Your violation of these terms</li>
        <li>Your violation of any third-party rights</li>
        <li>Your end-users' activities on your WiFi network</li>
      </ul>

      <h2>13. Regulatory Compliance</h2>
      <p>You must comply with:</p>
      <ul>
        <li><strong>Communications Authority of Kenya (CA):</strong> Obtain necessary licenses if required</li>
        <li><strong>Kenya Revenue Authority (KRA):</strong> Report and pay applicable taxes</li>
        <li><strong>Data Protection:</strong> Comply with Kenya Data Protection Act, 2019</li>
        <li><strong>Consumer Protection:</strong> Kenya Consumer Protection Act, 2012</li>
      </ul>

      <h2>14. Dispute Resolution</h2>
      
      <h3>14.1 Governing Law</h3>
      <p>These terms are governed by the laws of Kenya.</p>

      <h3>14.2 Arbitration</h3>
      <p>
        Disputes shall first be resolved through good faith negotiation. If unsuccessful, disputes shall be resolved through arbitration under the Kenyan Arbitration Act, 1995, in Nairobi, Kenya.
      </p>

      <h3>14.3 Class Action Waiver</h3>
      <p>You agree to resolve disputes individually and waive any right to participate in class actions.</p>

      <h2>15. Changes to Terms</h2>
      <p>
        We may modify these terms at any time. Material changes will be notified via:
      </p>
      <ul>
        <li>Email to your registered address (30 days' notice)</li>
        <li>Prominent notice on the platform</li>
        <li>In-app notifications</li>
      </ul>
      <p>Continued use after changes constitutes acceptance of modified terms.</p>

      <h2>16. Miscellaneous</h2>
      
      <h3>16.1 Entire Agreement</h3>
      <p>These terms, along with our Privacy Policy and other referenced policies, constitute the entire agreement between you and PAY N BROWSE.</p>

      <h3>16.2 Severability</h3>
      <p>If any provision is found unenforceable, the remaining provisions remain in full effect.</p>

      <h3>16.3 Waiver</h3>
      <p>Our failure to enforce any right or provision does not constitute a waiver of that right.</p>

      <h3>16.4 Assignment</h3>
      <p>You may not assign these terms without our consent. We may assign our rights without restriction.</p>

      <h2>17. Contact Information</h2>
      <div className="bg-muted p-4 rounded-lg my-4">
        <p className="m-0"><strong>PAY N BROWSE Support</strong></p>
        <p className="m-0">Email: support@paynbrowse.com</p>
        <p className="m-0">Phone: +254 796 002 630</p>
        <p className="m-0">Address: [Your Business Address], Kenya</p>
        <p className="m-0">Business Hours: Monday - Friday, 8:00 AM - 6:00 PM EAT</p>
      </div>

      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 my-8">
        <p className="font-semibold m-0">
          By creating an account or using PAY N BROWSE, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
        </p>
      </div>
    </div>
  );
}
