/**
 * Razorpay Checkout Client Service for Vathmos
 * Encapsulates the official Razorpay Checkout modal for Tier subscriptions
 */

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const RAZORPAY_KEY_ID = "rzp_test_TrD0Uyh1LQYYhL";

/**
 * Public Beta feature flag.
 * Keeps online checkout disabled while current-account & live gateway KYC are finalizing.
 * Set VITE_LIVE_CHECKOUT=true and swap RAZORPAY_KEY_ID to live key to re-enable instant checkout.
 */
export const IS_PUBLIC_BETA = (import.meta as any).env?.VITE_LIVE_CHECKOUT !== 'true';

export interface CheckoutTier {
  id: 'starter' | 'pro' | 'agency';
  name: string;
  usdPrice: number;
  inrPrice: number;
  evaluations: number;
  interviewQuestions: number;
  description: string;
}

export const TIERS: Record<string, CheckoutTier> = {
  starter: {
    id: 'starter',
    name: 'Starter Pass',
    usdPrice: 39,
    inrPrice: 3705,
    evaluations: 150,
    interviewQuestions: 80,
    description: '150 candidate evaluations + 80 AI Interview Guides (Standard rubric mode only • Strict & Lenient locked)',
  },
  pro: {
    id: 'pro',
    name: 'Pro Recruiter',
    usdPrice: 79,
    inrPrice: 7505,
    evaluations: 400,
    interviewQuestions: 250,
    description: '400 candidate evaluations + 250 AI Interview Guides (Full 3-Mode Calibration: Standard, Strict, Lenient)',
  },
  agency: {
    id: 'agency',
    name: 'Agency & Scale',
    usdPrice: 119,
    inrPrice: 11305,
    evaluations: 1000,
    interviewQuestions: 750,
    description: '1,000 candidate evaluations + 750 AI Interview Guides + White-Label PDF Reporting + Dedicated Support',
  },
};

/**
 * Loads the official Razorpay checkout script if not already present in the DOM
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Opens the Razorpay Checkout Modal
 */
export async function openRazorpayCheckout({
  tierId,
  customerEmail,
  customerPhone,
  onSuccess,
  onDismiss,
}: {
  tierId: 'starter' | 'pro' | 'agency';
  customerEmail?: string;
  customerPhone?: string;
  onSuccess: (paymentResponse: { razorpay_payment_id: string; tier: CheckoutTier }) => void;
  onDismiss?: () => void;
}): Promise<void> {
  if (IS_PUBLIC_BETA) {
    if (onDismiss) onDismiss();
    return;
  }

  const isLoaded = await loadRazorpayScript();
  if (!isLoaded) {
    if (onDismiss) onDismiss();
    return;
  }

  const tier = TIERS[tierId] || TIERS.starter;
  // Amount in Paise (INR subunits: 1 INR = 100 Paise)
  const amountInPaise = tier.inrPrice * 100;

  const options = {
    key: RAZORPAY_KEY_ID,
    amount: amountInPaise,
    currency: 'INR',
    name: 'Vathmos',
    description: `${tier.name} (${tier.evaluations} evaluations)`,
    image: 'https://vathmos-vk.vercel.app/favicon.ico',
    prefill: {
      email: customerEmail || 'vathmossupport@gmail.com',
      contact: customerPhone || '',
    },
    theme: {
      color: '#0284c7', // Sky-600 to match Vathmos palette
      backdrop_color: 'rgba(10, 15, 30, 0.85)',
    },
    modal: {
      ondismiss: () => {
        if (onDismiss) onDismiss();
      },
    },
    handler: function (response: any) {
      if (response && response.razorpay_payment_id) {
        onSuccess({
          razorpay_payment_id: response.razorpay_payment_id,
          tier,
        });
      }
    },
  };

  const rzp = new window.Razorpay(options);
  rzp.open();
}
