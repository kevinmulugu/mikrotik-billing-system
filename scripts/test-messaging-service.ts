// scripts/test-messaging-service.ts
/**
 * Test script for MobileSasa messaging service
 * Run with: pnpm tsx scripts/test-messaging-service.ts
 */

import { MessagingService } from '../lib/services/messaging';

async function testPhoneNormalization() {
  console.log('\n=== Testing Phone Number Normalization ===\n');

  const testCases = [
    { input: '0712345678', expected: '254712345678' },
    { input: '712345678', expected: '254712345678' },
    { input: '+254712345678', expected: '254712345678' },
    { input: '254712345678', expected: '254712345678' },
    { input: '0722123456', expected: '254722123456' },
    { input: '0733987654', expected: '254733987654' },
    { input: '0111234567', expected: null }, // Invalid - not mobile
    { input: '1234567890', expected: null }, // Invalid format
    { input: '', expected: null }, // Empty
  ];

  testCases.forEach(({ input, expected }) => {
    const result = MessagingService.normalizeKenyanPhone(input);
    const status = result === expected ? '✓' : '✗';
    console.log(`${status} ${input.padEnd(15)} → ${result || 'null'} ${result === expected ? '' : `(expected: ${expected})`}`);
  });
}

async function testConfiguration() {
  console.log('\n=== Testing Configuration ===\n');

  const configCheck = MessagingService.validateConfiguration();
  
  if (configCheck.valid) {
    console.log('✓ Configuration is valid');
    console.log('  - API Key:', process.env.MOBILESASA_API_KEY ? '✓ Set' : '✗ Missing');
    console.log('  - Sender ID:', process.env.MOBILESASA_SENDERID || '(default: MOBILESASA)');
    console.log('  - API URL:', process.env.MOBILESASA_URL_SINGLE_MESSAGE || '(default URL)');
  } else {
    console.log('✗ Configuration error:', configCheck.error);
    console.log('\nPlease set the following in .env.local:');
    console.log('  MOBILESASA_API_KEY=your-api-key');
    console.log('  MOBILESASA_SENDERID=your-sender-id');
    console.log('  MOBILESASA_URL_SINGLE_MESSAGE=https://api.mobilesasa.com/v1/send/message');
  }
}

async function testCostEstimation() {
  console.log('\n=== Testing SMS Cost Estimation ===\n');

  const testMessages = [
    { message: 'Hello!', recipients: 10 },
    { message: 'Your voucher code is ABC123. Valid for 24 hours. Thank you for using our service!', recipients: 50 },
    { message: 'x'.repeat(160), recipients: 100 }, // Exactly 160 chars
    { message: 'x'.repeat(161), recipients: 100 }, // 161 chars = 2 SMS
    { message: 'x'.repeat(320), recipients: 25 },  // 320 chars = 3 SMS
  ];

  testMessages.forEach(({ message, recipients }) => {
    const estimate = MessagingService.estimateSMSCost(message, recipients, 0.80);
    console.log(`Message Length: ${message.length} chars`);
    console.log(`  Recipients: ${recipients}`);
    console.log(`  SMS Segments: ${estimate.smsCount}`);
    console.log(`  Cost per recipient: KES ${estimate.costPerRecipient.toFixed(2)}`);
    console.log(`  Total Cost: KES ${estimate.totalCost.toFixed(2)}`);
    console.log();
  });
}

async function testMessageValidation() {
  console.log('\n=== Testing Message Validation ===\n');

  const testMessages = [
    { message: '', valid: false },
    { message: '   ', valid: false },
    { message: 'Hello!', valid: true },
    { message: 'x'.repeat(1000), valid: true },
    { message: 'x'.repeat(1001), valid: false }, // Too long
  ];

  testMessages.forEach(({ message, valid }) => {
    const result = MessagingService.validateMessage(message);
    const status = result.valid === valid ? '✓' : '✗';
    const preview = message.length > 20 ? `"${message.substring(0, 17)}..." (${message.length} chars)` : `"${message}"`;
    console.log(`${status} ${preview.padEnd(30)} → ${result.valid ? 'Valid' : `Invalid: ${result.error}`}`);
  });
}

async function testVariableReplacement() {
  console.log('\n=== Testing Variable Replacement ===\n');

  const templates = [
    {
      template: 'Hello {name}, your code is {code}',
      variables: { name: 'John', code: 'ABC123' },
      expected: 'Hello John, your code is ABC123',
    },
    {
      template: 'Hi {name}! Welcome to {location}. Your voucher: {voucher}',
      variables: { name: 'Mary', location: 'Nairobi WiFi', voucher: 'XYZ789' },
      expected: 'Hi Mary! Welcome to Nairobi WiFi. Your voucher: XYZ789',
    },
    {
      template: 'No variables here',
      variables: {},
      expected: 'No variables here',
    },
  ];

  templates.forEach(({ template, variables, expected }) => {
    const result = MessagingService.replaceVariables(template, variables);
    const status = result === expected ? '✓' : '✗';
    console.log(`${status} Template: "${template}"`);
    console.log(`  Variables: ${JSON.stringify(variables)}`);
    console.log(`  Result: "${result}"`);
    console.log();
  });
}

async function testSendSMS() {
  console.log('\n=== Testing SMS Send (DRY RUN) ===\n');
  
  const configCheck = MessagingService.validateConfiguration();
  
  if (!configCheck.valid) {
    console.log('⚠ Skipping SMS send test - configuration not valid');
    console.log('  Error:', configCheck.error);
    return;
  }

  // Test phone number
  const testPhone = process.env.TEST_PHONE_NUMBER || '0712345678';
  const normalizedPhone = MessagingService.normalizeKenyanPhone(testPhone);

  if (!normalizedPhone) {
    console.log('✗ Invalid test phone number:', testPhone);
    console.log('  Set TEST_PHONE_NUMBER in .env.local to test actual SMS sending');
    return;
  }

  console.log('Test Configuration:');
  console.log('  Phone:', testPhone, '→', normalizedPhone);
  console.log('  Message: "Test message from MikroTik Billing System"');
  console.log();
  console.log('⚠ To actually send SMS, uncomment the code below and run again');
  console.log('  (Requires valid MobileSasa API key and sufficient balance)');
  console.log();
  console.log('Expected MobileSasa Response:');
  console.log('  { status: true, responseCode: "0200", message: "Accepted", messageId: "uuid" }');
  
  /*
  // UNCOMMENT TO ACTUALLY SEND SMS
  console.log('\nSending SMS...');
  const result = await MessagingService.sendSingleSMS(
    normalizedPhone,
    'Test message from MikroTik Billing System',
  );

  if (result.success) {
    console.log('✓ SMS sent successfully');
    console.log('  Message ID:', result.messageId);
  } else {
    console.log('✗ Failed to send SMS');
    console.log('  Error:', result.error);
  }
  */
}

async function main() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  MobileSasa Messaging Service Test Suite          ║');
  console.log('╚════════════════════════════════════════════════════╝');

  await testConfiguration();
  await testPhoneNormalization();
  await testMessageValidation();
  await testVariableReplacement();
  await testCostEstimation();
  await testSendSMS();

  console.log('\n✓ All tests completed\n');
}

main().catch((error) => {
  console.error('\n✗ Test suite failed:', error);
  process.exit(1);
});
