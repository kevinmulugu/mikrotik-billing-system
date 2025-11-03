// src/app/legal/acceptable-use/page.tsx
import { Metadata } from 'next';
import { ShieldAlert } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Acceptable Use Policy',
  description: 'PAY N BROWSE Acceptable Use Policy - Rules and guidelines for using our platform',
};

export default function AcceptableUsePolicyPage() {
  return (
    <div className="prose prose-gray dark:prose-invert max-w-none">
      <div className="flex items-center gap-3 mb-6">
        <ShieldAlert className="h-8 w-8 text-primary" />
        <h1 className="text-4xl font-bold m-0">Acceptable Use Policy</h1>
      </div>
      
      <p className="text-muted-foreground text-lg">
        Last Updated: {new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 my-6">
        <p className="font-semibold m-0">
          This Acceptable Use Policy defines the rules for using PAY N BROWSE services. Violations may result in account suspension or termination.
        </p>
      </div>

      <h2>1. Purpose</h2>
      <p>
        This policy ensures PAY N BROWSE services are used responsibly, legally, and ethically. It protects our platform, users, and the broader internet community while maintaining compliance with Kenyan laws.
      </p>

      <h2>2. Scope</h2>
      <p>This policy applies to:</p>
      <ul>
        <li>All PAY N BROWSE users (individual, ISP, ISP Pro)</li>
        <li>End users connecting through your WiFi hotspot or PPPoE service</li>
        <li>Any activities conducted through our platform or infrastructure</li>
        <li>Content transmitted, stored, or processed using our services</li>
      </ul>

      <h2>3. General Prohibitions</h2>
      <p>You may NOT use PAY N BROWSE services to:</p>

      <h3>3.1 Illegal Activities</h3>
      <ul>
        <li>❌ Violate any Kenyan laws or regulations</li>
        <li>❌ Violate the Kenya Information and Communications Act</li>
        <li>❌ Violate the Computer Misuse and Cybercrimes Act, 2018</li>
        <li>❌ Commit fraud, theft, or financial crimes</li>
        <li>❌ Engage in money laundering or terrorist financing</li>
        <li>❌ Distribute or access child sexual abuse material (CSAM)</li>
        <li>❌ Facilitate illegal drug trade or trafficking</li>
        <li>❌ Violate intellectual property rights (piracy, counterfeiting)</li>
      </ul>

      <h3>3.2 Harmful Content</h3>
      <ul>
        <li>❌ Distribute malware, viruses, or harmful code</li>
        <li>❌ Conduct phishing, scamming, or social engineering attacks</li>
        <li>❌ Send spam or unsolicited bulk communications</li>
        <li>❌ Share revenge porn or non-consensual intimate images</li>
        <li>❌ Promote violence, terrorism, or hate speech</li>
        <li>❌ Harass, threaten, or incite violence against individuals</li>
      </ul>

      <h3>3.3 Network Abuse</h3>
      <ul>
        <li>❌ Launch denial-of-service (DoS) or DDoS attacks</li>
        <li>❌ Conduct port scanning or network reconnaissance without authorization</li>
        <li>❌ Attempt unauthorized access to systems or data</li>
        <li>❌ Intercept or modify data transmissions</li>
        <li>❌ Operate botnets or command-and-control infrastructure</li>
        <li>❌ Mine cryptocurrency using shared resources without disclosure</li>
      </ul>

      <h3>3.4 Platform Abuse</h3>
      <ul>
        <li>❌ Create fake or fraudulent accounts</li>
        <li>❌ Generate fraudulent vouchers or transactions</li>
        <li>❌ Manipulate commission or revenue tracking systems</li>
        <li>❌ Scrape or harvest data from the platform</li>
        <li>❌ Reverse engineer or decompile our software</li>
        <li>❌ Bypass security measures or authentication systems</li>
        <li>❌ Resell services without authorization</li>
      </ul>

      <h2>4. Network Usage Guidelines</h2>

      <h3>4.1 Bandwidth Fair Use</h3>
      <p>
        While we don't impose hard limits, excessive bandwidth usage that affects other users may be investigated. "Excessive" is defined as:
      </p>
      <ul>
        <li>Sustained usage significantly above your plan's typical patterns</li>
        <li>Usage that degrades service quality for other users</li>
        <li>Automated scripts or bots consuming disproportionate resources</li>
      </ul>

      <h3>4.2 Prohibited Network Activities</h3>
      <ul>
        <li>❌ Running public servers (mail, web, file sharing) without disclosure</li>
        <li>❌ Operating open proxies or VPN exit nodes</li>
        <li>❌ Peer-to-peer file sharing of copyrighted content</li>
        <li>❌ Hosting piracy-related services (torrent trackers, warez sites)</li>
      </ul>

      <h3>4.3 Permitted Activities</h3>
      <ul>
        <li>✅ Personal VPN use for privacy</li>
        <li>✅ Streaming services (Netflix, YouTube, Showmax)</li>
        <li>✅ Video calls and remote work applications</li>
        <li>✅ Cloud services and backups</li>
        <li>✅ Online gaming (within fair use limits)</li>
        <li>✅ Educational content and research</li>
      </ul>

      <h2>5. WiFi Hotspot and PPPoE Operator Responsibilities</h2>

      <h3>5.1 As a Service Provider</h3>
      <p>If you operate a hotspot or PPPoE service, you must:</p>
      <ul>
        <li>✅ Comply with Communications Authority of Kenya regulations</li>
        <li>✅ Obtain necessary licenses (if required)</li>
        <li>✅ Implement reasonable security measures</li>
        <li>✅ Monitor for illegal activities on your network</li>
        <li>✅ Respond promptly to abuse reports</li>
        <li>✅ Maintain logs as required by Kenyan law</li>
        <li>✅ Provide clear terms of service to your end users</li>
      </ul>

      <h3>5.2 End User Monitoring</h3>
      <p>You are responsible for:</p>
      <ul>
        <li>Activities of users connecting through your network</li>
        <li>Implementing abuse prevention measures</li>
        <li>Taking action against abusive users</li>
        <li>Cooperating with law enforcement when required</li>
      </ul>

      <h3>5.3 Content Filtering (Optional)</h3>
      <p>While not required, you may implement:</p>
      <ul>
        <li>Parental controls for family-friendly environments</li>
        <li>Bandwidth management for fair resource allocation</li>
        <li>DNS filtering to block known malicious sites</li>
        <li>Age verification for age-restricted content</li>
      </ul>

      <h2>6. Security Requirements</h2>

      <h3>6.1 Account Security</h3>
      <p>You must:</p>
      <ul>
        <li>✅ Use strong, unique passwords</li>
        <li>✅ Enable two-factor authentication if available</li>
        <li>✅ Keep login credentials confidential</li>
        <li>✅ Report unauthorized access immediately</li>
        <li>✅ Log out from shared or public computers</li>
      </ul>

      <h3>6.2 Router Security</h3>
      <p>For routers managed through PAY N BROWSE:</p>
      <ul>
        <li>✅ Change default admin passwords immediately</li>
        <li>✅ Keep firmware updated</li>
        <li>✅ Use WPA2/WPA3 encryption for WiFi</li>
        <li>✅ Disable WPS if not needed</li>
        <li>✅ Regularly audit connected devices</li>
      </ul>

      <h3>6.3 Vulnerability Reporting</h3>
      <p>
        If you discover security vulnerabilities in PAY N BROWSE:
      </p>
      <ul>
        <li>✅ Report to security@paynbrowse.com immediately</li>
        <li>✅ Do NOT exploit the vulnerability</li>
        <li>✅ Do NOT disclose publicly until we've patched it</li>
        <li>✅ We'll acknowledge reports within 48 hours</li>
        <li>✅ Responsible disclosure is appreciated and may be rewarded</li>
      </ul>

      <h2>7. Content and Data Responsibilities</h2>

      <h3>7.1 Your Content</h3>
      <p>You are responsible for:</p>
      <ul>
        <li>All content you create, upload, or transmit</li>
        <li>Ensuring you have rights to share the content</li>
        <li>Accuracy of information provided to customers</li>
        <li>Compliance with advertising and marketing laws</li>
      </ul>

      <h3>7.2 Customer Data</h3>
      <p>If you collect data from your end users:</p>
      <ul>
        <li>✅ Comply with Kenya Data Protection Act, 2019</li>
        <li>✅ Obtain necessary consents</li>
        <li>✅ Implement appropriate security measures</li>
        <li>✅ Provide privacy notices to your users</li>
        <li>✅ Honor data subject rights (access, deletion, etc.)</li>
      </ul>

      <h2>8. Payment and Billing Conduct</h2>

      <h3>8.1 Honest Transactions</h3>
      <ul>
        <li>✅ Provide accurate voucher pricing and descriptions</li>
        <li>✅ Honor advertised terms and conditions</li>
        <li>✅ Process refunds promptly when appropriate</li>
        <li>✅ Maintain transparent billing practices</li>
      </ul>

      <h3>8.2 Prohibited Practices</h3>
      <ul>
        <li>❌ Fraudulent transactions or chargebacks</li>
        <li>❌ Selling non-functional or expired vouchers</li>
        <li>❌ Misrepresenting services or capabilities</li>
        <li>❌ Unauthorized use of others' payment methods</li>
      </ul>

      <h2>9. Reporting Violations</h2>

      <h3>9.1 How to Report</h3>
      <p>If you observe violations of this policy:</p>
      <div className="bg-muted p-4 rounded-lg my-4">
        <p className="m-0"><strong>Report to:</strong></p>
        <p className="m-0 mt-2">Email: abuse@paynbrowse.com</p>
        <p className="m-0">Subject: AUP Violation Report</p>
        <p className="m-0 mt-2"><strong>Include:</strong></p>
        <ul className="my-2">
          <li>Description of the violation</li>
          <li>Account or network involved (if known)</li>
          <li>Date and time of incident</li>
          <li>Any supporting evidence (screenshots, logs)</li>
          <li>Your contact information</li>
        </ul>
      </div>

      <h3>9.2 Investigation Process</h3>
      <ul>
        <li>We review all reports within 2 business days</li>
        <li>May request additional information</li>
        <li>Take appropriate action based on severity</li>
        <li>Notify relevant authorities for serious violations</li>
      </ul>

      <h2>10. Enforcement Actions</h2>

      <h3>10.1 Warning</h3>
      <p>For first-time or minor violations:</p>
      <ul>
        <li>Email warning with details of the violation</li>
        <li>Requirement to cease the activity</li>
        <li>Opportunity to respond or appeal</li>
      </ul>

      <h3>10.2 Suspension</h3>
      <p>For repeated or moderate violations:</p>
      <ul>
        <li>Temporary account suspension (7-30 days)</li>
        <li>Must resolve issues before reactivation</li>
        <li>May require additional security measures</li>
      </ul>

      <h3>10.3 Termination</h3>
      <p>For serious or repeated violations:</p>
      <ul>
        <li>Permanent account termination</li>
        <li>Forfeiture of outstanding commissions</li>
        <li>Ban from creating new accounts</li>
        <li>Legal action if necessary</li>
      </ul>

      <h3>10.4 Law Enforcement</h3>
      <p>We will cooperate with law enforcement for:</p>
      <ul>
        <li>Court orders and legal requests</li>
        <li>Investigations of serious crimes</li>
        <li>National security matters</li>
        <li>Child protection cases</li>
      </ul>

      <h2>11. Appeals</h2>
      <p>If you believe enforcement action was taken in error:</p>
      <ul>
        <li>Submit an appeal to appeals@paynbrowse.com within 14 days</li>
        <li>Include your account details and explanation</li>
        <li>We'll review and respond within 7 business days</li>
        <li>Decision after appeal is final</li>
      </ul>

      <h2>12. Legal Framework</h2>
      <p>This policy supports compliance with:</p>
      <ul>
        <li><strong>Computer Misuse and Cybercrimes Act, 2018:</strong> Cybercrimes and unauthorized access</li>
        <li><strong>Kenya Information and Communications Act:</strong> Telecommunications regulations</li>
        <li><strong>Kenya Data Protection Act, 2019:</strong> Personal data protection</li>
        <li><strong>Communications Authority Regulations:</strong> ISP and network operator requirements</li>
        <li><strong>Kenya Copyright Act:</strong> Intellectual property protection</li>
      </ul>

      <h2>13. Updates to This Policy</h2>
      <p>We may update this policy to address:</p>
      <ul>
        <li>New types of abuse or threats</li>
        <li>Changes in Kenyan laws or regulations</li>
        <li>Feedback from users and experiences</li>
        <li>Industry best practices</li>
      </ul>
      <p>Material changes will be communicated via email and platform notifications.</p>

      <h2>14. Contact Information</h2>
      <div className="bg-muted p-4 rounded-lg my-4">
        <p className="m-0"><strong>Abuse Reports:</strong> abuse@paynbrowse.com</p>
        <p className="m-0"><strong>Security Issues:</strong> security@paynbrowse.com</p>
        <p className="m-0"><strong>Policy Questions:</strong> support@paynbrowse.com</p>
        <p className="m-0"><strong>Appeals:</strong> appeals@paynbrowse.com</p>
        <p className="m-0 mt-2"><strong>Phone:</strong> +254 796 002 630</p>
        <p className="m-0"><strong>Business Hours:</strong> Monday - Friday, 8:00 AM - 6:00 PM EAT</p>
      </div>

      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 my-8">
        <p className="font-semibold text-destructive m-0">
          ⚠️ Violations of this Acceptable Use Policy may result in immediate account suspension or termination without refund. Serious violations will be reported to law enforcement authorities.
        </p>
      </div>

      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 my-8">
        <p className="font-semibold m-0">
          By using PAY N BROWSE, you agree to abide by this Acceptable Use Policy. Help us maintain a safe, legal, and reliable platform for all users.
        </p>
      </div>
    </div>
  );
}
