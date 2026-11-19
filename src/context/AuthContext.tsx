import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, StoredUserAccount, WhiteLabelConfig } from '../types';
import {
  generateSalt,
  hashPassword,
  generateVerificationCode,
  validateEmailAddress,
  validatePasswordStrength,
} from '../utils/authSecurity';
import { dispatchVerificationOtp } from '../utils/emailService';
import { supabase } from '../lib/supabaseClient';
import { trackEvent, markFounderDevice } from '../utils/analytics';

export interface DispatchedCodeNotification {
  email: string;
  code: string;
  type: 'signup' | 'reset';
  timestamp: number;
}

interface AuthContextType {
  token: string | null;
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  signUp: (data: {
    name: string;
    email: string;
    password: string;
    companyName: string;
    role: string;
  }) => Promise<{ success: boolean; verifiedImmediate?: boolean; error?: string; code?: string }>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string; requireVerification?: boolean }>;
  verifyEmail: (
    email: string,
    code: string
  ) => Promise<{ success: boolean; error?: string }>;
  resendVerificationCode: (
    email: string
  ) => Promise<{ success: boolean; code?: string; error?: string }>;
  requestPasswordReset: (
    email: string
  ) => Promise<{ success: boolean; delivered?: boolean; message?: string; code?: string; error?: string }>;
  resetPassword: (
    email: string,
    code: string,
    newPassword: string
  ) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updateWhiteLabel: (config: WhiteLabelConfig) => Promise<{ success: boolean; error?: string }>;
  upgradeTier: (tier: 'starter' | 'pro' | 'agency', paymentId: string) => void;
  recordEvaluationUsed: (count?: number) => void;
  recordInterviewQuestionUsed: (count?: number) => void;
  signOut: () => void;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  oauthError: string | null;
  clearOauthError: () => void;
  isAuthModalOpen: boolean;
  authModalMode: 'signin' | 'signup' | 'verify' | 'forgot';
  openAuthModal: (mode?: 'signin' | 'signup' | 'verify' | 'forgot') => void;
  closeAuthModal: () => void;
  isProfileModalOpen: boolean;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  dispatchedNotification: DispatchedCodeNotification | null;
  dismissDispatchedNotification: () => void;
  isOnboardingModalOpen: boolean;
  openOnboardingModal: () => void;
  closeOnboardingModal: () => void;
  dismissOnboarding: () => void;
}

const STORAGE_KEY = 'vathmos_current_user_session';
const TOKEN_KEY = 'vathmos_auth_token';
const ACCOUNTS_STORAGE_KEY = 'vathmos_registered_accounts_v1';

const AVATAR_COLORS = [
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#0EA5E9', // Sky Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F59E0B', // Amber
];

// Seed admin account with salted SHA-256 hash
const INITIAL_SEED_ACCOUNTS: StoredUserAccount[] = [
  {
    id: 'usr-vathmos-admin',
    name: 'Vathmos Admin',
    email: 'vathmossupport@gmail.com',
    companyName: 'Vathmos',
    role: 'Platform Administrator',
    joinedAt: 'September 2026',
    avatarColor: '#6366F1',
    salt: 'vathmos_salt_brand',
    passwordHash: '7c80adf7866860b23dbd3edbae7121bbdfe170ad93c1ee1f2f228b58c40dd98a',
    isEmailVerified: true,
  },
  {
    id: 'usr-vineet-primary',
    name: 'Vineet (Founder)',
    email: 'vineet.842011@gmail.com',
    companyName: 'Vathmos Technologies',
    role: 'Founder & Lead Engineer',
    joinedAt: 'October 2026',
    avatarColor: '#0EA5E9',
    salt: 'vathmos_salt_vineet',
    passwordHash: '7c80adf7866860b23dbd3edbae7121bbdfe170ad93c1ee1f2f228b58c40dd98a',
    isEmailVerified: true,
  },
  {
    id: 'usr-vineet-official',
    name: 'Vineet (Founder)',
    email: '97.vineet.8865@gmail.com',
    companyName: 'Vathmos Technologies',
    role: 'Founder & Lead Engineer',
    joinedAt: 'October 2026',
    avatarColor: '#10B981',
    salt: 'vathmos_salt_vineet_official',
    passwordHash: '7c80adf7866860b23dbd3edbae7121bbdfe170ad93c1ee1f2f228b58c40dd98a',
    isEmailVerified: true,
  }
];

