// lib/services/messaging.ts
import { ObjectId } from 'mongodb';
import { SMSCreditsService } from './sms-credits';

/**
 * MobileSasa SMS Service for sending SMS messages in Kenya
 * API Documentation: https://mobilesasa.com/
 */

export interface SMSRecipient {
  phone: string;
  name?: string;
  customerId?: ObjectId;
}

export interface SendSMSOptions {
  recipients: SMSRecipient[];
  message: string;
  senderId?: string; // Optional custom sender ID
}

export interface SMSResponse {
  success: boolean;
  sentCount: number;
  failedCount: number;
  details: {
    recipient: string;
    status: 'sent' | 'failed';
    messageId?: string;
    error?: string;
  }[];
  totalCost?: number;
  errorMessage?: string;
}

export interface BulkSMSResult {
  success: boolean;
  totalRecipients: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  details: {
    phone: string;
    name?: string;
    status: 'sent' | 'failed';
    messageId?: string;
    error?: string;
  }[];
  errorMessage?: string;
}

export class MessagingService {
  private static apiKey: string = process.env.MOBILESASA_API_KEY || '';
  private static senderId: string = process.env.MOBILESASA_SENDERID || 'MOBILESASA';
  private static apiUrl: string = process.env.MOBILESASA_URL_SINGLE_MESSAGE || 'https://api.mobilesasa.com/v1/send/message';

  /**
   * Validate phone number format for Kenya
   * Accepts: 254XXXXXXXXX, 0XXXXXXXXX, or +254XXXXXXXXX
   */
  static normalizeKenyanPhone(phone: string): string | null {
    if (!phone) return null;

    // Remove all whitespace and special characters except +
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');

    // Remove leading + if present
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }

