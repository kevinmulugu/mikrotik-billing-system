// src/app/legal/cookie-policy/page.tsx
import { Metadata } from 'next';
import { Cookie } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'PAY N BROWSE Cookie Policy - How we use cookies and tracking technologies',
};

export default function CookiePolicyPage() {
  return (
    <div className="prose prose-gray dark:prose-invert max-w-none">
      <div className="flex items-center gap-3 mb-6">
        <Cookie className="h-8 w-8 text-primary" />
        <h1 className="text-4xl font-bold m-0">Cookie Policy</h1>
      </div>
      
      <p className="text-muted-foreground text-lg">
        Last Updated: {new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 my-6">
        <p className="font-semibold m-0">
          This Cookie Policy explains how PAY N BROWSE uses cookies and similar tracking technologies when you use our platform.
        </p>
      </div>

      <h2>1. What Are Cookies?</h2>
      <p>
        Cookies are small text files stored on your device when you visit websites. They help websites remember your preferences, authenticate your identity, and analyze how you use the service.
      </p>

      <h2>2. How We Use Cookies</h2>
      <p>PAY N BROWSE uses cookies to:</p>
      <ul>
        <li>Keep you signed in to your account</li>
        <li>Remember your preferences and settings</li>
        <li>Provide security features and fraud detection</li>
        <li>Analyze platform usage and performance</li>
        <li>Improve user experience and functionality</li>
        <li>Comply with legal requirements</li>
      </ul>

      <h2>3. Types of Cookies We Use</h2>

      <h3>3.1 Strictly Necessary Cookies</h3>
      <p>
        <strong>Purpose:</strong> Essential for the platform to function. Cannot be disabled.
      </p>
      <div className="bg-muted p-4 rounded-lg my-4">
        <p className="font-semibold">Examples:</p>
        <ul className="my-2">
          <li><strong>Authentication Cookies:</strong> Keep you logged in (next-auth.session-token)</li>
          <li><strong>Security Cookies:</strong> CSRF protection tokens</li>
          <li><strong>Load Balancing:</strong> Route requests to correct servers</li>
        </ul>
        <p className="m-0 text-sm"><strong>Duration:</strong> Session or up to 30 days</p>
      </div>

      <h3>3.2 Functional Cookies</h3>
      <p>
        <strong>Purpose:</strong> Remember your preferences and enhance functionality.
      </p>
      <div className="bg-muted p-4 rounded-lg my-4">
        <p className="font-semibold">Examples:</p>
        <ul className="my-2">
          <li><strong>Theme Preference:</strong> Remember dark/light mode selection</li>
          <li><strong>Language Preference:</strong> Store your language choice</li>
          <li><strong>Dashboard Layout:</strong> Remember custom dashboard configurations</li>
          <li><strong>Cookie Consent:</strong> Store your cookie preferences (cookie-consent)</li>
        </ul>
        <p className="m-0 text-sm"><strong>Duration:</strong> Up to 1 year</p>
      </div>

      <h3>3.3 Analytics Cookies</h3>
      <p>
        <strong>Purpose:</strong> Help us understand how users interact with our platform.
      </p>
      <div className="bg-muted p-4 rounded-lg my-4">
        <p className="font-semibold">Examples:</p>
        <ul className="my-2">
          <li><strong>Usage Analytics:</strong> Track page views and feature usage</li>
          <li><strong>Performance Monitoring:</strong> Identify slow-loading pages</li>
          <li><strong>Error Tracking:</strong> Detect and fix technical issues</li>
        </ul>
        <p className="m-0 text-sm"><strong>Third-Party Services:</strong> We may use analytics services (details below)</p>
        <p className="m-0 text-sm"><strong>Duration:</strong> Up to 2 years</p>
      </div>

      <h3>3.4 Marketing/Advertising Cookies</h3>
      <p>
        <strong>Current Status:</strong> We do not currently use marketing or advertising cookies. If we introduce these in the future, we will update this policy and seek your consent.
      </p>

      <h2>4. Third-Party Cookies</h2>
      <p>We may use third-party services that set their own cookies:</p>

      <h3>4.1 Authentication Providers</h3>
      <div className="bg-muted p-4 rounded-lg my-4">
        <p className="m-0"><strong>Google OAuth:</strong> If you sign in with Google, Google may set cookies for authentication and security.</p>
        <p className="m-0 text-sm mt-2">Privacy Policy: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">https://policies.google.com/privacy</a></p>
      </div>

      <h3>4.2 Payment Processors</h3>
      <div className="bg-muted p-4 rounded-lg my-4">
        <p className="m-0"><strong>M-Pesa/Safaricom:</strong> Payment processing may involve cookies from Safaricom's systems.</p>
        <p className="m-0 text-sm mt-2">Privacy Policy: <a href="https://www.safaricom.co.ke/privacy-policy" target="_blank" rel="noopener noreferrer">https://www.safaricom.co.ke/privacy-policy</a></p>
      </div>

      <h3>4.3 Cloud Infrastructure</h3>
      <div className="bg-muted p-4 rounded-lg my-4">
        <p className="m-0"><strong>Hosting Providers:</strong> Our hosting infrastructure may use cookies for load balancing and security.</p>
      </div>

      <h2>5. Local Storage and Session Storage</h2>
      <p>
        In addition to cookies, we use browser storage technologies:
      </p>
      <ul>
        <li><strong>localStorage:</strong> Stores preferences and consent choices (persists until cleared)</li>
        <li><strong>sessionStorage:</strong> Temporary storage for session-specific data (cleared when tab closes)</li>
        <li><strong>IndexedDB:</strong> May be used for caching data to improve performance</li>
      </ul>

      <h2>6. How Long Do Cookies Last?</h2>
      
      <h3>6.1 Session Cookies</h3>
      <p>Deleted when you close your browser. Used for temporary authentication and state management.</p>

      <h3>6.2 Persistent Cookies</h3>
      <p>Remain on your device for a set period or until manually deleted. Duration varies by cookie type:</p>
      <ul>
        <li><strong>Authentication:</strong> 30 days</li>
        <li><strong>Preferences:</strong> 1 year</li>
        <li><strong>Analytics:</strong> Up to 2 years</li>
        <li><strong>Consent:</strong> 1 year (then re-prompt)</li>
      </ul>

      <h2>7. Your Cookie Choices</h2>

      <h3>7.1 Cookie Consent Banner</h3>
      <p>
        When you first visit PAY N BROWSE, we display a cookie consent banner. You can:
      </p>
      <ul>
        <li><strong>Accept All:</strong> Allow all cookies for full functionality</li>
        <li><strong>Decline:</strong> Only strictly necessary cookies will be used</li>
      </ul>

      <h3>7.2 Browser Controls</h3>
      <p>Most browsers allow you to control cookies through settings:</p>
      <ul>
        <li>Block all cookies (may break website functionality)</li>
        <li>Block third-party cookies only</li>
        <li>Clear cookies when you close the browser</li>
        <li>View and delete individual cookies</li>
      </ul>

      <h3>7.3 Browser-Specific Instructions</h3>
      <div className="bg-muted p-4 rounded-lg my-4">
        <p className="font-semibold">How to manage cookies:</p>
        <ul className="my-2">
          <li><strong>Chrome:</strong> Settings → Privacy and security → Cookies and other site data</li>
          <li><strong>Firefox:</strong> Preferences → Privacy & Security → Cookies and Site Data</li>
          <li><strong>Safari:</strong> Preferences → Privacy → Manage Website Data</li>
          <li><strong>Edge:</strong> Settings → Cookies and site permissions → Cookies and data stored</li>
        </ul>
      </div>

      <h3>7.4 Opt-Out Links</h3>
      <p>If we use third-party analytics in the future, opt-out links will be provided here.</p>

      <h2>8. Impact of Disabling Cookies</h2>
      <p>
        Disabling cookies may affect your experience:
      </p>
      <ul>
        <li>❌ Cannot stay logged in</li>
        <li>❌ Preferences not remembered</li>
        <li>❌ Some features may not work correctly</li>
        <li>❌ Security features may be compromised</li>
        <li>✅ Can still browse public pages</li>
      </ul>

      <h2>9. Mobile Apps (Future)</h2>
      <p>
        If we develop mobile apps, similar tracking technologies may be used:
      </p>
      <ul>
        <li>Mobile device identifiers</li>
        <li>App-specific storage</li>
        <li>Push notification tokens</li>
      </ul>
      <p>You'll be able to control these through your device settings.</p>

      <h2>10. Do Not Track Signals</h2>
      <p>
        Some browsers offer "Do Not Track" (DNT) signals. Our platform respects DNT signals where technically feasible, limiting non-essential tracking when DNT is enabled.
      </p>

      <h2>11. Kenya Data Protection Compliance</h2>
      <p>
        Our use of cookies complies with the Kenya Data Protection Act, 2019:
      </p>
      <ul>
        <li>We obtain consent before using non-essential cookies</li>
        <li>We provide clear information about cookie purposes</li>
        <li>You can withdraw consent at any time</li>
        <li>We keep cookies secure and process data lawfully</li>
      </ul>

      <h2>12. International Users</h2>
      <p>
        While primarily serving Kenya, international users may be subject to additional regulations:
      </p>
      <ul>
        <li><strong>EU Users:</strong> GDPR cookie consent requirements apply</li>
        <li><strong>UK Users:</strong> UK GDPR and PECR compliance</li>
        <li><strong>California Users:</strong> CCPA disclosure requirements</li>
      </ul>

      <h2>13. Cookie List</h2>
      <p>Current cookies used by PAY N BROWSE:</p>
      
      <div className="overflow-x-auto my-4">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="border p-2 text-left">Cookie Name</th>
              <th className="border p-2 text-left">Type</th>
              <th className="border p-2 text-left">Purpose</th>
              <th className="border p-2 text-left">Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-2"><code>next-auth.session-token</code></td>
              <td className="border p-2">Strictly Necessary</td>
              <td className="border p-2">Authentication session</td>
              <td className="border p-2">30 days</td>
            </tr>
            <tr>
              <td className="border p-2"><code>next-auth.csrf-token</code></td>
              <td className="border p-2">Strictly Necessary</td>
              <td className="border p-2">CSRF protection</td>
              <td className="border p-2">Session</td>
            </tr>
            <tr>
              <td className="border p-2"><code>cookie-consent</code></td>
              <td className="border p-2">Functional</td>
              <td className="border p-2">Remember cookie choice</td>
              <td className="border p-2">1 year</td>
            </tr>
            <tr>
              <td className="border p-2"><code>theme</code></td>
              <td className="border p-2">Functional</td>
              <td className="border p-2">Dark/light mode preference</td>
              <td className="border p-2">1 year</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>14. Changes to This Cookie Policy</h2>
      <p>
        We may update this Cookie Policy to reflect changes in our practices or legal requirements. When we make material changes:
      </p>
      <ul>
        <li>Updated "Last Updated" date will be shown</li>
        <li>Email notification to registered users</li>
        <li>Prominent notice on the platform</li>
        <li>May re-prompt for cookie consent</li>
      </ul>

      <h2>15. Contact Us About Cookies</h2>
      <div className="bg-muted p-4 rounded-lg my-4">
        <p className="m-0"><strong>Questions about our use of cookies?</strong></p>
        <p className="m-0 mt-2">Email: privacy@paynbrowse.com</p>
        <p className="m-0">Subject: Cookie Policy Inquiry</p>
        <p className="m-0 mt-2">Or use our general contact:</p>
        <p className="m-0">Email: support@paynbrowse.com</p>
        <p className="m-0">Phone: +254 796 002 630</p>
      </div>

      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 my-8">
        <p className="font-semibold m-0">
          By continuing to use PAY N BROWSE after accepting cookies, you consent to our use of cookies as described in this policy. You can change your cookie preferences at any time through your browser settings.
        </p>
      </div>
    </div>
  );
}
