// lib/factories/payment-provider.factory.ts

import { PaymentProvider, PaymentProviderType } from '@/lib/interfaces/payment-provider.interface';

/**
 * Factory for creating payment provider instances
 * 
 * This factory creates the appropriate payment provider based on type
 * (M-Pesa, Kopo Kopo, etc.)
 */
export class PaymentProviderFactory {
  /**
   * Create a payment provider instance
   * 
   * @param type - Type of payment provider ('mpesa', 'kopokopo', etc.)
   * @returns Payment provider instance
   * @throws Error if provider type is unsupported
   */
  static create(type: PaymentProviderType): PaymentProvider {
    switch (type) {
      case 'mpesa':
        // Lazy load to avoid circular dependencies
        const { MpesaProvider } = require('@/lib/providers/mpesa-provider');
        return new MpesaProvider();

      case 'kopokopo':
        // Lazy load Kopo Kopo provider (Phase 4)
        const { KopoKopoProvider } = require('@/lib/providers/kopokopo-provider');
        return new KopoKopoProvider();

      default:
        throw new Error(`Unsupported payment provider type: ${type}`);
    }
  }

  /**
   * Get list of supported payment provider types
   */
  static getSupportedTypes(): PaymentProviderType[] {
    return ['mpesa', 'kopokopo'];
  }

  /**
   * Check if a payment provider type is supported
   */
  static isSupported(type: string): type is PaymentProviderType {
    return ['mpesa', 'kopokopo'].includes(type);
  }
}
