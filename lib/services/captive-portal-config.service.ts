// File: src/services/captive-portal-config.service.ts

import { ObjectId } from 'mongodb';

/**
 * ============================================================================
 * TYPE DEFINITIONS
 * ============================================================================
 */

interface Router {
  _id: ObjectId;
  customerId: ObjectId;
  routerInfo: {
    name: string;
    model?: string;
    serialNumber?: string;
    location?: {
      name?: string;
      address?: string;
      coordinates?: {
        latitude?: number;
        longitude?: number;
      };
    };
  };
  connection: {
    ipAddress: string;
    port?: number;
    apiUser?: string;
    apiPassword?: string;
  };
  configuration?: {
    hotspot?: {
      enabled?: boolean;
      ssid?: string;
    };
    pppoe?: {
      enabled?: boolean;
    };
  };
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface Customer {
  _id: ObjectId;
  userId?: ObjectId;
  businessInfo: {
    name: string;
    type?: string;
    contact?: {
      phone?: string;
      email?: string;
      website?: string;
    };
    address?: {
      street?: string;
      city?: string;
      county?: string;
      country?: string;
    };
  };
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    companyName?: string;
    termsUrl?: string;
    privacyUrl?: string;
  };
  paymentSettings?: {
    preferredMethod?: string;
    paybillNumber?: string;
    commissionRate?: number;
  };
  subscription?: {
    plan?: string;
    features?: string[];
  };
}

interface ApiJsonConfig {
  router_id: string;
  customer_id: string;
  router_name: string;
  location: string;
  api: {
    base_url: string;
    endpoints: {
      branding: string;
      packages: string;
      verify_mpesa: string;
      purchase: string;
      payment_status: string;
    };
    version: string;
  };
  support: {
    name: string;
    phone: string;
    email: string;
    hours: string;
    whatsapp?: string;
  };
  branding: {
    company_name: string;
    primary_color: string;
    secondary_color: string;
    logo_url: string;
  };
  features: {
    voucher_login: boolean;
    username_password_login: boolean;
    mpesa_code_login: boolean;
    package_purchase: boolean;
    mpesa_payment: boolean;
    show_pricing: boolean;
  };
  payment: {
    currency: string;
    tax_rate: number;
    payment_methods: string[];
  };
  metadata: {
    generated_at: string;
    version: string;
    environment: string;
  };
}

type Environment = 'development' | 'staging' | 'production';

/**
 * ============================================================================
 * MAIN SERVICE CLASS
 * ============================================================================
 */

export class CaptivePortalConfigService {
  private readonly DEFAULT_PRIMARY_COLOR = '#3B82F6';
  private readonly DEFAULT_SECONDARY_COLOR = '#10B981';
  private readonly DEFAULT_LOGO_URL = '/default-logo.png';
  private readonly DEFAULT_PHONE = '+254700000000';
  private readonly DEFAULT_EMAIL = 'support@example.com';
  private readonly CONFIG_VERSION = '1.0.0';

  /**
   * Generate api.json configuration for a router
   * 
   * @param router - Router document from database
   * @param customer - Customer document from database
   * @param environment - Deployment environment
   * @returns JSON string ready for upload to MikroTik
   */
  generateApiJson(
    router: Router,
    customer: Customer,
    environment: Environment = 'production'
  ): string {
    const config = this.buildConfig(router, customer, environment);
    return JSON.stringify(config, null, 2);
  }

  /**
   * Generate api.json and return as parsed object
   * Useful for testing or further processing
   * 
   * @param router - Router document from database
   * @param customer - Customer document from database
   * @param environment - Deployment environment
   * @returns Parsed configuration object
   */
  generateApiJsonObject(
    router: Router,
    customer: Customer,
    environment: Environment = 'production'
  ): ApiJsonConfig {
    return this.buildConfig(router, customer, environment);
  }

  /**
   * ============================================================================
   * PRIVATE HELPER METHODS
   * ============================================================================
   */

  /**
   * Build complete configuration object
   */
  private buildConfig(
    router: Router,
    customer: Customer,
    environment: Environment
  ): ApiJsonConfig {
    return {
      router_id: this.getRouterId(router),
      customer_id: this.getCustomerId(customer),
      router_name: this.getRouterName(router),
      location: this.getLocation(router),
      api: this.buildApiSection(environment),
      support: this.buildSupportSection(customer),
      branding: this.buildBrandingSection(customer),
      features: this.buildFeaturesSection(router, customer),
      payment: this.buildPaymentSection(),
      metadata: this.buildMetadataSection(environment),
    };
  }

  /**
   * Get router ID as string
   */
  private getRouterId(router: Router): string {
    return router._id.toString();
  }

  /**
   * Get customer ID as string
   */
  private getCustomerId(customer: Customer): string {
    return customer._id.toString();
  }

