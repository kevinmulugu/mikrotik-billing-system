import { headers } from 'next/headers';
import { NextRequest } from 'next/server';

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60 * 1000 // 1 minute
): { success: boolean; remainingRequests: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    // Create new record or reset expired one
    const resetTime = now + windowMs;
    rateLimitMap.set(identifier, { count: 1, resetTime });
    return { success: true, remainingRequests: limit - 1, resetTime };
  }

  if (record.count >= limit) {
    return { success: false, remainingRequests: 0, resetTime: record.resetTime };
  }

  // Increment count
  record.count++;
  return { 
    success: true, 
    remainingRequests: limit - record.count, 
    resetTime: record.resetTime 
  };
}

// IP address extraction
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    const ip = forwarded.split(',')[0];
    return ip ? ip.trim() : 'unknown';
  }
  
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

// Request validation
export function validateRequestOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
  ].filter(Boolean);

  if (!origin && !referer) {
    return false; // Require origin or referer
  }

  if (origin && !allowedOrigins.some(allowed => origin.startsWith(allowed!))) {
    return false;
  }

  return true;
}

// CSRF protection
export function generateCSRFToken(): string {
  return crypto.randomUUID();
}

export function validateCSRFToken(token: string, sessionToken: string): boolean {
  // Implement CSRF token validation logic
  // This is a simplified example
  return token === sessionToken;
}

// Input sanitization
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

// Password security
export function checkPasswordComplexity(password: string): {
  isValid: boolean;
  errors: string[];
  score: number;
} {
  const errors: string[] = [];
  let score = 0;

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    score += 1;
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else {
    score += 1;
  }

  // Check for common weak passwords
  const commonPasswords = [
    'password', '123456', 'password123', 'admin', 'qwerty',
    'letmein', 'welcome', 'monkey', '1234567890'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common, please choose a stronger password');
    score = Math.max(0, score - 2);
  }

  return {
    isValid: errors.length === 0,
    errors,
    score: Math.min(5, score), // Cap at 5
  };
}

// Encryption utilities (for sensitive data)
export async function hashPassword(password: string): Promise<string> {
  // This would typically use bcrypt or similar
  // For demo purposes, using a simple hash
  const encoder = new TextEncoder();
  const data = encoder.encode(password + process.env.PASSWORD_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// API key generation and validation
export function generateAPIKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function validateAPIKey(key: string): boolean {
  // Validate API key format
  return /^[a-f0-9]{64}$/i.test(key);
}

// Session security
export function isSessionValid(sessionData: any): boolean {
  if (!sessionData || !sessionData.expires) {
    return false;
  }

  const expiryTime = new Date(sessionData.expires).getTime();
  const currentTime = Date.now();

  return currentTime < expiryTime;
}