    // Handle different formats
    if (cleaned.startsWith('254') && cleaned.length === 12) {
      // Already in correct format: 254XXXXXXXXX
      return cleaned;
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
      // Format: 0XXXXXXXXX -> 254XXXXXXXXX
      return '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') && cleaned.length === 9) {
      // Format: 7XXXXXXXX -> 254XXXXXXXXX
      return '254' + cleaned;
    }

    // Invalid format
    return null;
  }

  /**
   * Validate that API credentials are configured
   */
  static validateConfiguration(): { valid: boolean; error?: string } {
    if (!this.apiKey || this.apiKey === 'your-mobilesasa-api-key') {
      return {
        valid: false,
        error: 'MOBILESASA_API_KEY is not configured in environment variables',
      };
    }

    if (!this.apiUrl) {
      return {
        valid: false,
        error: 'MOBILESASA_URL_SINGLE_MESSAGE is not configured in environment variables',
      };
    }

    return { valid: true };
  }

  /**
   * Send SMS to a single recipient using MobileSasa API
   * Now with SMS credits integration
   */
  static async sendSingleSMS(
    phone: string,
    message: string,
    senderId?: string,
    userId?: string | ObjectId // Optional: for credit deduction
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Validate configuration
      const configCheck = this.validateConfiguration();
      if (!configCheck.valid) {
        console.error('[MobileSasa] Configuration error:', configCheck.error);
        return { success: false, error: configCheck.error || 'Configuration error' };
      }

      // Normalize phone number
      const normalizedPhone = this.normalizeKenyanPhone(phone);
      if (!normalizedPhone) {
        return { success: false, error: `Invalid phone number format: ${phone}` };
      }

      // Calculate SMS cost
      const smsCost = SMSCreditsService.calculateSMSCost(message, 1);

      // Check credits if userId provided
      if (userId) {
        const creditCheck = await SMSCreditsService.hasSufficientCredits(userId, smsCost);
        if (!creditCheck.sufficient) {
          console.error(`[MobileSasa] Insufficient credits: Required ${smsCost}, Available ${creditCheck.balance}`);
          return {
            success: false,
            error: `Insufficient SMS credits. Required: ${smsCost}, Available: ${creditCheck.balance}. Please top up.`,
          };
        }
      }

      // Prepare request payload
      const payload = {
        senderID: senderId || this.senderId,
        message: message,
        phone: normalizedPhone,
      };

      console.log(`[MobileSasa] Sending SMS to ${normalizedPhone}...`);

      // Make API request
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('[MobileSasa] API Error:', responseData);
        return {
          success: false,
          error: responseData.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // MobileSasa actual response format:
      // { status: true, responseCode: '0200', message: 'Accepted', messageId: 'uuid' }
      if (responseData.status === true && responseData.responseCode === '0200') {
        console.log(`[MobileSasa] ✓ SMS sent to ${normalizedPhone}, ID: ${responseData.messageId}`);
        
        // Deduct credits if userId provided
        if (userId) {
          const deduction = await SMSCreditsService.deductCredits(
            userId,
            smsCost,
            `SMS sent to ${normalizedPhone}`,
            {
              messageId: responseData.messageId,
              recipient: normalizedPhone,
              smsCount: smsCost,
            }
          );

          if (!deduction.success) {
            console.warn(`[MobileSasa] SMS sent but credit deduction failed: ${deduction.error}`);
          } else {
            console.log(`[MobileSasa] ✓ Deducted ${smsCost} credits, new balance: ${deduction.newBalance}`);
          }
        }
        
        return {
          success: true,
          messageId: responseData.messageId || 'unknown',
        };
      } else if (responseData.status === 'success' || responseData.success === true) {
        // Fallback for alternative response formats
        console.log(`[MobileSasa] ✓ SMS sent to ${normalizedPhone}, ID: ${responseData.message_id || responseData.messageId}`);
        
        // Deduct credits if userId provided
        if (userId) {
          const deduction = await SMSCreditsService.deductCredits(
            userId,
            smsCost,
            `SMS sent to ${normalizedPhone}`,
            {
              messageId: responseData.message_id || responseData.messageId,
              recipient: normalizedPhone,
              smsCount: smsCost,
            }
          );

          if (!deduction.success) {
            console.warn(`[MobileSasa] SMS sent but credit deduction failed: ${deduction.error}`);
          } else {
            console.log(`[MobileSasa] ✓ Deducted ${smsCost} credits, new balance: ${deduction.newBalance}`);
          }
        }
        
        return {
          success: true,
          messageId: responseData.message_id || responseData.messageId || 'unknown',
        };
      } else {
        console.error('[MobileSasa] Send failed:', responseData);
        return {
          success: false,
          error: responseData.message || responseData.error || `Failed with code: ${responseData.responseCode}` || 'Unknown error',
        };
      }
    } catch (error) {
      console.error('[MobileSasa] Exception sending SMS:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send SMS to multiple recipients (bulk send with retry logic)
   * Now with SMS credits integration
   */
  static async sendBulkSMS(
    options: SendSMSOptions,
    userId?: string | ObjectId
  ): Promise<BulkSMSResult> {
    const { recipients, message, senderId } = options;

    // Validate configuration first
    const configCheck = this.validateConfiguration();
    if (!configCheck.valid) {
      return {
        success: false,
        totalRecipients: recipients.length,
        successfulDeliveries: 0,
        failedDeliveries: recipients.length,
        details: recipients.map((r) => ({
          phone: r.phone,
          ...(r.name && { name: r.name }),
          status: 'failed' as const,
          error: configCheck.error || 'Configuration error',
        })),
        errorMessage: configCheck.error || 'Configuration error',
      };
    }

    // Calculate total SMS cost for bulk send
    const totalCost = SMSCreditsService.calculateSMSCost(message, recipients.length);

    // Check credits if userId provided
    if (userId) {
      const creditCheck = await SMSCreditsService.hasSufficientCredits(userId, totalCost);
      if (!creditCheck.sufficient) {
        console.error(`[MobileSasa] Insufficient credits for bulk SMS: Required ${totalCost}, Available ${creditCheck.balance}`);
        return {
          success: false,
          totalRecipients: recipients.length,
          successfulDeliveries: 0,
          failedDeliveries: recipients.length,
          details: recipients.map((r) => ({
            phone: r.phone,
            ...(r.name && { name: r.name }),
            status: 'failed' as const,
            error: `Insufficient SMS credits. Required: ${totalCost}, Available: ${creditCheck.balance}`,
          })),
          errorMessage: `Insufficient SMS credits. Required: ${totalCost}, Available: ${creditCheck.balance}. Please top up.`,
        };
      }
    }

    console.log(`[MobileSasa] Starting bulk SMS to ${recipients.length} recipients...`);

    const results: BulkSMSResult['details'] = [];
    let successCount = 0;
    let failCount = 0;

    // Send SMS to each recipient with a small delay to avoid rate limiting
    for (const recipient of recipients) {
      const result = await this.sendSingleSMS(recipient.phone, message, senderId, userId);

      results.push({
        phone: recipient.phone,
        ...(recipient.name && { name: recipient.name }),
        status: result.success ? 'sent' : 'failed',
        ...(result.messageId && { messageId: result.messageId }),
        ...(result.error && { error: result.error }),
      });

      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }

      // Add small delay between requests (100ms) to avoid rate limiting
      if (recipients.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(
      `[MobileSasa] Bulk SMS complete: ${successCount} sent, ${failCount} failed (${recipients.length} total)`
    );

    return {
      success: successCount > 0,
      totalRecipients: recipients.length,
      successfulDeliveries: successCount,
      failedDeliveries: failCount,
      details: results,
    };
  }

  /**
   * Estimate SMS cost (MobileSasa typically charges per SMS)
   * Standard SMS = 160 characters, longer messages = multiple SMS
   */
  static estimateSMSCost(
    message: string,
    recipientCount: number,
    costPerSMS: number = 0.8 // KES 0.80 per SMS (adjust based on your rate)
  ): { smsCount: number; totalCost: number; costPerRecipient: number } {
    // Calculate number of SMS segments needed
    const messageLength = message.length;
    let smsCount = 1;

    if (messageLength > 160) {
      // Multi-part SMS - each segment is 153 characters (7 chars for header)
      smsCount = Math.ceil(messageLength / 153);
    }

    const costPerRecipient = smsCount * costPerSMS;
    const totalCost = costPerRecipient * recipientCount;

    return {
      smsCount,
      totalCost,
      costPerRecipient,
    };
  }

  /**
   * Validate message content
   */
  static validateMessage(message: string): { valid: boolean; error?: string } {
    if (!message || typeof message !== 'string') {
      return { valid: false, error: 'Message is required' };
    }

    const trimmed = message.trim();

    if (trimmed.length === 0) {
      return { valid: false, error: 'Message cannot be empty' };
    }

    if (trimmed.length > 1000) {
      return { valid: false, error: 'Message is too long (max 1000 characters)' };
    }

    return { valid: true };
  }

  /**
   * Replace variables in message template
   * Example: "Hello {name}, your voucher code is {code}"
   */
  static replaceVariables(
    template: string,
    variables: Record<string, string>
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, value);
    }

    return result;
  }

  /**
   * Send SMS using a template with variable replacement
   * Now with SMS credits integration
   */
  static async sendTemplatedSMS(
    phone: string,
    template: string,
    variables: Record<string, string>,
    senderId?: string,
    userId?: string | ObjectId
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = this.replaceVariables(template, variables);
    return this.sendSingleSMS(phone, message, senderId, userId);
  }
}

export default MessagingService;