  /**
   * Get router name with fallback
   */
  private getRouterName(router: Router): string {
    return router.routerInfo.name || 'WiFi Router';
  }

  /**
   * Get location string with fallback
   */
  private getLocation(router: Router): string {
    if (router.routerInfo.location?.name) {
      return router.routerInfo.location.name;
    }
    if (router.routerInfo.location?.address) {
      return router.routerInfo.location.address;
    }
    return 'WiFi Hotspot';
  }

  /**
   * Build API section with environment-specific base URL
   */
  private buildApiSection(environment: Environment) {
    const baseUrls: Record<Environment, string> = {
      development: process.env.API_BASE_URL_DEV || 'http://localhost:3000',
      staging: process.env.API_BASE_URL_STAGING || 'https://staging-api.yourdomain.com',
      production: process.env.API_BASE_URL_PROD || 'https://api.yourdomain.com',
    };

    return {
      base_url: baseUrls[environment],
      endpoints: {
        branding: '/api/captive/branding',
        packages: '/api/captive/packages',
        verify_mpesa: '/api/captive/verify-mpesa',
        purchase: '/api/captive/purchase',
        payment_status: '/api/captive/payment-status',
      },
      version: '1.0',
    };
  }

  /**
   * Build support section from customer data
   */
  private buildSupportSection(customer: Customer) {
    const contact = customer.businessInfo.contact;
    const businessName = customer.businessInfo.name;

    const phone = contact?.phone || this.DEFAULT_PHONE;
    const email = contact?.email || this.DEFAULT_EMAIL;

    return {
      name: `${businessName} Support`,
      phone: phone,
      email: email,
      hours: '24/7',
      whatsapp: phone, // Use same phone for WhatsApp
    };
  }

  /**
   * Build branding section from customer data
   */
  private buildBrandingSection(customer: Customer) {
    const branding = customer.branding;
    const businessName = customer.businessInfo.name;

    return {
      company_name: branding?.companyName || businessName,
      primary_color: branding?.primaryColor || this.DEFAULT_PRIMARY_COLOR,
      secondary_color: branding?.secondaryColor || this.DEFAULT_SECONDARY_COLOR,
      logo_url: branding?.logo || this.DEFAULT_LOGO_URL,
    };
  }

  /**
   * Build features section based on router and customer settings
   */
  private buildFeaturesSection(router: Router, customer: Customer) {
    // Check if hotspot is enabled
    const hotspotEnabled = router.configuration?.hotspot?.enabled !== false;
    
    // Check if PPPoE is enabled (for username/password login)
    const pppoeEnabled = router.configuration?.pppoe?.enabled === true;

    // Check customer subscription features
    const features = customer.subscription?.features || [];
    const hasPurchaseFeature = features.includes('package_purchase') || 
                               customer.subscription?.plan !== 'basic';

    return {
      voucher_login: hotspotEnabled,
      username_password_login: pppoeEnabled,
      mpesa_code_login: true, // Always enabled for Kenya market
      package_purchase: hasPurchaseFeature,
      mpesa_payment: hasPurchaseFeature,
      show_pricing: true,
    };
  }

  /**
   * Build payment section (Kenya defaults)
   */
  private buildPaymentSection() {
    return {
      currency: 'KSh',
      tax_rate: 0, // VAT can be added later if needed
      payment_methods: ['mpesa'],
    };
  }

  /**
   * Build metadata section
   */
  private buildMetadataSection(environment: Environment) {
    return {
      generated_at: new Date().toISOString(),
      version: this.CONFIG_VERSION,
      environment: environment,
    };
  }

  /**
   * ============================================================================
   * VALIDATION METHODS
   * ============================================================================
   */

