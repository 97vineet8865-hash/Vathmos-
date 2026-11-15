/**
 * Vathmos Email Dispatch Service
 * Sends real OTP verification emails via /api/send-otp (or /api/auth/send-verification-email)
 * backed by Resend API.
 */

export interface EmailDispatchResult {
  success: boolean;
  delivered: boolean;
  message?: string;
  id?: string;
  error?: string;
}

export async function dispatchVerificationOtp(
  email: string,
  code: string,
  type: 'signup' | 'reset' = 'signup'
): Promise<EmailDispatchResult> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  // Try endpoints in order
  const endpoints = ['/api/send-otp', '/api/auth/send-verification-email'];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          code: cleanCode,
          type,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          delivered: Boolean(data?.delivered),
          message: data?.message || 'Verification code dispatched.',
          id: data?.id,
        };
      }
    } catch (err: any) {
      console.warn(`[Email Dispatch ${endpoint}] request failed:`, err?.message || err);
    }
  }

  // Graceful fallback (e.g. static offline mode)
  return {
    success: true,
    delivered: false,
    message: 'Security code generated in offline/testing mode.',
  };
}
