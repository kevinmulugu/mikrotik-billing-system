// src/app/legal/sla/page.tsx
import { Metadata } from 'next';
import { Activity } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Service Level Agreement',
  description: 'PAY N BROWSE Service Level Agreement - Our commitments to service quality and support',
};

export default function SLAPage() {
  return (
    <div className="prose prose-gray dark:prose-invert max-w-none">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="h-8 w-8 text-primary" />
        <h1 className="text-4xl font-bold m-0">Service Level Agreement (SLA)</h1>
      </div>
      
      <p className="text-muted-foreground text-lg">
        Last Updated: {new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 my-6">
        <p className="font-semibold m-0">
          This Service Level Agreement (SLA) defines our commitments to platform availability, performance, and support for PAY N BROWSE users.
        </p>
      </div>

      <h2>1. Scope and Applicability</h2>
      
      <h3>1.1 Covered Services</h3>
      <p>This SLA applies to:</p>
      <ul>
        <li>PAY N BROWSE web platform (dashboard and admin panel)</li>
        <li>REST API services for router management</li>
        <li>Payment processing integration (M-Pesa)</li>
        <li>Voucher generation and validation systems</li>
        <li>Database and data storage services</li>
      </ul>

      <h3>1.2 Not Covered</h3>
      <p>This SLA does NOT cover:</p>
      <ul>
        <li>Your internet service provider (ISP) connectivity</li>
        <li>Third-party services (M-Pesa, Safaricom, Google OAuth)</li>
        <li>Your MikroTik routers or local network equipment</li>
        <li>End-user devices or browsers</li>
        <li>Outages caused by force majeure events</li>
        <li>Issues resulting from violations of our Terms of Service or Acceptable Use Policy</li>
      </ul>

      <h3>1.3 Service Tiers</h3>
      <div className="overflow-x-auto my-4">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="border p-2 text-left">Plan</th>
              <th className="border p-2 text-left">Uptime SLA</th>
              <th className="border p-2 text-left">Support Response</th>
              <th className="border p-2 text-left">Priority</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-2"><strong>Individual/Homeowner</strong></td>
              <td className="border p-2">99.0%</td>
              <td className="border p-2">24-48 hours</td>
              <td className="border p-2">Standard</td>
            </tr>
            <tr>
              <td className="border p-2"><strong>ISP Basic</strong></td>
              <td className="border p-2">99.5%</td>
              <td className="border p-2">12-24 hours</td>
              <td className="border p-2">Priority</td>
            </tr>
            <tr>
              <td className="border p-2"><strong>ISP Pro</strong></td>
              <td className="border p-2">99.9%</td>
              <td className="border p-2">4-8 hours</td>
              <td className="border p-2">Premium</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>2. Uptime Commitment</h2>

      <h3>2.1 Availability Targets</h3>
      <p>We commit to the following monthly uptime percentages:</p>
      <ul>
        <li><strong>99.9% (ISP Pro):</strong> Maximum 43 minutes downtime per month</li>
        <li><strong>99.5% (ISP Basic):</strong> Maximum 3.6 hours downtime per month</li>
        <li><strong>99.0% (Individual):</strong> Maximum 7.2 hours downtime per month</li>
      </ul>

      <h3>2.2 Uptime Measurement</h3>
      <p>Uptime is measured as:</p>
      <div className="bg-muted p-4 rounded-lg my-4">
        <p className="font-mono m-0">Uptime % = (Total Minutes in Month - Downtime Minutes) / Total Minutes in Month × 100</p>
      </div>
      <ul>
        <li>Measured from our monitoring systems</li>
        <li>Calculated monthly (calendar month basis)</li>
        <li>Excludes scheduled maintenance windows</li>
        <li>Covers core platform functionality</li>
      </ul>

      <h3>2.3 Scheduled Maintenance</h3>
      <p>We perform maintenance as follows:</p>
      <ul>
        <li><strong>Frequency:</strong> Up to 4 hours per month</li>
        <li><strong>Timing:</strong> Tuesday-Thursday, 1:00 AM - 5:00 AM EAT (low-traffic hours)</li>
        <li><strong>Notice:</strong> 7 days advance notification via email and platform banner</li>
        <li><strong>Emergency Maintenance:</strong> May occur with 1-hour notice for critical security patches</li>
      </ul>
      <p className="text-sm text-muted-foreground">
        Scheduled maintenance does not count against uptime SLA.
      </p>

      <h2>3. Performance Standards</h2>

      <h3>3.1 Response Times</h3>
      <p>Target response times for platform operations:</p>
      <div className="bg-muted p-4 rounded-lg my-4">
        <ul className="my-0">
          <li><strong>Page Load Time:</strong> &lt; 2 seconds (95th percentile)</li>
          <li><strong>API Response Time:</strong> &lt; 500ms (95th percentile)</li>
          <li><strong>Payment Processing:</strong> &lt; 30 seconds (M-Pesa confirmation)</li>
          <li><strong>Voucher Generation:</strong> &lt; 3 seconds</li>
          <li><strong>Router Commands:</strong> &lt; 5 seconds (depends on router response)</li>
        </ul>
      </div>
      <p className="text-sm text-muted-foreground">
        Actual times may vary based on network conditions and third-party services.
        </p>

      <h3>3.2 Scalability</h3>
      <p>Our infrastructure scales to support:</p>
      <ul>
        <li>Up to 1,000 concurrent dashboard users</li>
        <li>100,000+ active voucher users per month</li>
        <li>10,000+ API requests per minute</li>
        <li>Auto-scaling during peak loads</li>
      </ul>

      <h2>4. Support Commitments</h2>

      <h3>4.1 Support Channels</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
        <div className="bg-muted p-4 rounded-lg">
          <p className="font-semibold m-0">Email Support</p>
          <p className="m-0 text-sm mt-2">support@paynbrowse.com</p>
          <p className="m-0 text-sm">Available 24/7</p>
          <p className="m-0 text-sm">Response based on plan tier</p>
        </div>
        <div className="bg-muted p-4 rounded-lg">
          <p className="font-semibold m-0">Phone Support (ISP Plans Only)</p>
          <p className="m-0 text-sm mt-2">+254 796 002 630</p>
          <p className="m-0 text-sm">Monday-Friday: 8 AM - 6 PM EAT</p>
          <p className="m-0 text-sm">Emergency: 24/7 for critical issues</p>
        </div>
        <div className="bg-muted p-4 rounded-lg">
          <p className="font-semibold m-0">In-Platform Tickets</p>
          <p className="m-0 text-sm mt-2">Create tickets from dashboard</p>
          <p className="m-0 text-sm">Track status in real-time</p>
          <p className="m-0 text-sm">Attach screenshots and logs</p>
        </div>
        <div className="bg-muted p-4 rounded-lg">
          <p className="font-semibold m-0">Knowledge Base</p>
          <p className="m-0 text-sm mt-2">Self-service documentation</p>
          <p className="m-0 text-sm">Video tutorials and guides</p>
          <p className="m-0 text-sm">FAQ and troubleshooting</p>
        </div>
      </div>

      <h3>4.2 Response Time SLA</h3>
      <div className="overflow-x-auto my-4">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="border p-2 text-left">Severity</th>
              <th className="border p-2 text-left">Description</th>
              <th className="border p-2 text-left">ISP Pro</th>
              <th className="border p-2 text-left">ISP Basic</th>
              <th className="border p-2 text-left">Individual</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-2"><strong>Critical</strong></td>
              <td className="border p-2">Platform down, payment failures, data loss</td>
              <td className="border p-2">1 hour</td>
              <td className="border p-2">2 hours</td>
              <td className="border p-2">4 hours</td>
            </tr>
            <tr>
              <td className="border p-2"><strong>High</strong></td>
              <td className="border p-2">Major features broken, security issues</td>
              <td className="border p-2">4 hours</td>
              <td className="border p-2">8 hours</td>
              <td className="border p-2">24 hours</td>
            </tr>
            <tr>
              <td className="border p-2"><strong>Medium</strong></td>
              <td className="border p-2">Minor features impacted, workaround available</td>
              <td className="border p-2">8 hours</td>
              <td className="border p-2">24 hours</td>
              <td className="border p-2">48 hours</td>
            </tr>
            <tr>
              <td className="border p-2"><strong>Low</strong></td>
              <td className="border p-2">Questions, feature requests, cosmetic issues</td>
              <td className="border p-2">24 hours</td>
              <td className="border p-2">48 hours</td>
              <td className="border p-2">72 hours</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        Response times measured during business hours (Monday-Friday, 8 AM - 6 PM EAT). Critical issues receive 24/7 attention.
      </p>

      <h3>4.3 Resolution Time Targets</h3>
      <p>We aim to resolve issues within:</p>
      <ul>
        <li><strong>Critical:</strong> 4-24 hours (depends on complexity)</li>
        <li><strong>High:</strong> 1-3 business days</li>
        <li><strong>Medium:</strong> 3-7 business days</li>
        <li><strong>Low:</strong> 7-14 business days</li>
      </ul>
      <p className="text-sm text-muted-foreground">
        Complex issues may require longer resolution times. We'll keep you updated on progress.
      </p>

      <h2>5. Data Protection and Backup</h2>

      <h3>5.1 Backup Schedule</h3>
      <ul>
        <li><strong>Database:</strong> Continuous replication + daily snapshots (30-day retention)</li>
        <li><strong>Configuration:</strong> Daily backups (90-day retention)</li>
        <li><strong>Transaction Logs:</strong> Real-time archiving (7-year retention for compliance)</li>
      </ul>

      <h3>5.2 Disaster Recovery</h3>
      <p>In case of catastrophic failure:</p>
      <ul>
        <li><strong>Recovery Time Objective (RTO):</strong> 4 hours (time to restore service)</li>
        <li><strong>Recovery Point Objective (RPO):</strong> 1 hour (maximum data loss)</li>
        <li><strong>Geo-Redundancy:</strong> Data replicated across multiple regions</li>
        <li><strong>Failover:</strong> Automatic for critical services</li>
      </ul>

      <h3>5.3 Data Security</h3>
      <p>We implement:</p>
      <ul>
        <li>256-bit SSL/TLS encryption for data in transit</li>
        <li>AES-256 encryption for data at rest</li>
        <li>Regular security audits and penetration testing</li>
        <li>SOC 2 Type II compliant infrastructure (hosting provider)</li>
        <li>Compliance with Kenya Data Protection Act, 2019</li>
      </ul>

      <h2>6. Incident Management</h2>

      <h3>6.1 Incident Detection</h3>
      <p>We monitor services 24/7 using:</p>
      <ul>
        <li>Automated uptime monitoring (1-minute intervals)</li>
        <li>Performance metrics and alerting</li>
        <li>Error tracking and logging</li>
        <li>User-reported issues</li>
      </ul>

      <h3>6.2 Incident Response</h3>
      <p>When incidents occur:</p>
      <ol>
        <li><strong>Detection:</strong> Automated alerts notify on-call engineers</li>
        <li><strong>Assessment:</strong> Severity classification within 15 minutes</li>
        <li><strong>Communication:</strong> Status page updated + email notifications for major incidents</li>
        <li><strong>Resolution:</strong> Engineers work to restore service</li>
        <li><strong>Post-Mortem:</strong> Analysis and prevention measures for major incidents</li>
      </ol>

      <h3>6.3 Status Updates</h3>
      <p>During outages, we provide:</p>
      <ul>
        <li>Real-time status page: status.paynbrowse.com</li>
        <li>Initial update within 30 minutes of incident detection</li>
        <li>Progress updates every 2 hours for ongoing incidents</li>
        <li>Post-incident report within 5 business days</li>
      </ul>

      <h2>7. SLA Credits and Compensation</h2>

      <h3>7.1 Eligibility</h3>
      <p>SLA credits apply when:</p>
      <ul>
        <li>Monthly uptime falls below committed percentage</li>
        <li>You have an active paid subscription (ISP Basic or ISP Pro)</li>
        <li>You report the outage within 30 days</li>
        <li>Downtime was within our control (not third-party or force majeure)</li>
      </ul>

      <h3>7.2 Credit Calculation</h3>
      <div className="overflow-x-auto my-4">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="border p-2 text-left">Actual Uptime</th>
              <th className="border p-2 text-left">Service Credit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-2">99.0% - 99.49% (ISP Pro breach)</td>
              <td className="border p-2">10% of monthly fee</td>
            </tr>
            <tr>
              <td className="border p-2">98.0% - 98.99%</td>
              <td className="border p-2">25% of monthly fee</td>
            </tr>
            <tr>
              <td className="border p-2">95.0% - 97.99%</td>
              <td className="border p-2">50% of monthly fee</td>
            </tr>
            <tr>
              <td className="border p-2">&lt; 95.0%</td>
              <td className="border p-2">100% of monthly fee</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>7.3 Claiming Credits</h3>
      <p>To claim SLA credits:</p>
      <ol>
        <li>Submit request to sla@paynbrowse.com within 30 days of incident</li>
        <li>Include: Account details, incident date/time, duration of outage</li>
        <li>We verify claim within 10 business days</li>
        <li>Credits applied to next month's invoice</li>
      </ol>
      <p className="text-sm text-muted-foreground">
        Credits are the sole remedy for SLA breaches. Maximum credit: 100% of one month's fee.
      </p>

      <h2>8. Limitations and Exclusions</h2>

      <h3>8.1 No SLA Credits For:</h3>
      <ul>
        <li>Outages caused by your actions or negligence</li>
        <li>Issues with third-party services (M-Pesa, ISPs, OAuth providers)</li>
        <li>Force majeure events (natural disasters, wars, terrorism)</li>
        <li>Scheduled maintenance with proper notice</li>
        <li>DDoS attacks or other malicious activities targeting our infrastructure</li>
        <li>Your internet connectivity or local network issues</li>
        <li>Browser compatibility or end-user device problems</li>
        <li>Beta features or experimental functionality</li>
      </ul>

      <h3>8.2 Maximum Liability</h3>
      <p>
        Total SLA credits in any 12-month period shall not exceed 100% of fees paid during that period. This is in addition to limitations in our Terms of Service.
      </p>

      <h2>9. Third-Party Dependencies</h2>

      <h3>9.1 Payment Processing (M-Pesa)</h3>
      <ul>
        <li>Safaricom uptime: ~99.5% (per their SLA)</li>
        <li>Payment delays during Safaricom outages expected</li>
        <li>We provide manual reconciliation tools</li>
      </ul>

      <h3>9.2 Cloud Infrastructure</h3>
      <ul>
        <li>Hosting provider: 99.99% uptime guarantee</li>
        <li>Multi-region redundancy for critical services</li>
        <li>CDN for static assets</li>
      </ul>

      <h3>9.3 Authentication (Google OAuth)</h3>
      <ul>
        <li>Google uptime: ~99.9%</li>
        <li>Email/password login available as backup</li>
      </ul>

      <h2>10. Monitoring and Reporting</h2>

      <h3>10.1 Public Status Page</h3>
      <p>Real-time system status available at: <strong>status.paynbrowse.com</strong></p>
      <ul>
        <li>Current operational status</li>
        <li>Scheduled maintenance calendar</li>
        <li>Incident history</li>
        <li>Subscribe to status updates</li>
      </ul>

      <h3>10.2 Monthly SLA Reports (ISP Plans)</h3>
      <p>Receive automated reports showing:</p>
      <ul>
        <li>Actual uptime percentage</li>
        <li>Incidents and resolutions</li>
        <li>Performance metrics</li>
        <li>Support ticket statistics</li>
      </ul>

      <h2>11. Continuous Improvement</h2>
      <p>We are committed to:</p>
      <ul>
        <li>Regular infrastructure upgrades</li>
        <li>Quarterly performance reviews</li>
        <li>Incorporating user feedback</li>
        <li>Adopting industry best practices</li>
        <li>Expanding support capabilities</li>
      </ul>

      <h2>12. SLA Changes</h2>
      <p>We may modify this SLA to:</p>
      <ul>
        <li>Improve service commitments</li>
        <li>Reflect infrastructure changes</li>
        <li>Address new service offerings</li>
      </ul>
      <p>
        Material changes reducing commitments will be communicated 90 days in advance. Continued use after changes constitutes acceptance.
      </p>

      <h2>13. Contact Information</h2>
      <div className="bg-muted p-4 rounded-lg my-4">
        <p className="m-0"><strong>General Support:</strong> support@paynbrowse.com</p>
        <p className="m-0"><strong>SLA Claims:</strong> sla@paynbrowse.com</p>
        <p className="m-0"><strong>Critical Issues (ISP Plans):</strong> +254 796 002 630</p>
        <p className="m-0"><strong>Status Updates:</strong> status.paynbrowse.com</p>
        <p className="m-0 mt-2"><strong>Business Hours:</strong> Monday - Friday, 8:00 AM - 6:00 PM EAT</p>
        <p className="m-0"><strong>Critical Support:</strong> 24/7 for ISP Pro customers</p>
      </div>

      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 my-8">
        <p className="font-semibold m-0">
          PAY N BROWSE is committed to providing reliable, high-quality services. This SLA represents our dedication to your success. Thank you for trusting us with your WiFi hotspot and PPPoE management needs.
        </p>
      </div>
    </div>
  );
}