  /**
   * Validate router data before generating config
   */
  validateRouter(router: Router): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!router._id) {
      errors.push('Router ID is required');
    }

    if (!router.customerId) {
      errors.push('Customer ID is required');
    }

    if (!router.routerInfo?.name) {
      errors.push('Router name is required');
    }

    if (!router.connection?.ipAddress) {
      errors.push('Router IP address is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate customer data before generating config
   */
  validateCustomer(customer: Customer): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!customer._id) {
      errors.push('Customer ID is required');
    }

    if (!customer.businessInfo?.name) {
      errors.push('Business name is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * ============================================================================
   * UTILITY METHODS
   * ============================================================================
   */

  /**
   * Generate multiple api.json files for batch router setup
   */
  generateBatch(
    routers: Router[],
    customers: Map<string, Customer>,
    environment: Environment = 'production'
  ): Map<string, string> {
    const configs = new Map<string, string>();

    for (const router of routers) {
      const customerId = router.customerId.toString();
      const customer = customers.get(customerId);

      if (!customer) {
        console.error(`Customer not found for router ${router._id}`);
        continue;
      }

      const routerId = router._id.toString();
      const config = this.generateApiJson(router, customer, environment);
      configs.set(routerId, config);
    }

    return configs;
  }

  /**
   * Compare two configurations to detect changes
   */
  hasConfigChanged(oldConfig: string, newConfig: string): boolean {
    try {
      const old = JSON.parse(oldConfig);
      const newParsed = JSON.parse(newConfig);

      // Ignore metadata.generated_at for comparison
      delete old.metadata?.generated_at;
      delete newParsed.metadata?.generated_at;

      return JSON.stringify(old) !== JSON.stringify(newParsed);
    } catch (error) {
      console.error('Error comparing configs:', error);
      return true; // Assume changed if parsing fails
    }
  }

  /**
   * Extract router ID from existing api.json content
   */
  extractRouterId(apiJsonContent: string): string | null {
    try {
      const config = JSON.parse(apiJsonContent);
      return config.router_id || null;
    } catch (error) {
      console.error('Error extracting router ID:', error);
      return null;
    }
  }

  /**
   * Update specific section of existing config
   */
  updateConfigSection(
    existingConfig: string,
    section: keyof ApiJsonConfig,
    newData: any
  ): string {
    try {
      const config = JSON.parse(existingConfig) as ApiJsonConfig;
      config[section] = newData;
      config.metadata.generated_at = new Date().toISOString();
      return JSON.stringify(config, null, 2);
    } catch (error) {
      console.error('Error updating config section:', error);
      throw new Error('Failed to update configuration');
    }
  }
}

/**
 * ============================================================================
 * SINGLETON INSTANCE EXPORT
 * ============================================================================
 */

export const captivePortalConfigService = new CaptivePortalConfigService();

/**
 * ============================================================================
 * USAGE EXAMPLES
 * ============================================================================
 */

/*

// Example 1: Generate config during router onboarding
import { captivePortalConfigService } from '@/services/captive-portal-config.service';

async function onboardRouter(routerId: string, customerId: string) {
  // Fetch router and customer from database
  const router = await routersCollection.findOne({ _id: new ObjectId(routerId) });
  const customer = await customersCollection.findOne({ _id: new ObjectId(customerId) });

  if (!router || !customer) {
    throw new Error('Router or customer not found');
  }

  // Validate data
  const routerValidation = captivePortalConfigService.validateRouter(router);
  if (!routerValidation.valid) {
    throw new Error(`Invalid router: ${routerValidation.errors.join(', ')}`);
  }

  const customerValidation = captivePortalConfigService.validateCustomer(customer);
  if (!customerValidation.valid) {
    throw new Error(`Invalid customer: ${customerValidation.errors.join(', ')}`);
  }

  // Generate api.json
  const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  const apiJsonContent = captivePortalConfigService.generateApiJson(
    router,
    customer,
    environment
  );

  // Upload to MikroTik
  await uploadToMikroTik(router.connection, 'hotspot/api.json', apiJsonContent);

  return { success: true, config: apiJsonContent };
}

// Example 2: Batch generation for multiple routers
async function generateConfigsForCustomer(customerId: string) {
  const customer = await customersCollection.findOne({ _id: new ObjectId(customerId) });
  const routers = await routersCollection.find({ customerId: new ObjectId(customerId) }).toArray();

  const customersMap = new Map([[customerId, customer]]);

  const configs = captivePortalConfigService.generateBatch(
    routers,
    customersMap,
    'production'
  );

  return configs;
}

// Example 3: Update branding only
async function updateRouterBranding(routerId: string, newBranding: any) {
  // Read existing config from MikroTik
  const existingConfig = await readFromMikroTik(routerId, 'hotspot/api.json');

  // Update branding section
  const updatedConfig = captivePortalConfigService.updateConfigSection(
    existingConfig,
    'branding',
    newBranding
  );

  // Upload back to MikroTik
  await uploadToMikroTik(routerId, 'hotspot/api.json', updatedConfig);

  return { success: true };
}

// Example 4: Check if config needs updating
async function syncRouterConfig(routerId: string, customerId: string) {
  // Read current config from MikroTik
  const currentConfig = await readFromMikroTik(routerId, 'hotspot/api.json');

  // Generate fresh config
  const router = await routersCollection.findOne({ _id: new ObjectId(routerId) });
  const customer = await customersCollection.findOne({ _id: new ObjectId(customerId) });
  const freshConfig = captivePortalConfigService.generateApiJson(router, customer, 'production');

  // Check if update needed
  const hasChanged = captivePortalConfigService.hasConfigChanged(currentConfig, freshConfig);

  if (hasChanged) {
    await uploadToMikroTik(routerId, 'hotspot/api.json', freshConfig);
    return { updated: true, changes: true };
  }

  return { updated: false, changes: false };
}

*/