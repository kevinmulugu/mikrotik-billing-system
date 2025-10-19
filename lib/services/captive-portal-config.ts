// File: src/lib/services/captive-portal-config.ts

import { ObjectId } from 'mongodb';

interface Router {
  _id: ObjectId;
  customerId: ObjectId;
  routerInfo: {
    name: string;
    location?: {
      name?: string;
      address?: string;
    };
  };
}

interface Customer {
  _id: ObjectId;
  businessInfo: {
    name: string;
    contact: {
      phone?: string;
      email?: string;
    };
  };
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    companyName?: string;
  };
}

export function generateApiJsonContent(
  router: Router,
  customer: Customer,
  environment: 'development' | 'staging' | 'production' = 'production'
): string {
  // Determine base URL based on environment
  const baseUrls = {
    development: 'http://localhost:3000',
    staging: 'https://staging.yourdomain.com',
    production: 'https://yourdomain.com',
  };

  const baseUrl = baseUrls[environment];

  // Build location string
  const location = router.routerInfo.location?.name || 
                   router.routerInfo.location?.address || 
                   'WiFi Hotspot';

  // Build support info
  const support = {
    name: `${customer.businessInfo.name} Support`,
    phone: customer.businessInfo.contact.phone || '+254700000000',
    email: customer.businessInfo.contact.email || 'support@example.com',
    hours: '24/7',
    whatsapp: customer.businessInfo.contact.phone || '+254700000000',
  };

  // Build branding info (fallback)
  const branding = {
    company_name: customer.branding?.companyName || customer.businessInfo.name,
    primary_color: customer.branding?.primaryColor || '#3B82F6',
    secondary_color: customer.branding?.secondaryColor || '#10B981',
    logo_url: customer.branding?.logo || '/default-logo.png',
  };

  // Build api.json object
  const apiJson = {
    router_id: router._id.toString(),
    customer_id: customer._id.toString(),
    router_name: router.routerInfo.name,
    location: location,
    api: {
      base_url: baseUrl,
      endpoints: {
        branding: '/api/captive/branding',
        packages: '/api/captive/packages',
        verify_mpesa: '/api/captive/verify-mpesa',
        purchase: '/api/captive/purchase',
        payment_status: '/api/captive/payment-status',
      },
      version: '1.0',
    },
    support: support,
    branding: branding,
    features: {
      voucher_login: true,
      username_password_login: true,
      mpesa_code_login: true,
      package_purchase: true,
      mpesa_payment: true,
      show_pricing: true,
    },
    payment: {
      currency: 'KSh',
      tax_rate: 0,
      payment_methods: ['mpesa'],
    },
    metadata: {
      generated_at: new Date().toISOString(),
      version: '1.0.0',
      environment: environment,
    },
  };

  // Return formatted JSON string
  return JSON.stringify(apiJson, null, 2);
}