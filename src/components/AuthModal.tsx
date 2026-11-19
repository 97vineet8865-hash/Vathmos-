import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  LogIn,
  Building2,
  Briefcase,
  Mail,
  Lock,
  User,
  ShieldCheck,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validateEmailAddress, validatePasswordStrength } from '../utils/authSecurity';
import { IS_PUBLIC_BETA } from '../utils/razorpayService';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalMode,
    closeAuthModal,
    signUp,
    signIn,
    verifyEmail,
    resendVerificationCode,
    requestPasswordReset,
    resetPassword,
    signInWithGoogle,
    oauthError,
    clearOauthError,
    dispatchedNotification,
    dismissDispatchedNotification,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'verify' | 'forgot'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('Senior Recruiter');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');

  // Sync mode when openAuthModal triggers with specific mode
  useEffect(() => {
    setMode(authModalMode);
    setError(oauthError || null);
    setSuccessMsg(null);
    setIsGoogleLoading(false);
  }, [authModalMode, isAuthModalOpen, oauthError]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccessMsg(null);
    clearOauthError();
    setIsGoogleLoading(true);
    try {
      const res = await signInWithGoogle();
      if (!res.success && res.error) {
        setError(res.error);
        setIsGoogleLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not start Google sign-in.');
      setIsGoogleLoading(false);
    }
  };

  if (!isAuthModalOpen) return null;

  // Sign In Handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await signIn(email, password);
      if (!res.success) {
        if (res.requireVerification) {
          setError(res.error || 'Email verification required.');
          setMode('verify');
        } else {
          setError(res.error || 'Authentication failed.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error.');
    } finally {
      setIsLoading(false);
    }
  };

  // Sign Up Handler
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Validation
    const emailCheck = validateEmailAddress(email);
    if (!emailCheck.valid) {
      setError(emailCheck.error || 'Invalid email address.');
      return;
    }

    const passCheck = validatePasswordStrength(password);
    if (!passCheck.valid) {
      setError(passCheck.error || 'Password does not meet security requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter identical passwords.');
      return;
    }

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await signUp({
        name,
        email,
        password,
        companyName: companyName.trim() || 'Hiring Organization',
        role,
      });

      if (res.success) {
        if (!res.verifiedImmediate) {
          setSuccessMsg(
            `Security verification code generated for ${email}. Please enter the 6-digit code to verify your account.`
          );
          setMode('verify');
        }
      } else {
        setError(res.error || 'Registration failed.');
      }
    } catch (err: any) {
      setError(err?.message || 'Registration error.');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify Email Handler
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (verificationCode.trim().length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyEmail(email, verificationCode);
      if (!res.success) {
        setError(res.error || 'Verification failed.');
      }
    } catch (err: any) {
      setError(err?.message || 'Verification error.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend Code Handler
  const handleResendCode = async () => {
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);
    try {
      const res = await resendVerificationCode(email);
      if (res.success) {
        setSuccessMsg(`New 6-digit verification code dispatched for ${email}!`);
      } else {
        setError(res.error || 'Failed to resend code.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to resend code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Password Request Handler
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const emailCheck = validateEmailAddress(email);
    if (!emailCheck.valid) {
      setError(emailCheck.error || 'Invalid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await requestPasswordReset(email);
      if (res.success) {
        if (res.delivered === false) {
          setSuccessMsg(
            res.message ||
              'Automated password reset OTP emails are paused during Public Beta. Contact vathmossupport@gmail.com for quick recovery.'
          );
        } else {
          setSuccessMsg(`A 6-digit security OTP has been sent to ${email}! Please check your Inbox (or Spam/Promotions).`);
          setResetStep('confirm');
        }
      } else {
        setError(res.error || 'Could not send reset code.');
      }
    } catch (err: any) {
      setError(err?.message || 'Reset request error.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Password Confirm Handler
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (password !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    const passCheck = validatePasswordStrength(password);
    if (!passCheck.valid) {
      setError(passCheck.error || 'Password does not meet requirements.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await resetPassword(email, verificationCode, password);
      if (res.success) {
        setSuccessMsg('Password reset successful! You can now sign in with your new password.');
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
        setVerificationCode('');
      } else {
        setError(res.error || 'Password reset failed.');
      }
    } catch (err: any) {
      setError(err?.message || 'Password reset error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div
        id="auth-modal-card"
        className="relative w-full max-w-md bg-[#12151E]/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl p-6 sm:p-7 text-zinc-100 my-8"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
          aria-label="Close authentication modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Enterprise Dispatch Notice to Email (No code revealed in browser) */}
        {dispatchedNotification && (
          <div className="mb-4 p-3.5 bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/30 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between text-sky-400 font-semibold">
              <span className="flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-sky-400" />
                Verification Code Dispatched
              </span>
              <button
                type="button"
                onClick={dismissDispatchedNotification}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-zinc-300 leading-relaxed">
              A 6-digit confirmation code has been dispatched to <strong className="text-white">{dispatchedNotification.email}</strong>. Please check your inbox (and spam folder) and enter the 6-digit code below.
            </p>
          </div>
        )}

        {/* Header Branding */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-xs">
            {mode === 'signup' && <UserPlus className="w-5 h-5" />}
            {mode === 'signin' && <LogIn className="w-5 h-5" />}
            {mode === 'verify' && <ShieldCheck className="w-5 h-5 text-emerald-400" />}
            {mode === 'forgot' && <KeyRound className="w-5 h-5 text-amber-400" />}
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">
              {mode === 'signup' && 'Create Recruiter Account'}
              {mode === 'signin' && 'Sign In to Vathmos'}
              {mode === 'verify' && 'Verify Email Address'}
              {mode === 'forgot' && 'Reset Account Password'}
            </h2>
            <p className="text-xs text-zinc-400">
              {mode === 'signup' && '1-click Google sign-in or domain-verified email'}
              {mode === 'signin' && 'Sign in with Google or your registered credentials'}
              {mode === 'verify' && 'Confirm email ownership with 6-digit security code'}
              {mode === 'forgot' && 'Verify your email to create a new password'}
            </p>
          </div>
        </div>

        {/* Tab Switcher for Sign In / Sign Up */}
        {(mode === 'signin' || mode === 'signup') && (
          <>
            <div className="mb-3.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2 text-xs text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong className="text-white">Free Account Benefit:</strong> 5 candidate evaluations + 5 AI interview guides — no credit card required.
              </span>
            </div>
            <div className="grid grid-cols-2 p-1 bg-[#0E1018]/90 border border-white/[0.06] rounded-xl mb-4">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-white/[0.08] text-white shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white/[0.08] text-white shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          </>
        )}

        {/* Alert / Feedback Messages */}
        {error && (
          <div className="mb-4 px-3.5 py-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 px-3.5 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* 1-Click Continue with Google (Sign In & Sign Up) */}
        {(mode === 'signin' || mode === 'signup') && (
          <div className="mb-4 space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading || isGoogleLoading}
              className="w-full py-2.5 px-4 bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-60"
            >
              {isGoogleLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-zinc-700" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.22 1.18-3.25 0-6-2.19-6.98-5.15H1.01v3.14C3.05 21.21 7.21 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.02 14.02A7.2 7.2 0 0 1 4.64 12c0-.7.13-1.38.38-2.02V6.84H1.01A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.01 5.16l4.01-3.14z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.83c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.29 0 12 0 7.21 0 3.05 2.79 1.01 6.84l4.01 3.14c.98-2.96 3.73-5.15 6.98-5.15z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-white/[0.08] w-full" />
              <span className="px-2.5 text-[10px] uppercase tracking-wider text-zinc-500 bg-[#12151E] shrink-0">
                or use email
              </span>
              <div className="border-t border-white/[0.08] w-full" />
            </div>
          </div>
        )}

        {/* MODE: SIGN IN */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Account Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="recruiter@company.com"
                  className="w-full pl-9 pr-3 py-2 bg-[#0E1018]/80 border border-white/[0.06] focus:border-blue-500 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-zinc-400">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setResetStep('request');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-[11px] text-blue-400 hover:text-blue-300 cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your registered password"
                  className="w-full pl-9 pr-10 py-2 bg-[#0E1018]/80 border border-white/[0.06] focus:border-blue-500 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In to Workspace</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* MODE: SIGN UP */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Mercer"
                  className="w-full pl-9 pr-3 py-2 bg-[#0E1018]/80 border border-white/[0.06] focus:border-blue-500 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Work or Personal Email (e.g. Gmail)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gmail.com or name@company.com"
                  className="w-full pl-9 pr-3 py-2 bg-[#0E1018]/80 border border-white/[0.06] focus:border-blue-500 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                />
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                Disposable &amp; fake domains are blocked; verified by OTP or Google login.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Create Account Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters with letters & numbers"
                  className="w-full pl-9 pr-10 py-2 bg-[#0E1018]/80 border border-white/[0.06] focus:border-blue-500 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type password exactly"
                  className="w-full pl-9 pr-10 py-2 bg-[#0E1018]/80 border border-white/[0.06] focus:border-blue-500 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Company
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full pl-9 pr-3 py-2 bg-[#0E1018]/80 border border-white/[0.06] focus:border-blue-500 rounded-xl text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Role
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full pl-9 pr-2 py-2 bg-[#0E1018]/80 border border-white/[0.06] focus:border-blue-500 rounded-xl text-xs text-white focus:outline-none transition-colors cursor-pointer"
                  >
                    <option value="Senior Recruiter">Senior Recruiter</option>
                    <option value="Talent Acquisition Specialist">Talent Specialist</option>
                    <option value="HR Operations Manager">HR Manager</option>
                    <option value="Hiring Manager">Hiring Manager</option>
                    <option value="Founder / CEO">Founder / CEO</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Legal Acceptance Statement */}
            <div className="pt-1">
              <p className="text-[11px] text-zinc-400 leading-snug text-center">
                By creating an account, you agree to Vathmos's{' '}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Securing Account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>{IS_PUBLIC_BETA ? 'Create Free Account' : 'Create & Verify Email'}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* MODE: VERIFY EMAIL */}
        {mode === 'verify' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-1.5 text-xs">
              <p className="text-blue-300 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                Email Verification Required
              </p>
              <p className="text-zinc-300 leading-relaxed">
                To guarantee that <strong className="text-white">{email}</strong> is a real, active email address, enter the 6-digit confirmation code below.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                6-Digit Verification Code (OTP)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  className="w-full pl-9 pr-3 py-2.5 bg-[#0E1018]/80 border border-white/[0.06] focus:border-emerald-500 rounded-xl text-lg font-mono font-bold tracking-widest text-center text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || verificationCode.length !== 6}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Confirming Verification...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Activate Account</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isLoading}
                className="text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
              >
                Resend Code
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                Change Email
              </button>
            </div>
          </form>
        )}

        {/* MODE: FORGOT PASSWORD */}
        {mode === 'forgot' && (
          <div className="space-y-4">
            {resetStep === 'request' ? (
              <form onSubmit={handleRequestReset} className="space-y-3.5">
                <p className="text-xs text-zinc-400">
                  Enter your account email to receive a 6-digit password reset code.
                </p>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Registered Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="recruiter@company.com"
                      className="w-full pl-9 pr-3 py-2 bg-[#0E1018]/80 border border-white/[0.06] focus:border-amber-500 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>Sending Code...</span>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      <span>Send Reset Code</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setError(null);
                    }}
                    className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    6-Digit Reset Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter 6-digit code"
                    className="w-full px-3 py-2 bg-[#0E1018]/80 border border-white/[0.06] focus:border-amber-500 rounded-xl text-sm font-mono text-center text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters with letters & numbers"
                    className="w-full px-3 py-2 bg-[#0E1018]/80 border border-white/[0.06] focus:border-amber-500 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full px-3 py-2 bg-[#0E1018]/80 border border-white/[0.06] focus:border-amber-500 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                >
                  {isLoading ? <span>Updating Password...</span> : <span>Save New Password</span>}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
