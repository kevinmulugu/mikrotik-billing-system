// src/app/legal/privacy-policy/page.tsx
import { Metadata } from 'next';
import { Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'PAY N BROWSE Privacy Policy - How we collect, use, and protect your personal data in compliance with Kenya Data Protection Act, 2019',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="prose prose-gray dark:prose-invert max-w-none">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-8 w-8 text-primary" />
        <h1 className="text-4xl font-bold m-0">Privacy Policy</h1>
      </div>
      
      <p className="text-muted-foreground text-lg">
        Last Updated: {new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 my-6">
        <p className="font-semibold m-0">
          PAY N BROWSE is committed to protecting your privacy and complying with the Kenya Data Protection Act, 2019.
        </p>
      </div>

      <h2>1. Introduction</h2>
      <p>
        PAY N BROWSE ("we," "us," or "our") operates a WiFi hotspot and PPPoE management platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our services.
      </p>

      <h2>2. Information We Collect</h2>
      
      <h3>2.1 Personal Information</h3>
      <ul>
        <li><strong>Account Information:</strong> Name, email address, phone number</li>
        <li><strong>Business Information:</strong> Business name, address, type of operation</li>
        <li><strong>Payment Information:</strong> M-Pesa phone number, transaction records</li>
        <li><strong>Router Information:</strong> IP addresses, MAC addresses, router configurations</li>
        <li><strong>Usage Data:</strong> Login times, data usage, session duration</li>
      </ul>

      <h3>2.2 Automatically Collected Information</h3>
      <ul>
        <li>Device information (type, operating system)</li>
        <li>IP addresses and location data</li>
        <li>Browser type and version</li>
        <li>Cookies and similar tracking technologies</li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Provide, operate, and maintain our services</li>
        <li>Process M-Pesa payments and commissions</li>
        <li>Monitor router performance and network usage</li>
        <li>Send service notifications and updates</li>
        <li>Provide customer support</li>
        <li>Detect and prevent fraud or abuse</li>
        <li>Comply with legal obligations</li>
        <li>Improve our services and develop new features</li>
      </ul>

      <h2>4. Legal Basis for Processing (Kenya Data Protection Act, 2019)</h2>
      <p>We process your personal data based on:</p>
      <ul>
        <li><strong>Consent:</strong> You have given clear consent for us to process your data</li>
        <li><strong>Contract:</strong> Processing is necessary to fulfill our service agreement</li>
        <li><strong>Legal Obligation:</strong> Compliance with Kenyan laws and regulations</li>
        <li><strong>Legitimate Interests:</strong> Fraud prevention, security, and service improvement</li>
      </ul>

      <h2>5. Data Sharing and Disclosure</h2>
      
      <h3>5.1 Third-Party Service Providers</h3>
      <p>We may share your information with:</p>
      <ul>
        <li><strong>Payment Processors:</strong> Safaricom M-Pesa for payment processing</li>
        <li><strong>Cloud Hosting:</strong> Secure data storage providers</li>
        <li><strong>Analytics Services:</strong> To improve our platform performance</li>
        <li><strong>Communication Services:</strong> Email and SMS providers for notifications</li>
      </ul>

      <h3>5.2 Legal Requirements</h3>
      <p>We may disclose your information if required by:</p>
      <ul>
        <li>Kenyan law enforcement or regulatory authorities</li>
        <li>Court orders or legal processes</li>
        <li>Protection of our rights or safety of others</li>
        <li>Communications Authority of Kenya (CA) compliance</li>
      </ul>

      <h2>6. Data Security</h2>
      <p>We implement appropriate technical and organizational measures to protect your data:</p>
      <ul>
        <li>Encryption of data in transit and at rest</li>
        <li>Secure access controls and authentication</li>
        <li>Regular security audits and updates</li>
        <li>Employee training on data protection</li>
        <li>Incident response procedures</li>
      </ul>

      <h2>7. Data Retention</h2>
      <p>We retain your personal data for as long as:</p>
      <ul>
        <li>Your account remains active</li>
        <li>Required to provide our services</li>
        <li>Necessary for legal, tax, or accounting purposes (typically 7 years)</li>
        <li>Required by Kenyan law or regulations</li>
      </ul>

      <h2>8. Your Rights Under Kenya Data Protection Act, 2019</h2>
      <p>You have the right to:</p>
      <ul>
        <li><strong>Access:</strong> Request copies of your personal data</li>
        <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
        <li><strong>Erasure:</strong> Request deletion of your data (right to be forgotten)</li>
        <li><strong>Restriction:</strong> Limit how we process your data</li>
        <li><strong>Data Portability:</strong> Receive your data in a portable format</li>
        <li><strong>Object:</strong> Object to certain types of processing</li>
        <li><strong>Withdraw Consent:</strong> Withdraw consent at any time</li>
        <li><strong>Lodge a Complaint:</strong> File a complaint with the Office of the Data Protection Commissioner</li>
      </ul>

      <h2>9. Children's Privacy</h2>
      <p>
        Our services are not intended for children under 18 years. We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.
      </p>

      <h2>10. International Data Transfers</h2>
      <p>
        Your data is primarily stored and processed in Kenya. If we transfer data outside Kenya, we ensure adequate safeguards are in place as required by the Kenya Data Protection Act, 2019.
      </p>

      <h2>11. Cookies and Tracking Technologies</h2>
      <p>We use cookies and similar technologies to:</p>
      <ul>
        <li>Remember your preferences and settings</li>
        <li>Analyze how you use our services</li>
        <li>Provide personalized content</li>
        <li>Detect and prevent fraud</li>
      </ul>
      <p>You can control cookies through your browser settings. See our <a href="/legal/cookie-policy">Cookie Policy</a> for more details.</p>

      <h2>12. Changes to This Privacy Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of material changes by:
      </p>
      <ul>
        <li>Email notification to your registered address</li>
        <li>Prominent notice on our platform</li>
        <li>In-app notifications</li>
      </ul>

      <h2>13. Contact Information</h2>
      <p>For privacy-related inquiries or to exercise your rights, contact us at:</p>
      <div className="bg-muted p-4 rounded-lg my-4">
        <p className="m-0"><strong>PAY N BROWSE Data Protection Officer</strong></p>
        <p className="m-0">Email: privacy@paynbrowse.com</p>
        <p className="m-0">Phone: +254 796 002 630</p>
        <p className="m-0">Address: Nairobi CBD, Kimathi Street IPS Building, 6th Floor, Kenya</p>
      </div>

      <h2>14. Office of the Data Protection Commissioner</h2>
      <p>You have the right to lodge a complaint with:</p>
      <div className="bg-muted p-4 rounded-lg my-4">
        <p className="m-0"><strong>Office of the Data Protection Commissioner</strong></p>
        <p className="m-0">Website: <a href="https://www.odpc.go.ke" target="_blank" rel="noopener noreferrer">www.odpc.go.ke</a></p>
        <p className="m-0">Email: complaints@odpc.go.ke</p>
        <p className="m-0">Phone: +254 (020) 2675316</p>
      </div>

      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 my-8">
        <p className="font-semibold m-0">
          By using PAY N BROWSE, you acknowledge that you have read and understood this Privacy Policy and agree to its terms.
        </p>
      </div>
    </div>
  );
}
