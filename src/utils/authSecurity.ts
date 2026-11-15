// Cryptographic security and verification utilities for Vathmos Authentication

/**
 * Generates a random cryptographic hex salt
 */
export function generateSalt(length = 16): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hashes a password with a salt using standard Web Crypto SHA-256
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + ':' + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a 6-digit numeric email verification code (OTP)
 */
export function generateVerificationCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000);
  return code.toString();
}

/**
 * Validates email address format and strict domain rules
 */
export function validateEmailAddress(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim();
  if (!trimmed) {
    return { valid: false, error: 'Email address cannot be empty.' };
  }

  // RFC-compliant general email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email format (e.g., name@domain.com).' };
  }

  const [username, domain] = trimmed.toLowerCase().split('@');

  // Verify domain has a valid extension (at least 2 letters)
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2) {
    return { valid: false, error: 'The email domain has an invalid top-level domain.' };
  }

  // Strict Gmail validation rules if using Gmail
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    if (username.length < 6) {
      return {
        valid: false,
        error: 'Gmail usernames must be at least 6 characters long.',
      };
    }
    if (username.length > 30) {
      return {
        valid: false,
        error: 'Gmail usernames cannot exceed 30 characters.',
      };
    }
    if (!/^[a-zA-Z0-9.]+$/.test(username)) {
      return {
        valid: false,
        error: 'Gmail usernames can only contain letters, numbers, and periods.',
      };
    }
    if (username.startsWith('.') || username.endsWith('.')) {
      return {
        valid: false,
        error: 'Gmail usernames cannot start or end with a period.',
      };
    }
    if (username.includes('..')) {
      return {
        valid: false,
        error: 'Gmail usernames cannot have consecutive periods.',
      };
    }
  }

  return { valid: true };
}

/**
 * Validates password strength (minimum 8 characters, letters and numbers)
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  score: number; // 0-4
  error?: string;
} {
  if (!password) {
    return { valid: false, score: 0, error: 'Password cannot be empty.' };
  }

  if (password.length < 8) {
    return {
      valid: false,
      score: 1,
      error: 'Password must be at least 8 characters long for account security.',
    };
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  if (!hasLetter || (!hasNumber && !hasSpecial)) {
    return {
      valid: false,
      score: 2,
      error: 'Password must include both letters and at least one number or special symbol.',
    };
  }

  let score = 2;
  if (password.length >= 10) score += 1;
  if (hasLetter && hasNumber && hasSpecial) score += 1;

  return { valid: true, score };
}