export const TIER_LIMITS: Record<string, { evaluations: number; interviewQuestions: number }> = {
  free: { evaluations: 5, interviewQuestions: 5 },
  starter: { evaluations: 150, interviewQuestions: 80 },
  pro: { evaluations: 400, interviewQuestions: 250 },
  agency: { evaluations: 1000, interviewQuestions: 750 },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });

  // Load saved session or initialize as null
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const currentTier = parsed.tier || 'free';
          const configLimits = TIER_LIMITS[currentTier] || TIER_LIMITS.free;
          if (
            !parsed.interviewQuestionsLimit ||
            parsed.interviewQuestionsLimit !== configLimits.interviewQuestions
          ) {
            parsed.interviewQuestionsLimit = configLimits.interviewQuestions;
          }
          if (!parsed.evaluationsLimit || parsed.evaluationsLimit !== configLimits.evaluations) {
            parsed.evaluationsLimit = configLimits.evaluations;
          }
          return parsed as UserProfile;
        }
      }
    } catch {
      // Fallback
    }
    return null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<
    'signin' | 'signup' | 'verify' | 'forgot'
  >('signin');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState<boolean>(false);
  const [dispatchedNotification, setDispatchedNotification] =
    useState<DispatchedCodeNotification | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  // Validate and sync server session on mount + handle Google OAuth redirect return
  useEffect(() => {
    const syncServerSession = async () => {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (!savedToken) return;

      try {
        const res = await fetch('/api/auth/session', {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setCurrentUser(data.user);
            setToken(savedToken);
            markFounderDevice(data.user.email);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
            return;
          }
        }
        // If server says token expired or invalid, purge local session
        setToken(null);
        setCurrentUser(null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Keep cached state during temporary offline conditions
      }
    };

    syncServerSession();
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const urlError =
      params.get('error_description') ||
      hashParams.get('error_description') ||
      params.get('error') ||
      hashParams.get('error');

    if (urlError) {
      setOauthError(decodeURIComponent(urlError));
      setIsAuthModalOpen(true);
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {}
    }

    let isExchanging = false;

    const exchangeGoogleSession = async (accessToken: string) => {
      if (!accessToken || isExchanging) return;
      isExchanging = true;
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success && data?.token && data?.user) {
          setToken(data.token);
          setCurrentUser(data.user as UserProfile);
          try {
            localStorage.setItem(TOKEN_KEY, data.token);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
          } catch {}
          setOauthError(null);
          setIsAuthModalOpen(false);
          setDispatchedNotification(null);
          markFounderDevice(data.user?.email);
          const isNewGoogleUser = Boolean(
            data.isNewUser || data.user?.hasSeenOnboardingPlans === false
          );
          trackEvent(
            isNewGoogleUser ? 'signup_completed' : 'login_completed',
            { method: 'google' },
            data.user?.tier || 'free',
            data.user?.email
          );
          try {
            if (window.location.search.includes('code=') || window.location.hash.includes('access_token=')) {
              window.history.replaceState({}, '', window.location.pathname);
            }
          } catch {}
        } else {
          setOauthError(data?.error || 'Could not complete Google sign-in.');
          setIsAuthModalOpen(true);
        }
      } catch (err: any) {
        setOauthError(err?.message || 'Network error during Google sign-in.');
        setIsAuthModalOpen(true);
      } finally {
        isExchanging = false;
      }
    };

    const hasOAuthCallback =
      window.location.search.includes('code=') || window.location.hash.includes('access_token=');

    if (hasOAuthCallback) {
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session?.access_token) {
          exchangeGoogleSession(data.session.access_token);
        }
      });
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.access_token) {
        const existingToken = localStorage.getItem(TOKEN_KEY);
        if (!existingToken || event === 'SIGNED_IN') {
          exchangeGoogleSession(session.access_token);
        }
      }
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  // Automatically trigger onboarding plan modal if a logged-in user hasn't seen it yet
  useEffect(() => {
    if (currentUser && currentUser.hasSeenOnboardingPlans === false) {
      setIsOnboardingModalOpen(true);
    }
  }, [currentUser]);

  // Sync session to localStorage & tag founder device so own visits aren't counted
  useEffect(() => {
    try {
      if (currentUser) {
        markFounderDevice(currentUser.email);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [currentUser]);

  // Sign Up: server-side verification, supports immediate activation in Public Beta OTP mode
  const signUp = async (data: {
    name: string;
    email: string;
    password: string;
    companyName: string;
    role: string;
  }): Promise<{ success: boolean; verifiedImmediate?: boolean; error?: string }> => {
    const cleanEmail = data.email.trim().toLowerCase();

    const emailValidation = validateEmailAddress(cleanEmail);
    if (!emailValidation.valid) {
      return { success: false, error: emailValidation.error };
    }

    const passValidation = validatePasswordStrength(data.password);
    if (!passValidation.valid) {
      return { success: false, error: passValidation.error };
    }

    if (!data.name.trim()) {
      return { success: false, error: 'Full name is required.' };
    }

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name.trim(),
          email: cleanEmail,
          password: data.password,
          companyName: data.companyName.trim() || 'Hiring Organization',
          role: data.role.trim() || 'Talent Acquisition',
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: body.error || 'Registration failed.' };
      }

      if (body.verifiedImmediate && body.token && body.user) {
        setToken(body.token);
        setCurrentUser(body.user as UserProfile);
        try {
          localStorage.setItem(TOKEN_KEY, body.token);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(body.user));
        } catch {}
        setIsAuthModalOpen(false);
        setDispatchedNotification(null);
        markFounderDevice(body.user?.email);
        trackEvent(
          'signup_completed',
          { method: 'email_immediate' },
          body.user?.tier || 'free',
          body.user?.email
        );
        return { success: true, verifiedImmediate: true };
      }

      // Verification code is sent via email, never exposed to browser
      setDispatchedNotification({
        email: cleanEmail,
        code: '••••••',
        type: 'signup',
        timestamp: Date.now(),
      });

      return { success: true, verifiedImmediate: false };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to complete registration.' };
    }
  };

  // Verify Email Code (Single-use, validated strictly on server)
  const verifyEmail = async (
    email: string,
    code: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanCode || cleanCode.length !== 6) {
      return { success: false, error: 'Please enter a valid 6-digit verification code.' };
    }

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: body.error || 'Verification failed.' };
      }

      const receivedToken = body.token;
      const userProfile = body.user as UserProfile;

      setToken(receivedToken);
      setCurrentUser(userProfile);
      try {
        localStorage.setItem(TOKEN_KEY, receivedToken);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userProfile));
      } catch {}

      setIsAuthModalOpen(false);
      setDispatchedNotification(null);
      markFounderDevice(userProfile?.email);
      trackEvent(
        'signup_completed',
        { method: 'email_otp' },
        userProfile?.tier || 'free',
        userProfile?.email
      );

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Email verification request failed.' };
    }
  };

  // Resend verification code (Strictly server-side rate-limited)
  const resendVerificationCode = async (
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: body.error || 'Failed to resend code.' };
      }

      setDispatchedNotification({
        email: cleanEmail,
        code: '••••••',
        type: 'signup',
        timestamp: Date.now(),
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to resend code.' };
    }
  };

  // Sign In: cryptographic verification on server, generates Bearer token
  const signIn = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; requireVerification?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();

    const emailValidation = validateEmailAddress(cleanEmail);
    if (!emailValidation.valid) {
      return { success: false, error: emailValidation.error };
    }

    if (!password) {
      return { success: false, error: 'Please enter your account password.' };
    }

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        if (body.requireVerification) {
          setDispatchedNotification({
            email: cleanEmail,
            code: '••••••',
            type: 'signup',
            timestamp: Date.now(),
          });
          return {
            success: false,
            requireVerification: true,
            error: body.message || 'Your email address is pending verification.',
          };
        }
        return { success: false, error: body.error || 'Invalid credentials.' };
      }

      const receivedToken = body.token;
      const userProfile = body.user as UserProfile;

      setToken(receivedToken);
      setCurrentUser(userProfile);
      try {
        localStorage.setItem(TOKEN_KEY, receivedToken);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userProfile));
      } catch {}

      setIsAuthModalOpen(false);
      setDispatchedNotification(null);
      markFounderDevice(userProfile?.email);
      trackEvent(
        'login_completed',
        { method: 'password' },
        userProfile?.tier || 'free',
        userProfile?.email
      );

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Sign in failed.' };
    }
  };

  // Request password reset code
  const requestPasswordReset = async (
    email: string
  ): Promise<{ success: boolean; delivered?: boolean; message?: string; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: body.error || 'Failed to request reset.' };
      }

      if (body.delivered === false) {
        setDispatchedNotification(null);
        return {
          success: true,
          delivered: false,
          message: body.message,
        };
      }

      setDispatchedNotification({
        email: cleanEmail,
        code: '••••••',
        type: 'reset',
        timestamp: Date.now(),
      });

      return { success: true, delivered: true, message: body.message };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Password reset request failed.' };
    }
  };

  // Reset password with verified single-use code
  const resetPassword = async (
    email: string,
    code: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    const passValidation = validatePasswordStrength(newPassword);
    if (!passValidation.valid) {
      return { success: false, error: passValidation.error };
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode, newPassword }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: body.error || 'Reset failed.' };
      }

      setDispatchedNotification(null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to reset password.' };
    }
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (!currentUser) return;
    const updated: UserProfile = {
      ...currentUser,
      ...updates,
    };
    setCurrentUser(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const updateWhiteLabel = async (
    config: WhiteLabelConfig
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'User is not logged in.' };

    const isAdmin =
      currentUser.email &&
      ['vathmossupport@gmail.com', 'vineet.842011@gmail.com', '97.vineet.8865@gmail.com'].includes(
        currentUser.email.toLowerCase()
      );

    if (currentUser.tier !== 'agency' && !isAdmin) {
      return {
        success: false,
        error:
          'White-Label reporting is exclusively available on the Agency & Scale plan ($119 / ₹11,305). Please upgrade to unlock custom branding.',
      };
    }

    try {
      if (token) {
        const res = await fetch('/api/user/whitelabel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(config),
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { success: false, error: body.error || 'Failed to update white-label configuration.' };
        }

        if (body.user) {
          setCurrentUser(body.user);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(body.user));
          return { success: true };
        }
      }

      // Offline or local fallback for active Agency account
      const updated: UserProfile = {
        ...currentUser,
        whiteLabel: config,
      };
      setCurrentUser(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to save white-label branding.' };
    }
  };

  const upgradeTier = async (tier: 'starter' | 'pro' | 'agency', paymentId: string) => {
    const targetLimits = TIER_LIMITS[tier] || TIER_LIMITS.starter;

    if (token) {
      try {
        const res = await fetch('/api/subscription/upgrade', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tier, paymentId }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            setToken(data.token);
            try {
              localStorage.setItem(TOKEN_KEY, data.token);
            } catch {}
          }
          if (data.user) {
            setCurrentUser(data.user);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
            } catch {}
            setIsOnboardingModalOpen(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Subscription upgrade sync note:', err);
      }
    }

    if (currentUser) {
      const updated: UserProfile = {
        ...currentUser,
        tier,
        evaluationsLimit: targetLimits.evaluations,
        evaluationsUsed: 0,
        interviewQuestionsLimit: targetLimits.interviewQuestions,
        interviewQuestionsUsed: 0,
        razorpayPaymentId: paymentId,
        hasSeenOnboardingPlans: true,
      };
      setCurrentUser(updated);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      setIsOnboardingModalOpen(false);
    }
  };

  const dismissOnboarding = () => {
    setIsOnboardingModalOpen(false);
    if (currentUser) {
      const updated: UserProfile = {
        ...currentUser,
        hasSeenOnboardingPlans: true,
      };
      setCurrentUser(updated);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
    }
  };

  const openOnboardingModal = () => {
    setIsOnboardingModalOpen(true);
  };

  const closeOnboardingModal = () => {
    dismissOnboarding();
  };

  const recordEvaluationUsed = (count: number = 1) => {
    if (!currentUser) return;
    const currentUsed = currentUser.evaluationsUsed || 0;
    const updated: UserProfile = {
      ...currentUser,
      evaluationsUsed: currentUsed + count,
    };
    setCurrentUser(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const recordInterviewQuestionUsed = (count: number = 1) => {
    if (!currentUser) return;
    const currentUsed = currentUser.interviewQuestionsUsed || 0;
    const updated: UserProfile = {
      ...currentUser,
      interviewQuestionsUsed: currentUsed + count,
    };
    setCurrentUser(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    if (!supabase) {
      return { success: false, error: 'Google sign-in client is not initialized.' };
    }
    setOauthError(null);
    try {
      const redirectTarget = `${window.location.origin}${window.location.pathname}`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTarget,
          queryParams: { prompt: 'select_account' },
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        return { success: false, error: error.message || 'Could not start Google sign-in.' };
      }
      if (data?.url) {
        if (window.self !== window.top && window.top) {
          try {
            window.top.location.assign(data.url);
            return { success: true };
          } catch {
            // Fall through to current frame navigation if cross-origin top access is blocked
          }
        }
        window.location.assign(data.url);
        return { success: true };
      }
      return { success: false, error: 'No Google authentication URL was returned.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Google sign-in error.' };
    }
  };

  const clearOauthError = () => {
    setOauthError(null);
  };

  const signOut = () => {
    setToken(null);
    setCurrentUser(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    supabase?.auth.signOut().catch(() => {});
    setIsProfileModalOpen(false);
    setIsOnboardingModalOpen(false);
    setDispatchedNotification(null);
  };

  const openAuthModal = (
    mode: 'signin' | 'signup' | 'verify' | 'forgot' = 'signin'
  ) => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const openProfileModal = () => {
    setIsProfileModalOpen(true);
  };

  const closeProfileModal = () => {
    setIsProfileModalOpen(false);
  };

  const dismissDispatchedNotification = () => {
    setDispatchedNotification(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        currentUser,
        isAuthenticated: Boolean(currentUser),
        signUp,
        signIn,
        verifyEmail,
        resendVerificationCode,
        requestPasswordReset,
        resetPassword,
        updateProfile,
        updateWhiteLabel,
        upgradeTier,
        recordEvaluationUsed,
        recordInterviewQuestionUsed,
        signOut,
        signInWithGoogle,
        oauthError,
        clearOauthError,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        isProfileModalOpen,
        openProfileModal,
        closeProfileModal,
        dispatchedNotification,
        dismissDispatchedNotification,
        isOnboardingModalOpen,
        openOnboardingModal,
        closeOnboardingModal,
        dismissOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
