import { NextRequest } from 'next/server';
import crypto from 'crypto';

// M-Pesa webhook verification
export function verifyMpesaWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('M-Pesa webhook verification failed:', error);
    return false;
  }
}

// Kopokopo webhook verification
export function verifyKopokopoWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    // Kopokopo uses different signature format
    const expectedSignature = crypto
      .createHmac('sha1', secret)
      .update(payload)
      .digest('hex');

    return signature.toLowerCase() === expectedSignature.toLowerCase();
  } catch (error) {
    console.error('Kopokopo webhook verification failed:', error);
    return false;
  }
}

// Generic webhook signature verification
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: 'sha1' | 'sha256' = 'sha256'
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');

    // Remove algorithm prefix if present (e.g., "sha256=")
    const cleanSignature = signature.replace(/^(sha1|sha256)=/, '');

    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return false;
  }
}

// Webhook payload parser
export async function parseWebhookPayload(request: NextRequest): Promise<{
  payload: string;
  signature: string | null;
  isValid: boolean;
}> {
  try {
    const payload = await request.text();
    const signature = request.headers.get('x-signature') || 
                     request.headers.get('x-safaricom-signature') ||
                     request.headers.get('x-kopokopo-signature');

    return {
      payload,
      signature,
      isValid: payload.length > 0,
    };
  } catch (error) {
    console.error('Failed to parse webhook payload:', error);
    return {
      payload: '',
      signature: null,
      isValid: false,
    };
  }
}

// Webhook retry logic
export async function processWebhookWithRetry<T>(
  processor: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000
): Promise<{ success: boolean; result?: T; error?: Error }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await processor();
      return { success: true, result };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = backoffMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return { success: false, error: lastError! };
}