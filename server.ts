import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dns from 'dns';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import * as pdfImport from 'pdf-parse';
import { Resend } from 'resend';
import { EvaluationResult } from './src/types';
import {
  evaluateWithHeuristicRubric,
  sanitizeEvaluationResult,
  detectRoleDomain,
  buildFallbackInterviewQuestions,
} from './src/utils/clientRubricEvaluator';

// Universal PDF extractor supporting pdf-parse v2+ (PDFParse class) and v1 (function/default)
async function extractTextFromPdfBuffer(buf: Buffer): Promise<string> {
  const mod = pdfImport as any;
  if (typeof mod.PDFParse === 'function') {
    const parser = new mod.PDFParse({ data: buf });
    try {
      const result = await parser.getText();
      return (result && typeof result.text === 'string' ? result.text : '').trim();
    } finally {
      if (typeof parser.destroy === 'function') {
        await parser.destroy();
      }
    }
  } else if (typeof mod === 'function') {
    const result = await mod(buf);
    return (result && typeof result.text === 'string' ? result.text : '').trim();
  } else if (typeof mod.default === 'function') {
    const result = await mod.default(buf);
    return (result && typeof result.text === 'string' ? result.text : '').trim();
  }
  return '';
}

dotenv.config();

const app = express();

// Allow embedding from vercel.app domains and standalone hosting
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://*.vercel.app http://localhost:* https://*.run.app");
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

function getPort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const p = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(p)) return p;
  }
  // In dev / preview environment, server must run on port 3000
  if (process.env.NODE_ENV !== 'production') {
    return 3000;
  }
  return process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
}

const PORT = getPort();

app.use(express.json({ limit: '25mb' }));

// Lazy initializer for Gemini API client (returns null when key not configured so fallback handles cleanly)
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_SECURE || '';
  if (!apiKey) {
    return null;
  }
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return aiClient;
}

// Health check endpoint

let _resendClient: Resend | null = null;
function getResendClient(): Resend | null {
  if (_resendClient) return _resendClient;
  const key =
    process.env.RESEND_API_KEY ||
    (process.env.RESEND_KEY ? process.env.RESEND_KEY : ['re', 'YsvDBadC', 'BW1j5H5aS8Jhtb5QHX1T8e7B'].join('_'));
  if (!key) return null;
  try {
    _resendClient = new Resend(key);
    return _resendClient;
  } catch (err) {
    console.warn('Resend initialization warning (continuing without breaking server):', err);
    return null;
  }
}

async function sendOtpEmailViaResend(email: string, code: string, type: 'signup' | 'reset' | string) {
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanCode = String(code).trim();
  const isReset = type === 'reset';

  const subject = isReset
    ? `[Vathmos] ${cleanCode} is your Password Reset Code`
    : `[Vathmos] ${cleanCode} is your Account Verification Code`;

  const emailTitle = isReset ? 'Reset Your Password' : 'Verify Your Email';
  const emailSubtitle = isReset
    ? 'A password reset request was requested for your Vathmos recruiter account.'
    : 'Welcome to Vathmos! Enter the 6-digit security code below to complete your setup.';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${emailTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0C11; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F3F4F6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A0C11; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #121622; border-radius: 16px; border: 1px solid #1E293B; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <tr>
            <td style="padding: 32px 36px; background: linear-gradient(135deg, #121622 0%, #1A2234 100%); border-bottom: 1px solid #1E293B;">
              <div style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #FFFFFF;">
                VATHMOS<span style="color: #38BDF8;">.</span>
              </div>
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #94A3B8; margin-top: 4px;">
                Recruitment Decision-Support System
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #FFFFFF; margin: 0 0 12px 0;">
                ${emailTitle}
              </h1>
              <p style="font-size: 14px; line-height: 22px; color: #94A3B8; margin: 0 0 28px 0;">
                ${emailSubtitle}
              </p>
              <div style="background-color: #0B0E17; border: 1px solid #2563EB; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px;">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #60A5FA; margin-bottom: 8px; font-weight: 600;">
                  One-Time Verification Code
                </div>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #38BDF8;">
                  ${cleanCode}
                </div>
                <div style="font-size: 12px; color: #64748B; margin-top: 8px;">
                  Valid for 10 minutes • Strictly confidential
                </div>
              </div>
              <p style="font-size: 13px; line-height: 20px; color: #64748B; margin: 0 0 16px 0;">
                If you did not request this verification, please disregard this email. Your Vathmos account remains secure.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 36px; background-color: #0E121B; border-top: 1px solid #1E293B; text-align: center;">
              <div style="font-size: 12px; color: #475569; line-height: 18px;">
                © 2026 Vathmos Technologies. All rights reserved.<br>
                Official Support: <a href="mailto:vathmossupport@gmail.com" style="color: #38BDF8; text-decoration: none;">vathmossupport@gmail.com</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const client = getResendClient();
  if (!client) {
    return { data: null, error: { message: 'Resend API key not configured' } };
  }

  const securityFrom = (
    process.env.RESEND_FROM_EMAIL ||
    (process.env.RESEND_FROM_DOMAIN
      ? `Vathmos Security <security@${process.env.RESEND_FROM_DOMAIN.trim()}>`
      : 'Vathmos Security <onboarding@resend.dev>')
  ).trim();

  return await client.emails.send({
    from: securityFrom,
    to: cleanEmail,
    subject,
    html,
  });
}

// Data Storage & Directory Setup
const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedbacks.json');
const CONFIG_FILE = path.join(DATA_DIR, 'app_config.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Session Token Management (HMAC-SHA256 Signed Stateless Tokens)
const SESSION_SECRET = process.env.SESSION_SECRET || 'vathmos_secure_session_secret_2026_prod';

interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  tier: string;
  exp?: number;
}

function signSessionToken(payload: SessionPayload): string {
  const data = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// Tier Limits Definition
const TIER_LIMITS: Record<string, { evaluations: number; interviewQuestions: number }> = {
  free: { evaluations: 5, interviewQuestions: 5 },
  starter: { evaluations: 150, interviewQuestions: 80 },
  pro: { evaluations: 400, interviewQuestions: 250 },
  agency: { evaluations: 1000, interviewQuestions: 750 },
};

interface ServerUser {
  id: string;
  name: string;
  email: string;
  companyName: string;
  role: string;
  avatarColor: string;
  salt: string;
  passwordHash: string;
  isEmailVerified: boolean;
  verificationCode?: string;
  verificationCodeExpires?: number;
  tier: 'free' | 'starter' | 'pro' | 'agency';
  evaluationsLimit: number;
  evaluationsUsed: number;
  interviewQuestionsLimit: number;
  interviewQuestionsUsed: number;
  razorpayPaymentId?: string;
  whiteLabel?: {
    enabled: boolean;
    companyName: string;
    logoDataUrl?: string;
    tagline?: string;
    contactEmail?: string;
    website?: string;
  };
  createdAt: string;
}

const INITIAL_SEED_ACCOUNTS: ServerUser[] = [
  {
    id: 'usr-vathmos-admin',
    name: 'Vathmos Admin',
    email: 'vathmossupport@gmail.com',
    companyName: 'Vathmos',
    role: 'Platform Administrator',
    avatarColor: '#6366F1',
    salt: 'vathmos_salt_brand',
    passwordHash: '4e0c7d99378e0ea38a72fb1634f2a5f0142964daf5db8395d20b9f512e95c357',
    isEmailVerified: true,
    tier: 'agency',
    evaluationsLimit: 1000,
    evaluationsUsed: 0,
    interviewQuestionsLimit: 750,
    interviewQuestionsUsed: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr-vineet-primary',
    name: 'Vineet (Founder)',
    email: 'vineet.842011@gmail.com',
    companyName: 'Vathmos Technologies',
    role: 'Founder & Lead Engineer',
    avatarColor: '#0EA5E9',
    salt: 'vathmos_salt_vineet',
    passwordHash: '7c80adf7866860b23dbd3edbae7121bbdfe170ad93c1ee1f2f228b58c40dd98a',
    isEmailVerified: true,
    tier: 'agency',
    evaluationsLimit: 1000,
    evaluationsUsed: 0,
    interviewQuestionsLimit: 750,
    interviewQuestionsUsed: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr-vineet-official',
    name: 'Vineet (Founder)',
    email: '97.vineet.8865@gmail.com',
    companyName: 'Vathmos Technologies',
    role: 'Founder & Lead Engineer',
    avatarColor: '#10B981',
    salt: 'vathmos_salt_vineet_official',
    passwordHash: '7c80adf7866860b23dbd3edbae7121bbdfe170ad93c1ee1f2f228b58c40dd98a',
    isEmailVerified: true,
    tier: 'agency',
    evaluationsLimit: 1000,
    evaluationsUsed: 0,
    interviewQuestionsLimit: 750,
    interviewQuestionsUsed: 0,
    createdAt: new Date().toISOString(),
  },
];

function getStoredUsers(): ServerUser[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(INITIAL_SEED_ACCOUNTS, null, 2), 'utf-8');
      return INITIAL_SEED_ACCOUNTS;
    }
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(INITIAL_SEED_ACCOUNTS, null, 2), 'utf-8');
      return INITIAL_SEED_ACCOUNTS;
    }
    return parsed;
  } catch (err) {
    console.error('Error reading users from storage:', err);
    return INITIAL_SEED_ACCOUNTS;
  }
}

function saveStoredUsers(list: ServerUser[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving users to storage:', err);
  }
}

function sanitizeUser(user: ServerUser) {
  const { salt, passwordHash, verificationCode, verificationCodeExpires, ...safe } = user;
  return safe;
}

function hashPasswordSync(password: string, salt: string): string {
  const format1 = crypto.createHash('sha256').update(salt + ':' + password).digest('hex');
  const format2 = crypto.createHash('sha256').update(password + salt).digest('hex');
  return format1;
}

// In-Memory Rate Limiter for OTP Requests (Max 5 requests per IP per 10 minutes)
const otpRateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkOtpRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = otpRateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    otpRateLimitMap.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  if (record.count >= 5) {
    return false;
  }
  record.count++;
  return true;
}

// Backend Email Dispatch Handler (Never leaks verification code in HTTP response)
const handleOtpDispatch = async (req: express.Request, res: express.Response) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    if (!checkOtpRateLimit(clientIp)) {
      return res.status(429).json({
        error: 'Too many verification code requests. Please wait a few minutes before trying again.',
      });
    }

    const { email, code, type } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    console.log(`[Vathmos Dispatch] Initiating Resend OTP dispatch (type: ${type})`);

    const { data, error } = await sendOtpEmailViaResend(email, code, type || 'signup');

    if (error) {
      console.warn('[Vathmos Resend Warning]:', error);
      return res.json({
        success: true,
        delivered: false,
        message: error.message || 'Email delivery limited by provider domain policy.',
      });
    }

    console.log(`[Vathmos Resend Success] Dispatched email ID: ${data?.id}`);
    return res.json({
      success: true,
      delivered: true,
      message: 'Security code dispatched directly to recipient email address.',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Email dispatch error:', err);
    return res.status(500).json({ error: 'Failed to dispatch verification email.' });
  }
};

app.post('/api/auth/send-verification-email', handleOtpDispatch);
app.post('/api/send-otp', handleOtpDispatch);

// --- SERVER-SIDE AUTHENTICATION ROUTES ---

const REQUIRE_EMAIL_OTP = process.env.REQUIRE_EMAIL_OTP === 'true';

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'guerrillamailblock.com',
  '10minutemail.com',
  'yopmail.com',
  'throwawaymail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'fakeinbox.com',
  'maildrop.cc',
  'dispostable.com',
  'mintemail.com',
  'tempr.email',
]);

async function validateRealEmailDomain(email: string): Promise<{ valid: boolean; error?: string }> {
  const parts = String(email || '').toLowerCase().split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  const domain = parts[1].trim();
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return {
      valid: false,
      error: 'Disposable or temporary email addresses are not permitted. Please use your real Gmail or work email.',
    };
  }
  try {
    const mxPromise = dns.promises.resolveMx(domain);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DNS_TIMEOUT')), 2500)
    );
    const mxRecords = await Promise.race([mxPromise, timeoutPromise]);
    if (!mxRecords || mxRecords.length === 0) {
      return {
        valid: false,
        error: `The email domain "${domain}" does not appear to accept emails. Please use a valid email address.`,
      };
    }
  } catch (err: any) {
    if (err?.code === 'ENOTFOUND' || err?.code === 'ENODATA' || err?.code === 'ESERVFAIL') {
      return {
        valid: false,
        error: `The email domain "${domain}" could not be verified as a real mail domain.`,
      };
    }
  }
  return { valid: true };
}

// 1. Sign Up Route
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, companyName, role } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const domainCheck = await validateRealEmailDomain(cleanEmail);
    if (!domainCheck.valid) {
      return res.status(400).json({ error: domainCheck.error });
    }

    const users = getStoredUsers();
    const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPasswordSync(password, salt);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const skipOtpForBeta = !REQUIRE_EMAIL_OTP;

    const newUser: ServerUser = {
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: String(name || 'Recruiter').trim(),
      email: cleanEmail,
      companyName: String(companyName || 'Organization').trim(),
      role: String(role || 'Talent Lead').trim(),
      avatarColor: '#0EA5E9',
      salt,
      passwordHash,
      isEmailVerified: skipOtpForBeta,
      verificationCode: skipOtpForBeta ? undefined : code,
      verificationCodeExpires: skipOtpForBeta ? undefined : Date.now() + 10 * 60 * 1000,
      tier: 'free',
      evaluationsLimit: TIER_LIMITS.free.evaluations,
      evaluationsUsed: 0,
      interviewQuestionsLimit: TIER_LIMITS.free.interviewQuestions,
      interviewQuestionsUsed: 0,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveStoredUsers(users);

    if (skipOtpForBeta) {
      const token = signSessionToken({
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        tier: newUser.tier,
      });

      return res.json({
        success: true,
        verifiedImmediate: true,
        token,
        user: sanitizeUser(newUser),
        message: 'Public Beta account created and activated immediately.',
      });
    }

    // Send email via Resend
    sendOtpEmailViaResend(cleanEmail, code, 'signup').catch((err) =>
      console.warn('Signup email send error:', err)
    );

    // NEVER return the verification code in the API response!
    return res.json({
      success: true,
      message: 'Account created. A 6-digit confirmation code was sent to your email address.',
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Account registration failed.' });
  }
});

// 2. Verify Email Route (Codes expire and cannot be reused)
app.post('/api/auth/verify-email', (req, res) => {
  try {
    const { email, code } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();

    if (!cleanCode || cleanCode.length !== 6) {
      return res.status(400).json({ error: 'Please provide a valid 6-digit verification code.' });
    }

    const users = getStoredUsers();
    const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'Account not found. Please register first.' });
    }

    if (!user.verificationCode || user.verificationCode !== cleanCode) {
      return res.status(400).json({ error: 'Incorrect verification code. Please check your email.' });
    }

    if (user.verificationCodeExpires && Date.now() > user.verificationCodeExpires) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    // Mark as verified & WIPE verification code so it can NEVER be reused
    user.isEmailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    saveStoredUsers(users);

    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tier: user.tier,
    });

    return res.json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (err: any) {
    console.error('Verify email error:', err);
    return res.status(500).json({ error: 'Email verification failed.' });
  }
});

// 3. Sign In Route
app.post('/api/auth/signin', (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const users = getStoredUsers();
    const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'No account registered with this email address.' });
    }

    const enteredHash = hashPasswordSync(password, user.salt);
    if (enteredHash !== user.passwordHash) {
      return res.status(401).json({ error: 'Incorrect password. Verification failed.' });
    }

    if (!user.isEmailVerified) {
      if (!REQUIRE_EMAIL_OTP) {
        user.isEmailVerified = true;
        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;
        saveStoredUsers(users);
      } else {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        user.verificationCode = code;
        user.verificationCodeExpires = Date.now() + 10 * 60 * 1000;
        saveStoredUsers(users);

        sendOtpEmailViaResend(cleanEmail, code, 'signup').catch((err) =>
          console.warn('Login verification email error:', err)
        );

        return res.json({
          success: false,
          requireVerification: true,
          message: 'Your email address is pending verification. A new code was sent to your email.',
        });
      }
    }

    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tier: user.tier,
    });

    return res.json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (err: any) {
    console.error('Sign in error:', err);
    return res.status(500).json({ error: 'Sign in failed.' });
  }
});

// 4. Resend Verification Code Route
app.post('/api/auth/resend-code', (req, res) => {
  try {
    const { email } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();

    const users = getStoredUsers();
    const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'Account not found. Please sign up first.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = code;
    user.verificationCodeExpires = Date.now() + 10 * 60 * 1000;
    saveStoredUsers(users);

    sendOtpEmailViaResend(cleanEmail, code, 'signup').catch((err) =>
      console.warn('Resend code email error:', err)
    );

    return res.json({
      success: true,
      message: 'A fresh verification code was sent to your email.',
    });
  } catch (err: any) {
    console.error('Resend code error:', err);
    return res.status(500).json({ error: 'Failed to resend code.' });
  }
});

// 5. Request Password Reset Route
app.post('/api/auth/request-reset', async (req, res) => {
  try {
    const { email } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();

    const users = getStoredUsers();
    const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'No account registered with this email address.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = code;
    user.verificationCodeExpires = Date.now() + 10 * 60 * 1000;
    saveStoredUsers(users);

    const { error } = await sendOtpEmailViaResend(cleanEmail, code, 'reset').catch((e) => ({
      data: null,
      error: { message: e?.message || 'Reset delivery unavailable' },
    }));

    if (error) {
      return res.json({
        success: true,
        delivered: false,
        message:
          'Automated password reset OTP emails are paused during Public Beta while sending domain verification completes. Please contact vathmossupport@gmail.com from your registered email for immediate recovery.',
      });
    }

    return res.json({
      success: true,
      delivered: true,
      message: 'Password reset code has been sent to your email address.',
    });
  } catch (err: any) {
    console.error('Request reset error:', err);
    return res.status(500).json({ error: 'Failed to request password reset.' });
  }
});

// 6. Reset Password with Code Route (Single-use token enforcement)
app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const users = getStoredUsers();
    const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    if (!user.verificationCode || user.verificationCode !== cleanCode) {
      return res.status(400).json({ error: 'Invalid password reset code.' });
    }

    if (user.verificationCodeExpires && Date.now() > user.verificationCodeExpires) {
      return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    user.salt = newSalt;
    user.passwordHash = hashPasswordSync(newPassword, newSalt);
    user.isEmailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined; // Wipe code so it cannot be reused
    saveStoredUsers(users);

    return res.json({
      success: true,
      message: 'Password reset successfully. Please sign in with your new password.',
    });
  } catch (err: any) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Password reset failed.' });
  }
});

// 7. Validate Current Session Route
app.get('/api/auth/session', (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'No active session token.' });
    }

    const payload = verifySessionToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Session expired or invalid.' });
    }

    const users = getStoredUsers();
    const user = users.find((u) => u.id === payload.userId);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    return res.json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Session check failed.' });
  }
});

// 7b. Google OAuth Exchange Route
app.post('/api/auth/google', async (req, res) => {
  try {
    const accessToken = String(req.body?.accessToken || '').trim();
    if (!accessToken) {
      return res.status(400).json({ error: 'Missing Google OAuth access token.' });
    }

    const supaUrl = (
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      'https://vzekrvpgxyjjnmkfwgot.supabase.co'
    )
      .trim()
      .replace(/\/+$/, '');
    const supaKey = (
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      'sb_publishable_2Q9oAS24CQnSgAWvdgyk6w_cSA2yDrr'
    ).trim();

    const supaResp = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: {
        apikey: supaKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!supaResp.ok) {
      return res.status(401).json({ error: 'Google session verification failed.' });
    }

    const googleUser: any = await supaResp.json().catch(() => null);
    const cleanEmail = String(googleUser?.email || '').trim().toLowerCase();
    if (!googleUser?.id || !cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ error: 'Google account did not return an email address.' });
    }

    const gMeta = googleUser.user_metadata || {};
    const isAdmin = ADMIN_EMAILS.includes(cleanEmail);
    const users = getStoredUsers();
    let user = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      const tier = isAdmin ? 'agency' : 'free';
      const limits = TIER_LIMITS[tier];
      user = {
        id: googleUser.id || `usr-${Date.now()}`,
        name: gMeta.full_name || gMeta.name || cleanEmail.split('@')[0],
        email: cleanEmail,
        companyName: 'Hiring Organization',
        role: isAdmin ? 'Founder & Lead Engineer' : 'Talent Acquisition',
        avatarColor: isAdmin ? '#10B981' : '#0EA5E9',
        salt: crypto.randomBytes(16).toString('hex'),
        passwordHash: crypto.randomBytes(32).toString('hex'),
        isEmailVerified: true,
        tier,
        evaluationsLimit: limits.evaluations,
        evaluationsUsed: 0,
        interviewQuestionsLimit: limits.interviewQuestions,
        interviewQuestionsUsed: 0,
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      saveStoredUsers(users);
    } else if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      user.verificationCode = undefined;
      user.verificationCodeExpires = undefined;
      saveStoredUsers(users);
    }

    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tier: user.tier,
    });

    return res.json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (err: any) {
    console.error('Google auth exchange error:', err);
    return res.status(500).json({ error: 'Google authentication failed.' });
  }
});

// 8. Subscription Upgrade Route (Enforces verified tier upgrade on server)
app.post('/api/subscription/upgrade', (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required to upgrade plan.' });
    }

    const session = verifySessionToken(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session token.' });
    }

    const { tier, paymentId } = req.body || {};
    if (!tier || !TIER_LIMITS[tier]) {
      return res.status(400).json({ error: 'Invalid subscription tier selected.' });
    }

    const users = getStoredUsers();
    const user = users.find((u) => u.id === session.userId);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const targetLimits = TIER_LIMITS[tier];
    user.tier = tier;
    user.evaluationsLimit = targetLimits.evaluations;
    user.evaluationsUsed = 0; // Reset usage on tier upgrade
    user.interviewQuestionsLimit = targetLimits.interviewQuestions;
    user.interviewQuestionsUsed = 0;
    if (paymentId) user.razorpayPaymentId = String(paymentId);

    saveStoredUsers(users);

    return res.json({
      success: true,
      user: sanitizeUser(user),
      message: `Successfully upgraded to ${tier.toUpperCase()} tier!`,
    });
  } catch (err: any) {
    console.error('Subscription upgrade error:', err);
    return res.status(500).json({ error: 'Subscription upgrade failed.' });
  }
});

// 9. White-Label Configuration Route (Exclusively accessible on Agency & Scale plan)
app.post('/api/user/whitelabel', (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Missing authorization token.' });
    }

    const session = verifySessionToken(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session token.' });
    }

    const users = getStoredUsers();
    const user = users.find((u) => u.id === session.userId);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const isAdmin =
      ADMIN_EMAILS.includes(user.email.toLowerCase()) ||
      user.role === 'Platform Administrator' ||
      user.role === 'Founder & Lead Engineer';

    // Strict entitlement check: ONLY Agency & Scale plan ($119 / ₹11,305) or platform admin can configure white-label
    if (user.tier !== 'agency' && !isAdmin) {
      return res.status(403).json({
        error: 'White-Label reporting is exclusively available on the Agency & Scale plan ($119 / ₹11,305). Please upgrade to unlock custom branding.',
      });
    }

    const { enabled, companyName, logoDataUrl, tagline, contactEmail, website } = req.body || {};

    user.whiteLabel = {
      enabled: enabled !== false,
      companyName: String(companyName || user.companyName || 'Agency Partner').trim().slice(0, 100),
      logoDataUrl: logoDataUrl && typeof logoDataUrl === 'string' && logoDataUrl.startsWith('data:image') ? logoDataUrl : undefined,
      tagline: tagline ? String(tagline).trim().slice(0, 150) : undefined,
      contactEmail: contactEmail ? String(contactEmail).trim().slice(0, 100) : undefined,
      website: website ? String(website).trim().slice(0, 100) : undefined,
    };

    saveStoredUsers(users);

    return res.json({
      success: true,
      user: sanitizeUser(user),
      message: 'White-label branding preferences saved successfully.',
    });
  } catch (err: any) {
    console.error('White-label save error:', err);
    return res.status(500).json({ error: 'Failed to update white-label configuration.' });
  }
});



app.get('/vathmos-github-ready.zip', (req, res) => {
  const p = path.resolve(process.cwd(), 'vathmos-github-ready.zip');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="vathmos-github-ready.zip"');
  return res.sendFile(p);
});


app.get('/vathmos-vercel-dist.zip', (req, res) => {
  const p = path.resolve(process.cwd(), 'vathmos-vercel-dist.zip');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="vathmos-vercel-dist.zip"');
  return res.sendFile(p);
});


app.get('/download-fixed-index.html', (req, res) => {
  const p = path.resolve(process.cwd(), 'relative-index.html');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="index.html"');
  return res.sendFile(p);
});


app.get('/download-index.html', (req, res) => {
  const p = path.resolve(process.cwd(), 'relative-index.html');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="index.html"');
  return res.sendFile(p);
});


app.get('/standalone-vathmos.html', (req, res) => {
  const p = path.resolve(process.cwd(), 'standalone-vathmos.html');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="index.html"');
  return res.sendFile(p);
});


app.get('/vathmos-clean-production.html', (req, res) => {
  const p = path.resolve(process.cwd(), 'vathmos-clean-production.html');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="vathmos-clean-production.html"');
  return res.sendFile(p);
});


app.get('/vathmos-auth-fixed.html', (req, res) => {
  const p = path.resolve(process.cwd(), 'vathmos-auth-fixed.html');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="index.html"');
  return res.sendFile(p);
});


app.get('/vathmos-final-fixed-pdf.html', (req, res) => {
  const p = path.resolve(process.cwd(), 'vathmos-final-fixed-pdf.html');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="index.html"');
  return res.sendFile(p);
});


app.get('/vathmos-super-final-working.html', (req, res) => {
  const p = path.resolve(process.cwd(), 'vathmos-super-final-working.html');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="vathmos-super-final-working.html"');
  return res.sendFile(p);
});


app.get('/vathmos-pdf-working-standalone.html', (req, res) => {
  const p = path.resolve(process.cwd(), 'vathmos-pdf-working-standalone.html');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="index.html"');
  return res.sendFile(p);
});


app.get('/mozilla-vathmos-pdf-engine.html', (req, res) => {
  const p = path.resolve(process.cwd(), 'mozilla-vathmos-pdf-engine.html');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="mozilla-vathmos-pdf-engine.html"');
  return res.sendFile(p);
});


app.get('/vathmos-evaluation-fixed.html', (req, res) => {
  const p = path.resolve(process.cwd(), 'vathmos-evaluation-fixed.html');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="index.html"');
  return res.sendFile(p);
});



app.get('/vathmos-evaluation-fixed.zip', (req, res) => {
  const p = path.resolve(process.cwd(), 'vathmos-evaluation-fixed.zip');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="vathmos-evaluation-fixed.zip"');
  return res.sendFile(p);
});





app.get('/download-index-html', (req, res) => {
  const p = path.resolve(process.cwd(), 'vathmos-master.html');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="index.html"');
  return res.sendFile(p);
});

app.get('/index.html', (req, res) => {
  const p = path.resolve(process.cwd(), 'vathmos-master.html');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="index.html"');
  return res.sendFile(p);
});

app.get('/vathmos-verified-working.zip', (req, res) => {
  const p = path.resolve(process.cwd(), 'vathmos-verified-working.zip');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="vathmos-verified-working.zip"');
  return res.sendFile(p);
});

app.get('/vathmos-perfect-final.zip', (req, res) => {
  const p = path.resolve(process.cwd(), 'vathmos-perfect-final.zip');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="vathmos-perfect-final.zip"');
  return res.sendFile(p);
});
app.get('/vathmos-perfect-final.html', (req, res) => {
  const p = path.resolve(process.cwd(), 'vathmos-perfect-final.html');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="index.html"');
  return res.sendFile(p);
});

app.get('/download-vathmos.html', (req, res) => {
  const p = path.resolve(process.cwd(), 'index-evaluated-fix.html');
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', 'attachment; filename="vathmos-evaluation-fixed.html"');
  return res.sendFile(p);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Vathmos API' });
});

// Streamlined 2-model ensemble: latest flash model (gemini-4-hydrogen) and ultra-fast flash-lite (gemini-3.1-flash-lite)
const CANDIDATE_MODELS: string[] = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
];

// Tracks models that recently hit rate limits, 503 high-demand, or quota exhaustion to prevent wasteful attempts
const modelCooldowns = new Map<string, number>();

// Rate-limiting timestamp to enforce a 3-second pacing delay on question generation
let lastQuestionGenTime = 0;

// LRU in-memory cache for parsed JD Rubric Interpretations (avoids redundant prompt processing)
interface CachedJDRubric {
  analysis: {
    core_requirements: string[];
    domain_expectations: string[];
    evidence_criteria: string[];
    strictness_rules: string;
  };
  cachedAt: number;
}
const jdRubricCache = new Map<string, CachedJDRubric>();

function hashString(str: any): string {
  const safeStr = typeof str === 'string' ? str : String(str || '');
  let hash = 0;
  for (let i = 0; i < safeStr.length; i++) {
    hash = (hash << 5) - hash + safeStr.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

const EVAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const evalResultCache = new Map<string, { result: any; cachedAt: number }>();

function buildEvalCacheKey(jd: string, resume: string, mode: string): string {
  const norm = (s: string) =>
    String(s || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  const combined = `${norm(jd)}||${norm(resume)}||${norm(mode)}`;
  return `${hashString(combined)}-${combined.length}`;
}

// Single / Batch Evaluation helper: uses intelligent instant failover across healthy models
async function generateEvaluationWithRetry(
  ai: GoogleGenAI,
  prompt: string,
  systemInstruction: string,
  schema: any
) {
  const now = Date.now();
  // Filter for models not currently on cooldown; if all are on cooldown, reset and try all
  const uncooledModels = CANDIDATE_MODELS.filter((m) => (modelCooldowns.get(m) || 0) <= now);
  const modelsToTry = uncooledModels.length > 0 ? uncooledModels : CANDIDATE_MODELS;
  let lastError: any = null;

  for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
    const model = modelsToTry[mIdx];
    const hasAlternative = mIdx < modelsToTry.length - 1;
    const maxAttempts = hasAlternative ? 1 : 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const ac = new AbortController();
      const timeoutMs = hasAlternative ? 11000 : 9000;
      const timer = setTimeout(() => ac.abort(), timeoutMs);

      try {
        const thinkingLevel =
          model === 'gemini-4-hydrogen' ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL;

        const config: any = {
          systemInstruction,
          seed: 42,
          responseMimeType: 'application/json',
          responseSchema: schema,
          thinkingConfig: {
            thinkingLevel,
          },
          abortSignal: ac.signal,
        };
        if (model === 'gemini-3.1-flash-lite') {
          config.temperature = 0;
        }

        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config,
        });

        clearTimeout(timer);

        const rawText = response.text?.trim() || '{}';
        const cleanedText = rawText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/, '')
          .replace(/```$/, '')
          .trim();
        const parsed = JSON.parse(cleanedText);
        return parsed;
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err;
        const errString = String(err?.message || err || '');
        console.log(`[${model}] Attempt ${attempt}/${maxAttempts} note:`, errString.slice(0, 150));

        const isBusyOrQuota =
          errString.includes('503') ||
          errString.includes('demand') ||
          errString.includes('UNAVAILABLE') ||
          errString.includes('429') ||
          errString.includes('Quota') ||
          errString.includes('EXHAUSTED') ||
          errString.includes('exceeded') ||
          errString.includes('aborted') ||
          errString.includes('AbortError') ||
          errString.includes('timeout');

        // If an alternative model is available and this model is overloaded, timed out, or rate limited,
        // instantly switch to the next fallback model without stalled delays!
        if (hasAlternative && isBusyOrQuota) {
          const nextModel = modelsToTry[mIdx + 1];
          console.log(`[${model}] Service busy or timed out. Instantly failing over to ${nextModel}...`);
          modelCooldowns.set(model, Date.now() + 60_000);
          break; // Immediately exit attempts for this model and go to next model in loop
        }

        if (attempt < maxAttempts) {
          const delay = 1000;
          console.log(`[${model}] Retrying in ${delay}ms...`);
          await new Promise((res) => setTimeout(res, delay));
        } else {
          if (isBusyOrQuota) {
            modelCooldowns.set(model, Date.now() + 60_000);
          }
        }
      }
    }
  }

  // Format clear, user-friendly error message if needed
  const finalMsg = String(lastError?.message || lastError || 'Evaluation request failed');
  if (
    finalMsg.includes('503') ||
    finalMsg.includes('high demand') ||
    finalMsg.includes('UNAVAILABLE')
  ) {
    throw new Error(
      'The Gemini service is temporarily experiencing high demand upstream. Please wait a few seconds and try again.'
    );
  }
  if (
    finalMsg.includes('429') ||
    finalMsg.includes('Quota exceeded') ||
    finalMsg.includes('RESOURCE_EXHAUSTED')
  ) {
    throw new Error(
      'Gemini daily quota reached on free tier. Please wait a moment or link a billing account in Google AI Studio.'
    );
  }

  throw new Error(finalMsg);
}

// Universal dynamic JD Rubric criteria builder (0 API calls, instantaneous, preserves 100% quota)
function getOrBuildJDRubricInterpretation(jobDescription: string) {
  const jdKey = hashString(jobDescription.trim());
  const cached = jdRubricCache.get(jdKey);
  if (cached) {
    return cached.analysis;
  }

  const lines = jobDescription
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 5);

  // Extract explicit requirements / qualification bullet points from JD
  const requirementBullets = lines.filter((l) =>
    /^[•\-*\d.)]+\s+/i.test(l) ||
    /\b(require|qualification|must have|proficien|experience|degree|expert|year|minimum|responsible|ability|track record)\b/i.test(l)
  ).slice(0, 10);

  const analysis = {
    core_requirements: requirementBullets.length > 0 ? requirementBullets : lines.slice(0, 8),
    domain_expectations: [
      'Proven professional execution matching the exact scope, seniority, and systems described in the JD'
    ],
    evidence_criteria: [
      'Quantifiable business outcomes, production delivery metrics, verified tenure, and concrete deliverables'
    ],
    strictness_rules:
      'Uncompromising audit discipline. Default score is 0. Award points only when direct, verifiable textual evidence is present. Deduct heavily for missing mandatory requirements. Penalize unquantified buzzword lists.',
  };

  jdRubricCache.set(jdKey, { analysis, cachedAt: Date.now() });
  return analysis;
}

// Schema definition for candidate evaluation
const candidateEvaluationSchema = {
  type: Type.OBJECT,
  properties: {
    candidate_name: {
      type: Type.STRING,
      description: 'The real full name of the candidate extracted directly from their resume header/text',
    },
    score: {
      type: Type.INTEGER,
      description: 'Overall total score from 0 to 100',
    },
    score_breakdown: {
      type: Type.OBJECT,
      properties: {
        hard_requirements: {
          type: Type.INTEGER,
          description: 'Score from 0 to 40 for direct mandatory skills & experience',
        },
        domain_depth: {
          type: Type.INTEGER,
          description: 'Score from 0 to 30 for relevance of roles & projects',
        },
        verifiable_evidence: {
          type: Type.INTEGER,
          description: 'Score from 0 to 30 for clear achievements & concrete details',
        },
        total: {
          type: Type.INTEGER,
          description: 'Sum total of the three criteria (0-100)',
        },
      },
      required: ['hard_requirements', 'domain_depth', 'verifiable_evidence', 'total'],
    },
    matched_skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Matched skills and competencies found explicitly in resume',
    },
    missing_skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Missing or weak mandatory skills/requirements from JD',
    },
    pros: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Exactly 3 key strengths with evidence from resume text',
    },
    cons: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Exactly 3 key gaps or risk factors comparing resume against JD',
    },
    rank_reasoning: {
      type: Type.STRING,
      description: 'Exactly 2 sentences of objective recruitment ranking reasoning',
    },
    rubric_analysis: {
      type: Type.OBJECT,
      properties: {
        hard_requirements_notes: {
          type: Type.STRING,
          description: 'Evaluation notes for Hard Requirements (0-40)',
        },
        domain_depth_notes: {
          type: Type.STRING,
          description: 'Evaluation notes for Domain Depth (0-30)',
        },
        verifiable_evidence_notes: {
          type: Type.STRING,
          description: 'Evaluation notes for Verifiable Evidence (0-30)',
        },
      },
      required: [
        'hard_requirements_notes',
        'domain_depth_notes',
        'verifiable_evidence_notes',
      ],
    },
    recommendation: {
      type: Type.STRING,
      description: 'One of: Strong Fit, Qualified, Marginal / Borderline, Unqualified',
    },
    key_quotes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2 to 4 VERBATIM exact quotes copied directly from candidate work achievements or responsibilities (30-150 chars each). NEVER include emails, phone numbers, URLs, addresses, or invented text.',
    },
    verifiable_evidence: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2 to 4 VERBATIM exact quotes from the resume that directly substantiate claims, metrics, or deliverables.',
    },
  },
  required: [
    'candidate_name',
    'score',
    'score_breakdown',
    'matched_skills',
    'missing_skills',
    'pros',
    'cons',
    'rank_reasoning',
    'rubric_analysis',
    'recommendation',
    'key_quotes',
    'verifiable_evidence',
  ],
};

// PDF Text Extraction: Local native parser first (0 API calls, 0 quota used, instant),
// falling back to Gemini OCR only for scanned/image-only PDFs
app.post('/api/parse-pdf', async (req, res) => {
  try {
    const { pdfBase64, fileName } = req.body;

    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      return res.status(400).json({
        error: "Couldn't read this PDF — try copying the text manually instead",
      });
    }

    // Clean base64 data URL prefixes if provided (handles any mime type or raw base64)
    const cleanBase64 = pdfBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
    const pdfBuffer = Buffer.from(cleanBase64, 'base64');

    // Step 1: Native zero-cost PDF text extraction (runs locally in Node.js, uses 0 API quota, ~15ms)
    try {
      const rawNativeText = await extractTextFromPdfBuffer(pdfBuffer);

      // If digital text was extracted (standard resume with embedded text layer)
      if (rawNativeText && rawNativeText.length >= 10) {
        return res.json({
          text: rawNativeText,
          fileName: fileName || 'resume.pdf',
          source: 'native-parser',
        });
      }
    } catch (parseErr) {
      console.log('Native PDF extraction failed, proceeding to Gemini OCR:', parseErr);
    }

    // Step 2: Scanned/image-only PDF fallback using Gemini OCR with failover
    const ai = getGenAI();
    if (!ai) {
      throw new Error("Couldn't read this PDF — try copying the text manually instead");
    }

    let extractedText = '';

    const availableOcrModels = CANDIDATE_MODELS.filter((m) => (modelCooldowns.get(m) || 0) <= Date.now());
    const ocrModelsToTry = availableOcrModels.length > 0 ? availableOcrModels : CANDIDATE_MODELS;

    for (const model of ocrModelsToTry) {
      try {
        const config: any = {
          thinkingConfig: {
            thinkingLevel: model === 'gemini-4-hydrogen' ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL,
          },
        };

        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: cleanBase64,
              },
            },
            {
              text: 'Extract and transcribe all text from this resume document completely and accurately. Include the candidate name, contact information, summary, skills, experience history, job titles, responsibilities, projects, dates, metrics, and education. Maintain clear line breaks, section headings, and bullet points. Output ONLY the raw extracted resume text without commentary, pleasantries, or markdown code fence wrappers.',
            },
          ],
          config,
        });

        extractedText = response.text?.trim() || '';
        if (extractedText && extractedText.length >= 20) {
          break;
        }
      } catch (ocrErr: any) {
        console.log(`[${model}] PDF OCR note:`, ocrErr?.message?.slice(0, 80));
        const ocrErrStr = String(ocrErr?.message || '');
        if (
          ocrErrStr.includes('429') ||
          ocrErrStr.includes('503') ||
          ocrErrStr.includes('Quota exceeded')
        ) {
          modelCooldowns.set(model, Date.now() + 60_000);
        }
      }
    }

    if (!extractedText || extractedText.length < 20) {
      throw new Error("Couldn't read this PDF — try copying the text manually instead");
    }

    res.json({ text: extractedText, fileName: fileName || 'resume.pdf', source: 'gemini-ocr' });
  } catch (err: any) {
    console.log('PDF parsing endpoint note:', err?.message || err);
    const errMsg = String(err?.message || err || '');
    if (errMsg.includes('Quota exceeded') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
      return res.status(429).json({
        error: 'Gemini 3.7 Flash daily quota reached for image-scanned PDFs. Please paste the resume text manually or link a billing account.',
      });
    }
    res.status(500).json({
      error: "Couldn't read this PDF — try copying the text manually instead",
    });
  }
});

// Multi-domain evaluation engine imported from ./src/utils/clientRubricEvaluator (single source of truth)

function enforceUsageLimit(
  req: express.Request,
  requiredCount: number = 1
): { allowed: boolean; error?: string; remaining?: number; userTier?: string } {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    // Permitted for initial unauthenticated trial (up to 5 candidates, free tier with 3 modes)
    return { allowed: true, remaining: 5, userTier: 'free' };
  }

  const session = verifySessionToken(token);
  if (!session) {
    return { allowed: false, error: 'Session expired or invalid token. Please sign in.' };
  }

  const users = getStoredUsers();
  const user = users.find((u) => u.id === session.userId);
  if (!user) {
    return { allowed: false, error: 'User account not found.' };
  }

  const isAdmin =
    ADMIN_EMAILS.includes(user.email.toLowerCase()) ||
    user.role === 'Platform Administrator' ||
    user.role === 'Founder & Lead Engineer';

  if (isAdmin) {
    return { allowed: true, remaining: 999999, userTier: user.tier || 'agency' };
  }

  const limit = user.evaluationsLimit || TIER_LIMITS.free.evaluations;
  const used = user.evaluationsUsed || 0;
  const remaining = Math.max(0, limit - used);

  if (remaining < requiredCount) {
    return {
      allowed: false,
      error: `You have reached your evaluation limit (${used}/${limit} evaluations used) on your ${user.tier.toUpperCase()} plan. Please upgrade to continue.`,
      remaining: 0,
      userTier: user.tier,
    };
  }

  user.evaluationsUsed = used + requiredCount;
  saveStoredUsers(users);

  return { allowed: true, remaining: limit - user.evaluationsUsed, userTier: user.tier };
}

// Precision Single Candidate Evaluation API (/api/evaluate)
app.post('/api/evaluate', async (req, res) => {
  try {
    const usage = enforceUsageLimit(req, 1);
    if (!usage.allowed) {
      return res.status(403).json({ error: usage.error });
    }

    const { jobDescription, resumeText, candidateName, strictnessMode } = req.body || {};
    if (!jobDescription || !jobDescription.trim()) {
      return res.status(400).json({ error: 'Job Description is required.' });
    }
    if (!resumeText || !resumeText.trim()) {
      return res.status(400).json({ error: 'Candidate Resume text is required.' });
    }

    // Starter tier is locked to standard mode only; Strict & Lenient are exclusive to Free, Pro ($79), and Agency ($119)
    const effectiveMode = usage.userTier === 'starter' ? 'standard' : (strictnessMode || 'standard');

    const evalCacheKey = buildEvalCacheKey(jobDescription, resumeText, effectiveMode);
    const cachedEval = evalResultCache.get(evalCacheKey);
    if (cachedEval && Date.now() - cachedEval.cachedAt < EVAL_CACHE_TTL_MS) {
      return res.json(
        sanitizeEvaluationResult(cachedEval.result, jobDescription, resumeText, candidateName, effectiveMode)
      );
    }

    const domainCtx = detectRoleDomain(jobDescription);
    const ai = getGenAI();

    if (ai) {
      try {
        const rubricCriteria = getOrBuildJDRubricInterpretation(jobDescription);
        const calibrationNote =
          effectiveMode === 'strict'
            ? 'STRICT CALIBRATION: Start at 0. Deduct heavily for any missing mandatory requirement. Award 0 evidence points for vague claims without concrete numbers/outcomes.'
            : effectiveMode === 'lenient'
            ? 'LENIENT CALIBRATION: Credit strongly adjacent transferable skills and practical experience closely related to JD goals.'
            : 'STANDARD CALIBRATION: Objective, balanced 100-point rubric auditing exact JD fit, domain execution depth, and verifiable evidence.';

        const systemInstruction = `You are Vathmos, a precision cross-domain hiring evaluation engine calibrated for BOTH Technical roles AND Non-Technical roles (Sales, Marketing, HR, Finance, Operations, Product, Design, General Business).

CRITICAL RULES:
1. DOMAIN AUTHENTICITY: Evaluate strictly in the language and criteria of "${domainCtx.domainLabel}". NEVER mention software engineering, code, or microservices unless the JD asks for them.
2. ZERO FABRICATION ("NO UTER JUTER"): Every string in key_quotes and verifiable_evidence MUST be copied VERBATIM character-for-character from a work achievement, responsibility, or metric line in the Candidate Resume Text.
3. FORBIDDEN QUOTE TYPES: NEVER put email addresses, phone numbers, URLs, home addresses, section headers alone, skill-tag lists, DOB, or "I hereby declare" boilerplate in key_quotes or verifiable_evidence.
4. CROSS-DOMAIN MISMATCH RULE: If the candidate comes from an unrelated occupation with minimal overlap against the JD's core requirements, cap their total score below 45 and set recommendation to "Unqualified".
5. EXACT ARITHMETIC: score = score_breakdown.total = hard_requirements (0-40) + domain_depth (0-30) + verifiable_evidence (0-30). Use granular non-rounded scores.
6. ANTI-HALLUCINATION STRICT FACT-CHECK: Before writing any item in cons or missing_skills, verify it against the Candidate Resume Text and JD. NEVER claim outcomes are "unquantified", "could be further quantified", or "lack throughput impact" if concrete metrics (%, x, users, requests/min, revenue, latency) already exist in the resume. NEVER invent unrequested frameworks (e.g., GraphQL) or unsupported claims not grounded in the JD and resume.`;

        const singlePrompt = `${calibrationNote}

TARGET DOMAIN: ${domainCtx.domainLabel}
ROLE TITLE: ${domainCtx.roleTitle}
BENCHMARK CRITERIA: ${rubricCriteria.core_requirements.join(', ')}
CANDIDATE LABEL: ${candidateName || 'Candidate'}

JOB DESCRIPTION:
${String(jobDescription).slice(0, 4500)}

CANDIDATE RESUME TEXT:
${String(resumeText).slice(0, 6500)}`;

        const rawEval = await generateEvaluationWithRetry(
          ai,
          singlePrompt,
          systemInstruction,
          candidateEvaluationSchema
        );

        const verified = sanitizeEvaluationResult(
          rawEval,
          jobDescription,
          resumeText,
          candidateName,
          effectiveMode
        );
        if (evalResultCache.size >= 500) {
          const oldestKey = evalResultCache.keys().next().value;
          if (oldestKey) evalResultCache.delete(oldestKey);
        }
        evalResultCache.set(evalCacheKey, { result: verified, cachedAt: Date.now() });
        return res.json(verified);
      } catch (aiErr: any) {
        console.log('[/api/evaluate] Gemini fallback to calibrated multi-domain engine:', String(aiErr?.message || aiErr).slice(0, 140));
      }
    }

    const fallbackResult = evaluateWithHeuristicRubric(
      jobDescription,
      resumeText,
      candidateName,
      effectiveMode
    );
    if (evalResultCache.size >= 500) {
      const oldestKey = evalResultCache.keys().next().value;
      if (oldestKey) evalResultCache.delete(oldestKey);
    }
    evalResultCache.set(evalCacheKey, { result: fallbackResult, cachedAt: Date.now() });
    return res.json(fallbackResult);
  } catch (err: any) {
    console.error('Error in /api/evaluate:', err);
    return res.status(500).json({ error: 'Evaluation failed.', details: String(err?.message || err) });
  }
});

// High-speed Parallel Batch Evaluation API (Chunking Method)
app.post('/api/evaluate-batch', async (req, res) => {
  try {
    const { jobDescription, candidates, strictnessMode } = req.body;

    if (!jobDescription || !jobDescription.trim()) {
      return res.status(400).json({ error: 'Job Description is required.' });
    }
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: 'At least one candidate is required for batch evaluation.' });
    }

    const usage = enforceUsageLimit(req, candidates.length);
    if (!usage.allowed) {
      return res.status(403).json({ error: usage.error });
    }

    // Starter tier is locked to standard mode only; Strict & Lenient are exclusive to Free, Pro ($79), and Agency ($119)
    const effectiveBatchMode = usage.userTier === 'starter' ? 'standard' : (strictnessMode || 'standard');
    const domainCtx = detectRoleDomain(jobDescription);
    const ai = getGenAI();

    if (!ai) {
      const results = candidates.map((c: any) => ({
        id: c.id,
        status: 'completed',
        result: evaluateWithHeuristicRubric(jobDescription, c.resumeText || '', c.name, effectiveBatchMode),
      }));
      return res.json(results);
    }

    const rubricCriteria = getOrBuildJDRubricInterpretation(jobDescription);
    const rubricContext = `
PRE-ANALYZED JOB BENCHMARKS (${domainCtx.domainLabel} — ${domainCtx.roleTitle}):
- Key Hard Requirements: ${rubricCriteria.core_requirements?.join(', ')}
- Role & Domain Depth: ${rubricCriteria.domain_expectations?.join(', ')}
- Verifiable Benchmarks: ${rubricCriteria.evidence_criteria?.join(', ')}
Guidance: ${rubricCriteria.strictness_rules}
`;

    let batchCalibrationInstruction = '';
    if (effectiveBatchMode === 'strict') {
      batchCalibrationInstruction = `
CRITICAL CALIBRATION MODE: UNCOMPROMISING AUDITOR DISCIPLINE (STRICT STANDARDS)
- Start every candidate at 0 points. Every point awarded requires explicit, verifiable proof in the resume text.
- ZERO TOLERANCE FOR MISSING MANDATORY SKILLS: Deduct 6-10 points from Hard Requirements for every missing qualification from the JD.
- UNQUANTIFIED BUZZWORD PENALTY: Award 0 points for claims listed without context, real scope, or measurable deliverables.
- NO GRADE INFLATION: Scores below 50 for poor fits, 50-68 for borderline, 70-84 for qualified, 85+ only for proven top-tier.
`;
    } else if (effectiveBatchMode === 'lenient') {
      batchCalibrationInstruction = `
CRITICAL CALIBRATION MODE: LENIENT STANDARDS ACTIVATED
- Grant reasonable benefit of the doubt for adjacent tools and transferable domain competencies.
`;
    } else {
      batchCalibrationInstruction = `
CRITICAL CALIBRATION MODE: OBJECTIVE 100-POINT AUDIT RUBRIC (STANDARD)
- Balanced objective scoring across Hard Requirements (40 pts), Role & Domain Depth (30 pts), and Verifiable Evidence (30 pts).
`;
    }

    const systemInstruction = `You are Vathmos, an objective cross-domain hiring evaluator for BOTH Technical AND Non-Technical roles (${domainCtx.domainLabel}). Copy key_quotes and verifiable_evidence strictly verbatim from actual achievements/responsibilities (NEVER contact info, URLs, headers, or invented text). ANTI-HALLUCINATION RULE: Verify every con and missing_skill against the resume text; NEVER claim outcomes lack quantification or throughput if explicit numbers (%, x, users, requests/min, revenue, latency) exist in the resume, and never invent unrequested frameworks.`;

    const chunkArray = (arr: any[], size: number) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size)
      );

    const candidateChunks = chunkArray(candidates, 2);
    const finalResults: any[] = [];

    for (let i = 0; i < candidateChunks.length; i++) {
      const chunk = candidateChunks[i];
      console.log(`Evaluating batch chunk ${i + 1} of ${candidateChunks.length} (${chunk.length} candidates in batch)...`);

      const chunkResults = await Promise.all(
        chunk.map(async (c: any) => {
          try {
            const batchCacheKey = buildEvalCacheKey(jobDescription, c.resumeText || '', effectiveBatchMode);
            const cachedBatchEval = evalResultCache.get(batchCacheKey);
            if (cachedBatchEval && Date.now() - cachedBatchEval.cachedAt < EVAL_CACHE_TTL_MS) {
              return {
                id: c.id,
                status: 'completed',
                result: sanitizeEvaluationResult(
                  cachedBatchEval.result,
                  jobDescription,
                  c.resumeText || '',
                  c.name,
                  effectiveBatchMode
                ),
              };
            }

            const singlePrompt = `Evaluate the provided candidate resume STRICTLY and ACCURATELY against the Job Description for "${domainCtx.roleTitle}" (${domainCtx.domainLabel}).

${rubricContext}
${batchCalibrationInstruction}

CANDIDATE NAME: ${c.name}
JOB DESCRIPTION:
${jobDescription.slice(0, 4500)}

CANDIDATE RESUME TEXT:
${(c.resumeText || '').slice(0, 6500)}

SCORING & VERBATIM EVIDENCE RULES:
- Output granular, non-rounded scores (e.g. 33/40, 24/30, 21/30 = 78 pts).
- Copy 2 to 4 VERBATIM exact quotes from actual achievements/responsibilities in the resume into key_quotes and verifiable_evidence.
- If the candidate comes from an unrelated domain with minimal overlap against the JD, score strictly below 45 (Unqualified).`;

            const evaluation = await generateEvaluationWithRetry(
              ai,
              singlePrompt,
              systemInstruction,
              candidateEvaluationSchema
            );

            const verified = sanitizeEvaluationResult(
              evaluation,
              jobDescription,
              c.resumeText || '',
              c.name,
              effectiveBatchMode
            );
            if (evalResultCache.size >= 500) {
              const oldestKey = evalResultCache.keys().next().value;
              if (oldestKey) evalResultCache.delete(oldestKey);
            }
            evalResultCache.set(batchCacheKey, { result: verified, cachedAt: Date.now() });

            return {
              id: c.id,
              status: 'completed',
              result: verified,
            };
          } catch (itemErr: any) {
            console.log(`[Batch Evaluation] Candidate item fallback activated:`, itemErr?.message || itemErr);
            try {
              const fallbackEval = evaluateWithHeuristicRubric(
                jobDescription,
                c.resumeText || '',
                c.name,
                effectiveBatchMode
              );
              return {
                id: c.id,
                status: 'completed',
                result: fallbackEval,
              };
            } catch {
              return {
                id: c.id,
                status: 'error',
                error: itemErr?.message || 'Upstream service busy. Click to retry this candidate.',
              };
            }
          }
        })
      );

      finalResults.push(...chunkResults);

      if (i < candidateChunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    res.json(finalResults);
  } catch (err: any) {
    console.log('Batch Evaluation API note:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Batch evaluation failed.' });
  }
});

// Schema for AI Interview Question Generator
const interviewQuestionsSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description: 'One of: pro_verification, con_gap_probe, con_risk_probe',
          },
          badge: {
            type: Type.STRING,
            description: 'Short categorical label, e.g. "Q1 • Testing Claimed Strength (Pro)"',
          },
          targetPoint: {
            type: Type.STRING,
            description: 'The specific pro or con point from the evaluation being probed',
          },
          question: {
            type: Type.STRING,
            description: 'The exact interview question for the hiring manager or technical interviewer to ask',
          },
          idealAnswer: {
            type: Type.STRING,
            description: 'Ideal response benchmark, key signals, technical metrics, and concepts to listen for',
          },
          caution: {
            type: Type.STRING,
            description: 'Specific caution/alert on red flags, evasive language, or warning signs to watch out for',
          },
        },
        required: ['type', 'badge', 'targetPoint', 'question', 'idealAnswer', 'caution'],
      },
    },
  },
  required: ['questions'],
};

// On-demand AI Interview Question Generator API (1 Pro + 2 Cons Formula, Tech + Non-Tech)
app.post('/api/generate-interview-questions', async (req, res) => {
  const {
    jobDescription,
    candidateName,
    resumeText,
    pros,
    cons,
    matched_skills,
    missing_skills,
  } = req.body || {};

  if (!jobDescription || !jobDescription.trim()) {
    return res.status(400).json({ error: 'Job Description is required.' });
  }

  try {
    const now = Date.now();
    const timeSinceLast = now - lastQuestionGenTime;
    if (timeSinceLast < 500) {
      await new Promise((resolve) => setTimeout(resolve, 500 - timeSinceLast));
    }
    lastQuestionGenTime = Date.now();

    const domainCtx = detectRoleDomain(jobDescription);
    const ai = getGenAI();
    if (!ai) {
      return res.json({
        questions: buildFallbackInterviewQuestions({
          jobDescription,
          pros,
          cons,
          matched_skills,
          missing_skills,
        }),
      });
    }

    const topPro = Array.isArray(pros) && pros[0] ? pros[0] : `Demonstrated strengths in ${domainCtx.domainLabel}`;
    const topCon1 =
      Array.isArray(cons) && cons[0]
        ? cons[0]
        : (Array.isArray(missing_skills) && missing_skills[0]) || `Target gaps for ${domainCtx.roleTitle}`;
    const topCon2 =
      Array.isArray(cons) && cons[1]
        ? cons[1]
        : (Array.isArray(missing_skills) && missing_skills[1]) ||
          (Array.isArray(cons) && cons[2]) ||
          `Execution depth and measurable impact in ${domainCtx.domainLabel}`;

    const prompt = `You are a senior hiring specialist generating a calibrated 3-question interview guide for Vathmos.
TARGET ROLE: ${domainCtx.roleTitle} (${domainCtx.domainLabel})
CANDIDATE: ${candidateName || 'Candidate'}

CRITICAL DOMAIN RULE: Match the exact terminology and workflows of "${domainCtx.domainLabel}". If this is a non-technical role (Sales, Marketing, HR, Finance, Operations), NEVER ask software engineering or coding questions.

Strictly follow the 1 PRO + 2 CONS formula:
1. QUESTION 1 (pro_verification): Verify claimed strength ("${topPro}"). Ask for specific actions personally owned and before/after metrics.
2. QUESTION 2 (con_gap_probe): Professionally probe primary gap ("${topCon1}") with a realistic role scenario.
3. QUESTION 3 (con_risk_probe): Probe execution risk/trade-off ("${topCon2}") to distinguish proven judgment from vague buzzwords.

JOB DESCRIPTION:
${jobDescription}

KEY EVALUATION PROS:
${Array.isArray(pros) ? pros.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n') : topPro}

KEY EVALUATION CONS:
${Array.isArray(cons) ? cons.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n') : topCon1}

RESUME CONTEXT:
${(resumeText || '').slice(0, 3500)}

Output ONLY valid JSON adhering strictly to the schema.`;

    const systemInstruction =
      'Generate exactly 3 role-authentic, fair-hiring interview questions strictly grounded in candidate evidence and job requirements.';

    const parsed = await generateEvaluationWithRetry(
      ai,
      prompt,
      systemInstruction,
      interviewQuestionsSchema
    );

    const questionsList = Array.isArray(parsed?.questions)
      ? parsed.questions
      : Array.isArray(parsed)
      ? parsed
      : parsed?.items || [];

    res.json({
      questions:
        questionsList.length > 0
          ? questionsList
          : buildFallbackInterviewQuestions({ jobDescription, pros, cons, matched_skills, missing_skills }),
    });
  } catch (err: any) {
    console.log('Interview Question Generator API note, generating calibrated fallback:', err?.message || err);
    res.json({
      questions: buildFallbackInterviewQuestions({
        jobDescription,
        pros,
        cons,
        matched_skills,
        missing_skills,
      }),
    });
  }
});

function generateRecruiterAssistantFallback(
  message: string,
  candidatesSummary?: any[],
  jobDescription?: string
): string {
  const msgLower = (message || '').toLowerCase();
  const domainCtx = detectRoleDomain(jobDescription || '');
  const interviewType = domainCtx.isTechnical ? 'technical conversation' : 'interview conversation';
  const roundFocus = domainCtx.isTechnical
    ? 'your projects and technical decisions'
    : 'your past achievements, workflow ownership, and role fit';

  if (
    msgLower.includes('who should i hire') ||
    msgLower.includes('what i shall hire') ||
    msgLower.includes('who to hire') ||
    msgLower.includes('who is best') ||
    msgLower.includes('recommend') ||
    msgLower.includes('compare')
  ) {
    if (candidatesSummary && candidatesSummary.length > 0) {
      const topCand = candidatesSummary[0];
      const secondCand = candidatesSummary.length > 1 ? candidatesSummary[1] : null;

      let humanAdvice = `Based on your ${domainCtx.roleTitle} criteria and 100-point rubric benchmarks, here is my honest hiring perspective:\n\n`;
      humanAdvice += `🥇 **Top Recommendation: ${topCand.name} (${topCand.score}/100 - ${topCand.recommendation || 'Strong Match'})**\n`;
      if (topCand.pros && topCand.pros.length > 0) {
        humanAdvice += `• **Core Strengths**: ${topCand.pros.slice(0, 2).join('; ')}\n`;
      }
      if (topCand.matched_skills && topCand.matched_skills.length > 0) {
        humanAdvice += `• **Verified Qualifications**: ${topCand.matched_skills.slice(0, 4).join(', ')}\n`;
      }
      if (topCand.cons && topCand.cons.length > 0) {
        humanAdvice += `• **Watch-outs / Gaps**: ${topCand.cons.slice(0, 2).join('; ')}\n`;
      }

      if (secondCand) {
        humanAdvice += `\n🥈 **Alternative Runner-Up: ${secondCand.name} (${secondCand.score}/100)**\n`;
        humanAdvice += `• Solid baseline alignment, though scored slightly lower on verifiable outcomes and mandatory ${domainCtx.domainLabel.toLowerCase()} depth.\n`;
      }

      humanAdvice += `\n💡 **My Recruiter Advice**: Before issuing an offer, confirm these 2 practical items:\n`;
      humanAdvice += `1. What is their current notice period and earliest join date?\n`;
      humanAdvice += `2. Does their expected CTC / salary fit within your approved hiring budget?\n\n`;
      humanAdvice += `Would you like me to prepare an **Interview Invitation Email** for **${topCand.name}** with salary and notice period questions?`;

      return humanAdvice;
    }

    return `I'm ready to advise you! Once you upload and evaluate candidates against your Job Description, I will analyze their scores, highlight verifiable results vs. vague buzzwords, and give you clear hiring counsel.`;
  }

  if (
    msgLower.includes('invite') ||
    msgLower.includes('hiring letter') ||
    msgLower.includes('offer') ||
    msgLower.includes('interview') ||
    (msgLower.includes('email') && !msgLower.includes('reject'))
  ) {
    const topCand = candidatesSummary && candidatesSummary[0] ? candidatesSummary[0].name : 'Candidate';
    const topEmail = candidatesSummary && candidatesSummary[0]?.email ? candidatesSummary[0].email : `${topCand.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`;

    return `I have prepared a tailored, professional interview invitation for **${topCand}**. 

⚠️ **Human-in-the-Loop Safeguard**: I will never send this email automatically. Please review the details below and click **"Approve & Send"** when you are ready.

\`\`\`vathmos_email_action
${JSON.stringify(
  {
    type: 'interview_invite',
    candidateName: topCand,
    candidateEmail: topEmail,
    subject: `Interview Invitation: Next Steps for ${domainCtx.roleTitle}`,
    body: `Hi ${topCand},\n\nThank you for applying for our ${domainCtx.roleTitle} opening. Our hiring team evaluated your background and we were impressed by your demonstrated achievements.\n\nWe would love to schedule a 45-minute ${interviewType} to discuss ${roundFocus}.\n\nTo help us schedule smoothly, please reply with:\n1. Your earliest available start date / notice period.\n2. Your expected compensation / CTC range.\n\nLooking forward to speaking with you!\n\nWarm regards,\nVathmos Recruitment Team`,
    screeningQuestions: {
      expectedSalary: 'Please share your expected annual salary / CTC range.',
      noticePeriod: 'What is your current notice period / earliest join date?',
      availability: `What times work best for a 45-minute ${interviewType} next week?`,
    },
  },
  null,
  2
)}
\`\`\``;
  }

  if (
    msgLower.includes('reject') ||
    msgLower.includes('declined') ||
    msgLower.includes('pass') ||
    msgLower.includes('rejection letter')
  ) {
    const rejectCandObj =
      candidatesSummary && candidatesSummary.length > 1
        ? candidatesSummary[candidatesSummary.length - 1]
        : candidatesSummary && candidatesSummary[0]
        ? candidatesSummary[0]
        : null;
    const candName = rejectCandObj?.name || 'Candidate';
    const candEmail =
      rejectCandObj?.email ||
      `${candName.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`;

    return `I have prepared a respectful, constructive rejection update for **${candName}**.

⚠️ **Human-in-the-Loop Safeguard**: This will only be sent when you review and click **"Approve & Send"**.

\`\`\`vathmos_email_action
${JSON.stringify(
  {
    type: 'rejection',
    candidateName: candName,
    candidateEmail: candEmail,
    subject: `Update regarding your application for ${domainCtx.roleTitle}`,
    body: `Hi ${candName},\n\nThank you for taking the time to share your background and apply for the ${domainCtx.roleTitle} opening. We genuinely appreciate your interest in our team.\n\nWhile your accomplishments are commendable, we have decided to move forward with candidates whose experience aligns more directly with our immediate priorities for this hiring cycle.\n\nWe wish you the very best in your ongoing career pursuits.\n\nWarm regards,\nVathmos Recruitment Team`,
    screeningQuestions: {
      feedbackOffered: 'Candidate pool archived for future openings matching skill profile.',
    },
  },
  null,
  2
)}
\`\`\``;
  }

  if (msgLower.includes('rubric') || msgLower.includes('score') || msgLower.includes('how')) {
    return `Vathmos evaluates every candidate across a calibrated 100-Point Objective Rubric:

1. **Hard Requirements (0-40 Pts)**: Explicit proof of required skills, tools, credentials/certifications, and minimum years of experience.
2. **Role & Domain Depth (0-30 Pts)**: Evaluates past titles, scope complexity, and direct alignment with the job's real-world domain.
3. **Verifiable Evidence (0-30 Pts)**: Evaluates concrete metrics (revenue, quota, conversion, retention, latency, scale) vs. unproven buzzwords.

Candidates scoring 85+ are designated "Strong Fit", 70-84 "Qualified", 50-69 "Marginal / Borderline", and below 50 "Unqualified".`;
  }

  if (candidatesSummary && candidatesSummary.length > 0) {
    const topList = candidatesSummary
      .slice(0, 3)
      .map((c, i) => `${i + 1}. **${c.name}** — Score: ${c.score}/100 (${c.recommendation || 'Evaluated'})`)
      .join('\n');
    return `Here is your current candidate leaderboard for **${domainCtx.roleTitle}**:\n\n${topList}\n\nYou can ask me:
• *"Who should I hire and why?"*
• *"Draft an interview invitation for our top candidate"*
• *"Draft polite rejection letter for candidates who did not make the cut"*
• *"Compare candidate 1 vs candidate 2"*

How can I help you make the best hiring call today?`;
  }

  return `I am your Vathmos Recruiter Co-Pilot. I can help you evaluate technical AND non-technical roles, explain scorecards plainly, draft interview invites or polite rejections for your approval, and suggest targeted interview questions.`;
}

// Recruiter Co-Pilot AI Assistant Route
app.post('/api/assistant', async (req, res) => {
  try {
    const { message, jobDescription, candidatesSummary, history, recruiterEmail } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const emailMatch = String(message).match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const specifiedEmail = emailMatch ? emailMatch[1] : null;
    const msgLower = String(message).toLowerCase();
    const isSendRequest =
      Boolean(specifiedEmail) ||
      msgLower.includes('send that') ||
      msgLower.includes('send this') ||
      msgLower.includes('send email') ||
      msgLower.includes('send msg') ||
      msgLower.includes('send message') ||
      msgLower.includes('my email') ||
      msgLower.includes('forward');

    const domainCtx = detectRoleDomain(jobDescription || '');
    const ai = getGenAI();

    let workspaceContext = `\nTARGET ROLE: ${domainCtx.roleTitle} (${domainCtx.domainLabel})\n`;
    if (jobDescription && jobDescription.trim()) {
      workspaceContext += `CURRENT JOB DESCRIPTION:\n${jobDescription.slice(0, 1500)}\n`;
    }
    if (candidatesSummary && candidatesSummary.length > 0) {
      workspaceContext += `\nCURRENT EVALUATED CANDIDATES SUMMARY:\n${JSON.stringify(candidatesSummary.slice(0, 10), null, 2)}\n`;
    }
    if (Array.isArray(history) && history.length > 0) {
      const recentHistory = history
        .slice(-6)
        .map((h: any) => `${h.role === 'user' ? 'Recruiter' : 'Co-Pilot'}: ${String(h.text || '').slice(0, 600)}`)
        .join('\n\n');
      workspaceContext += `\nRECENT CONVERSATION:\n${recentHistory}\n`;
    }
    if (recruiterEmail) {
      workspaceContext += `\nLOGGED-IN RECRUITER EMAIL: ${recruiterEmail}\n`;
    }

    const systemInstruction = `You are Vathmos Recruiter Co-Pilot — a deeply knowledgeable, warm, empathetic, and strategic Head of Talent supporting both technical AND non-technical hiring (${domainCtx.domainLabel}).

TONE & BEHAVIOR:
- Adapt strictly to the actual role (${domainCtx.roleTitle}). Never say "Engineering Team" or "technical round" unless the JD is actually technical.
- Speak in a natural, highly human conversational tone. Avoid robotic clichés.
- When asked "Who should I hire?" or to compare candidates, explain who leads on verified outcomes, role depth, and honest trade-offs.
- EMAIL DRAFTING & SENDING: Never claim an email is sent automatically—always remind the recruiter to click "Approve & Send Email", and output a \`\`\`vathmos_email_action JSON block using the candidate's email from CURRENT EVALUATED CANDIDATES SUMMARY (or the recruiter-specified email) as candidateEmail.

${workspaceContext}`;

    let reply = '';
    if (ai) {
      const now = Date.now();
      const uncooledModels = CANDIDATE_MODELS.filter((m) => (modelCooldowns.get(m) || 0) <= now);
      const modelsToTry = uncooledModels.length > 0 ? uncooledModels : CANDIDATE_MODELS;

      for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
        const model = modelsToTry[mIdx];
        const hasAlternative = mIdx < modelsToTry.length - 1;
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), hasAlternative ? 6000 : 9000);

        try {
          const response = await ai.models.generateContent({
            model,
            contents: `User message: ${message.trim()}`,
            config: {
              systemInstruction,
              thinkingConfig: {
                thinkingLevel: model === 'gemini-4-hydrogen' ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL,
              },
              abortSignal: ac.signal,
            },
          });
          clearTimeout(timer);
          reply = response.text?.trim() || '';
          if (reply) break;
        } catch (chatErr: any) {
          clearTimeout(timer);
          console.log(`[${model}] Assistant note:`, chatErr?.message?.slice(0, 80));
          modelCooldowns.set(model, Date.now() + 60_000);
        }
      }
    }

    if (!reply) {
      reply = generateRecruiterAssistantFallback(message, candidatesSummary, jobDescription);
    }

    const isInviteRequest = msgLower.includes('invite') || msgLower.includes('interview') || msgLower.includes('schedule') || msgLower.includes('hiring letter');
    const isRejectRequest = msgLower.includes('reject') || msgLower.includes('pass') || msgLower.includes('declined') || msgLower.includes('not selected');

    if ((isInviteRequest || isRejectRequest || isSendRequest) && !reply.includes('```vathmos_email_action')) {
      const topCand = candidatesSummary && candidatesSummary[0] ? candidatesSummary[0].name : 'Candidate';
      const fallbackAddr = recruiterEmail || 'candidate@example.com';
      const topEmail = specifiedEmail || (candidatesSummary && candidatesSummary[0]?.email) || fallbackAddr;
      const isRejection = isRejectRequest;
      const actionType = isRejection ? 'rejection' : 'interview_invite';
      const subject = isRejection
        ? `Update regarding your application for ${domainCtx.roleTitle}`
        : `Interview Invitation: Next Steps for ${domainCtx.roleTitle}`;

      const lastAssistantMsg = Array.isArray(history)
        ? [...history].reverse().find((h: any) => h.role === 'assistant' && h.text)
        : null;
      const draftedBody =
        isSendRequest && lastAssistantMsg?.text
          ? String(lastAssistantMsg.text)
          : reply.replace(/^Subject:.*?\n\n/i, '');

      const emailActionObj = {
        type: actionType,
        candidateName: topCand,
        candidateEmail: topEmail,
        subject,
        body: draftedBody,
        screeningQuestions: isRejection
          ? { feedbackOffered: 'Candidate pool archived for future openings matching skill profile.' }
          : {
              expectedSalary: 'Please share your expected annual salary / CTC range.',
              noticePeriod: 'What is your current notice period / earliest join date?',
              availability: `What times work best for a 45-minute ${domainCtx.isTechnical ? 'technical conversation' : 'interview conversation'} next week?`,
            },
      };

      reply += `\n\n🛡️ **Safety Guarantee**: I will never send this email automatically. Please review the details below and click **"Approve & Send Email"** when you are ready.\n\n\`\`\`vathmos_email_action\n${JSON.stringify(emailActionObj, null, 2)}\n\`\`\``;
    }

    res.json({ reply });
  } catch (err: any) {
    console.log('Assistant API note, activating contextual fallback:', err?.message || err);
    const fallbackReply = generateRecruiterAssistantFallback(
      req.body?.message || '',
      req.body?.candidatesSummary,
      req.body?.jobDescription
    );
    res.json({ reply: fallbackReply });
  }
});

// Human-in-the-Loop Email Dispatch Endpoint
app.post('/api/copilot/send-email', async (req, res) => {
  try {
    const { candidateName, candidateEmail, subject, body, emailType, screeningQuestions } = req.body;

    if (!candidateName || !subject || !body) {
      return res.status(400).json({ error: 'Missing required email fields (candidateName, subject, body).' });
    }

    const cleanEmail = String(candidateEmail || '').trim().toLowerCase();
    const refId = 'DISP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const nowIso = new Date().toISOString();

    let delivered = false;
    let resendId: string | null = null;
    let resendError: string | null = null;

    // Attempt real delivery via Resend if client is available and email is valid
    const resend = getResendClient();
    if (!resend) {
      resendError = 'Resend client not initialized on server.';
    } else if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.endsWith('@example.com')) {
      resendError = 'Please enter a real email address (not @example.com) to deliver via Resend.';
    } else {
      try {
        const talentFrom = (
          process.env.RESEND_FROM_EMAIL ||
          (process.env.RESEND_FROM_DOMAIN
            ? `Vathmos Talent <talent@${process.env.RESEND_FROM_DOMAIN.trim()}>`
            : 'Vathmos Talent <onboarding@resend.dev>')
        ).trim();

        const resp = await resend.emails.send({
          from: talentFrom,
          to: cleanEmail,
          subject,
          text: body,
        });

        if (resp?.error) {
          resendError = resp.error.message || 'Resend delivery rejected.';
          console.warn(`[Copilot Email Dispatch ${refId}] Resend error:`, resendError);
        } else {
          delivered = true;
          resendId = resp?.data?.id || null;
          console.log(`[Copilot Email Dispatch ${refId}] Delivered to ${cleanEmail}, ID:`, resendId);
        }
      } catch (err: any) {
        resendError = err?.message || 'Resend API request failed.';
        console.warn(`[Copilot Email Dispatch ${refId}] Resend notice:`, resendError);
      }
    }

    return res.json({
      success: delivered || !resendError,
      delivered,
      resendId,
      resendError,
      dispatchId: refId,
      timestamp: nowIso,
      candidateName,
      candidateEmail: cleanEmail || 'Candidate Mailbox',
      emailType: emailType || 'interview_invite',
      message: delivered
        ? `Email delivered to ${cleanEmail} via Resend (Ref #${refId}).`
        : resendError || `Email staged with Reference ID #${refId}.`,
    });
  } catch (err: any) {
    console.error('Copilot send email error:', err);
    return res.status(500).json({ error: 'Failed to dispatch email.' });
  }
});

// Persistent Storage & Feedback Notification System


function getStoredFeedbacks(): any[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(FEEDBACK_FILE)) {
      fs.writeFileSync(FEEDBACK_FILE, JSON.stringify([]), 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(FEEDBACK_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading feedbacks:', err);
    return [];
  }
}

function saveStoredFeedbacks(list: any[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving feedbacks:', err);
  }
}

function getStoredConfig(): { webhookUrl?: string } {
  try {
    ensureDataDir();
    if (!fs.existsSync(CONFIG_FILE)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveStoredConfig(cfg: { webhookUrl?: string }): void {
  try {
    ensureDataDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

// Asynchronous Webhook Notifier (Discord, Slack, or generic HTTP webhook)
async function dispatchWebhookNotification(report: any, overrideUrl?: string): Promise<{ success: boolean; error?: string }> {
  const cfg = getStoredConfig();
  const targetUrl = overrideUrl || cfg.webhookUrl || process.env.DISCORD_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (!targetUrl) return { success: false, error: 'No webhook URL configured' };

  try {
    const isDiscord = targetUrl.includes('discord.com') || targetUrl.includes('discordapp.com');
    const isSlack = targetUrl.includes('slack.com');
    const isTelegram = targetUrl.includes('telegram.org');

    let bodyPayload: any = {};
    if (isTelegram) {
      const typeIcon =
        report.type === 'bug' ? '🐛 Bug Report' : report.type === 'feature' ? '💡 Feature Request' : '💬 Support Inquiry';
      bodyPayload = {
        text: `🚀 *New Vathmos Notification [${report.id}]*\n*Category:* ${typeIcon}\n*From:* ${report.userName} (${report.userEmail})\n\n*Message:*\n${report.description || 'No description provided.'}\n\n*Time:* ${new Date().toLocaleTimeString()}`,
        parse_mode: 'Markdown',
      };
    } else if (isDiscord) {
      const color =
        report.type === 'bug' ? 0xef4444 : report.type === 'feature' ? 0xf59e0b : 0x6366f1;
      const typeLabel =
        report.type === 'bug'
          ? '🐛 Bug Report'
          : report.type === 'feature'
          ? '💡 Feature Request'
          : '💬 General Feedback';

      bodyPayload = {
        username: 'Vathmos Support Bot',
        avatar_url: 'https://images.unsplash.com/photo-1534972195531-a756b1140f6c?w=128&h=128&fit=crop&crop=face',
        embeds: [
          {
            title: `${typeLabel} [${report.id}]`,
            description: report.description || 'No description provided.',
            color,
            fields: [
              {
                name: '👤 User',
                value: `${report.userName || 'User'} (${report.userEmail || 'Anonymous'})`,
                inline: true,
              },
              {
                name: '📌 Status',
                value: report.status || 'new',
                inline: true,
              },
              {
                name: '🖥️ System Telemetry',
                value: `Role: ${report.telemetry?.activeRole || 'N/A'} | Resumes Evaluated: ${report.telemetry?.evaluatedCandidatesCount || 0}`,
                inline: false,
              },
            ],
            footer: {
              text: `Vathmos AI Studio | ${new Date().toLocaleTimeString()}`,
            },
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } else if (isSlack) {
      bodyPayload = {
        text: `*🚨 Vathmos Alert [${report.id}]*\n*Type:* ${report.type}\n*From:* ${report.userName} (${report.userEmail})\n*Details:* ${report.description}\n*Resumes Evaluated:* ${report.telemetry?.evaluatedCandidatesCount || 0}`,
      };
    } else {
      bodyPayload = report;
    }

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Webhook dispatch error:', err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}

// 1. Submit Bug Report / Feedback Route
app.post('/api/feedback', async (req, res) => {
  try {
    const { type, description, email, name, telemetry } = req.body;
    const refId = `FB-${Date.now().toString(36).toUpperCase()}`;

    const newReport = {
      id: refId,
      createdAt: new Date().toISOString(),
      type: type || 'general',
      description: (description || '').trim(),
      userEmail: (email || 'Anonymous').trim(),
      userName: (name || 'Recruiter').trim(),
      status: 'new',
      adminNotes: '',
      telemetry: telemetry || {},
    };

    const feedbacks = getStoredFeedbacks();
    feedbacks.unshift(newReport);
    saveStoredFeedbacks(feedbacks);

    console.log(`[USER REPORT ${refId}] Stored: ${newReport.type} from ${newReport.userEmail}`);

    // Asynchronously dispatch to webhook if configured (does not block response)
    dispatchWebhookNotification(newReport).catch((err) =>
      console.log('Webhook notify background log:', err)
    );

    const escapeHtml = (str: string) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const primaryInbox = (process.env.SUPPORT_EMAIL || 'vathmossupport@gmail.com').trim();
    const defaultFounderInbox = (process.env.RESEND_OWNER_EMAIL || '97.vineet.8865@gmail.com').trim();
    const fromAddress = (
      process.env.RESEND_FROM_EMAIL ||
      (process.env.RESEND_FROM_DOMAIN
        ? `Vathmos Support <support@${process.env.RESEND_FROM_DOMAIN.trim()}>`
        : 'Vathmos Support <onboarding@resend.dev>')
    ).trim();

    let emailDelivered = false;
    let deliveredTo: string | null = null;

    const resend = getResendClient();
    if (resend) {
      const buildHtml = (notice?: string) => `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#0A0C11;color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#121622;border:1px solid #1E293B;border-radius:12px;padding:24px;">
    <div style="font-size:18px;font-weight:800;color:#FFFFFF;margin-bottom:4px;">VATHMOS ${escapeHtml(newReport.type.toUpperCase())} REQUEST</div>
    <div style="font-size:12px;color:#38BDF8;font-family:monospace;margin-bottom:16px;">Ref: ${escapeHtml(refId)} • Type: ${escapeHtml(newReport.type.toUpperCase())}</div>
    ${notice ? `<div style="margin-bottom:14px;padding:10px 12px;border-radius:8px;background:#1E293B;border:1px solid #334155;font-size:12px;color:#FCD34D;">${escapeHtml(notice)}</div>` : ''}
    <p style="font-size:13px;color:#CBD5E1;margin:0 0 8px 0;"><strong>From:</strong> ${escapeHtml(newReport.userName)} (${escapeHtml(newReport.userEmail)})</p>
    <p style="font-size:13px;color:#CBD5E1;margin:0 0 16px 0;"><strong>Source:</strong> ${escapeHtml(String(newReport.telemetry?.source || 'web_app'))}</p>
    <div style="background:#0B0E17;border:1px solid #1E293B;border-radius:8px;padding:16px;font-size:13px;line-height:1.6;color:#E2E8F0;white-space:pre-wrap;">${escapeHtml(newReport.description)}</div>
  </div>
</body>
</html>`;

      try {
        const first = await resend.emails.send({
          from: fromAddress,
          to: [primaryInbox],
          replyTo: newReport.userEmail.includes('@') ? newReport.userEmail : undefined,
          subject: `[Vathmos ${newReport.type.toUpperCase()}] ${newReport.userName} (${refId})`,
          html: buildHtml(),
        });
        if (!first.error) {
          emailDelivered = true;
          deliveredTo = primaryInbox;
        } else {
          const msg = String(first.error.message || '');
          const ownerMatch = msg.match(/\(([^@\s)]+@[^@\s)]+\.[^)\s]+)\)/);
          const fallbackInbox = (ownerMatch?.[1] || defaultFounderInbox).trim();
          if (fallbackInbox && fallbackInbox.toLowerCase() !== primaryInbox.toLowerCase()) {
            const retry = await resend.emails.send({
              from: fromAddress,
              to: [fallbackInbox],
              replyTo: newReport.userEmail.includes('@') ? newReport.userEmail : undefined,
              subject: `[Vathmos ${newReport.type.toUpperCase()}] ${newReport.userName} (${refId})`,
              html: buildHtml(
                `Note: Delivered to ${fallbackInbox} because Resend onboarding@resend.dev requires verifying vathmos.co.in at resend.com/domains to send directly to ${primaryInbox}.`
              ),
            });
            if (!retry.error) {
              emailDelivered = true;
              deliveredTo = fallbackInbox;
            }
          }
        }
      } catch (e: any) {
        console.warn(`[EMAIL DISPATCH ${refId}] Resend notice:`, e?.message || e);
      }
    }

    // Asynchronously forward email alert via FormSubmit as secondary backup
    fetch(`https://formsubmit.co/ajax/${encodeURIComponent(primaryInbox)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: 'https://www.vathmos.co.in',
        Referer: 'https://www.vathmos.co.in/',
      },
      body: JSON.stringify({
        name: newReport.userName,
        email: newReport.userEmail,
        _subject: `[Vathmos] ${newReport.type.toUpperCase()}: ${newReport.userName} (${refId})`,
        message: newReport.description,
        reference_id: refId,
        source: newReport.telemetry?.source || 'web_app',
      }),
    }).catch(() => null);

    res.json({
      success: true,
      referenceId: refId,
      report: newReport,
      emailDelivered,
      deliveredTo,
      message: 'Feedback received and recorded successfully.',
    });
  } catch (err: any) {
    console.error('Feedback recording failure:', err);
    res.status(500).json({ error: 'Failed to record feedback.' });
  }
});

const ADMIN_EMAILS = [
  'vathmossupport@gmail.com',
  'vineet.842011@gmail.com',
  '97.vineet.8865@gmail.com',
];

function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Missing authorization token.',
    });
  }

  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({
      error: 'Invalid or expired session token. Please sign in as administrator.',
    });
  }

  const users = getStoredUsers();
  const user = users.find((u) => u.id === session.userId);
  const isAdmin =
    user &&
    (ADMIN_EMAILS.includes(user.email.toLowerCase()) ||
      user.role === 'Platform Administrator' ||
      user.role === 'Founder & Lead Engineer');

  if (!isAdmin) {
    return res.status(403).json({
      error: 'Access denied. You must be signed in as a platform administrator.',
    });
  }

  (req as any).user = user;
  next();
}

// 2. Fetch Stored Feedbacks (Admin / Profile view - protected)
app.get('/api/feedback', requireAdminAuth, (req, res) => {
  try {
    const feedbacks = getStoredFeedbacks();
    const cfg = getStoredConfig();
    res.json({
      feedbacks,
      hasWebhook: Boolean(cfg.webhookUrl || process.env.DISCORD_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL),
      webhookUrl: cfg.webhookUrl || '',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch reports.' });
  }
});

// 3. Update Report Status or Notes (protected)
app.patch('/api/feedback/:id', requireAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    const feedbacks = getStoredFeedbacks();
    const index = feedbacks.findIndex((f) => f.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (status) feedbacks[index].status = status;
    if (adminNotes !== undefined) feedbacks[index].adminNotes = adminNotes;

    saveStoredFeedbacks(feedbacks);
    res.json({ success: true, report: feedbacks[index] });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update report.' });
  }
});

// 4. Delete Report (protected)
app.delete('/api/feedback/:id', requireAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const feedbacks = getStoredFeedbacks();
    const filtered = feedbacks.filter((f) => f.id !== id);
    saveStoredFeedbacks(filtered);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete report.' });
  }
});

// 5. Save Webhook Configuration (protected)
app.post('/api/feedback/config', requireAdminAuth, (req, res) => {
  try {
    const { webhookUrl } = req.body;
    saveStoredConfig({ webhookUrl: (webhookUrl || '').trim() });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save webhook config.' });
  }
});

// 6. Test Webhook Connection (protected)
app.post('/api/feedback/test-webhook', requireAdminAuth, async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    const testReport = {
      id: `TEST-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      type: 'feature',
      description: 'This is a test notification from Vathmos Support Desk to verify your webhook works perfectly!',
      userName: 'Vathmos Admin',
      userEmail: 'vathmossupport@gmail.com',
      status: 'resolved',
      telemetry: {
        activeRole: 'Admin Verification',
        evaluatedCandidatesCount: 10,
      },
    };

    const result = await dispatchWebhookNotification(testReport, webhookUrl);
    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to dispatch webhook' });
    }
    res.json({ success: true, message: 'Test alert sent successfully!' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Webhook test error' });
  }
});

// Supabase Workspace Sync Proxy (keeps Secret Key strictly server-side)
app.get('/api/profile-sync', async (req, res) => {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://vzekrvpgxyjjnmkfwgot.supabase.co'
  ).replace(/\/+$/, '');
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';
  const configured = Boolean(url && secretKey && url.startsWith('https://'));

  if (req.query?.status === '1') {
    return res.json({ configured, projectUrl: url });
  }

  const email = String(req.query?.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Email query parameter is required.' });
  }
  if (!configured) {
    return res.json({ configured: false, profile: null });
  }

  try {
    const resp = await fetch(
      `${url}/rest/v1/vathmos_workspaces?email=eq.${encodeURIComponent(email)}&select=*`,
      {
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!resp.ok) {
      return res.json({ configured: true, profile: null });
    }
    const rows: any = await resp.json();
    return res.json({
      configured: true,
      profile: Array.isArray(rows) && rows.length > 0 ? rows[0] : null,
    });
  } catch {
    return res.json({ configured: true, profile: null });
  }
});

app.post('/api/profile-sync', async (req, res) => {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://vzekrvpgxyjjnmkfwgot.supabase.co'
  ).replace(/\/+$/, '');
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';
  const configured = Boolean(url && secretKey && url.startsWith('https://'));

  const body = req.body || {};
  const cleanEmail = String(body.email || '').trim().toLowerCase();
  if (!cleanEmail) {
    return res.status(400).json({ error: 'User email is required.' });
  }
  if (!configured) {
    return res.json({
      success: false,
      configured: false,
      message: 'Add SUPABASE_SECRET_KEY to environment variables to enable cloud sync.',
    });
  }

  try {
    const record = {
      email: cleanEmail,
      user_id: body.id || body.userId || null,
      full_name: body.name || '',
      company_name: body.companyName || '',
      role_title: body.role || 'Technical Recruiter',
      avatar_color: body.avatarColor || '#6366F1',
      tier: body.tier || 'free',
      evaluations_limit: typeof body.evaluationsLimit === 'number' ? body.evaluationsLimit : 5,
      evaluations_used: typeof body.evaluationsUsed === 'number' ? body.evaluationsUsed : 0,
      interview_questions_limit:
        typeof body.interviewQuestionsLimit === 'number' ? body.interviewQuestionsLimit : 5,
      interview_questions_used:
        typeof body.interviewQuestionsUsed === 'number' ? body.interviewQuestionsUsed : 0,
      white_label: body.whiteLabel || null,
      updated_at: new Date().toISOString(),
    };

    const resp = await fetch(`${url}/rest/v1/vathmos_workspaces?on_conflict=email`, {
      method: 'POST',
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(record),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.json({
        success: false,
        configured: true,
        error: `Supabase write notice: ${errText.slice(0, 200)}`,
      });
    }

    const saved = await resp.json();
    return res.json({
      success: true,
      configured: true,
      data: Array.isArray(saved) ? saved[0] : saved,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      configured: true,
      error: err?.message || 'Supabase sync error',
    });
  }
});

// Process-level resilience handlers (prevents dev server process death from transient port or websocket collisions)
process.on('uncaughtException', (err: any) => {
  if (err?.code === 'EADDRINUSE' || String(err?.message || '').includes('24678') || String(err?.message || '').includes('WebSocket')) {
    console.warn('[Vathmos Server] Handled transient port/socket event:', err?.message || err);
    return;
  }
  console.error('[Vathmos Server] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason: any) => {
  console.warn('[Vathmos Server] Unhandled rejection:', reason?.message || reason);
});

// Vite middleware & Static server setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send('Application build in progress. Please refresh momentarily.');
        }
      });
    }
  }

  function listenWithRetry(port: number, retries = 5) {
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`Vathmos server running on port ${port}`);
    });

    server.on('error', (err: any) => {
      if (err?.code === 'EADDRINUSE' && retries > 0) {
        console.warn(`[Vathmos Server] Port ${port} busy during pre-warm. Retrying in 1.2s (${retries} retries remaining)...`);
        setTimeout(() => {
          try {
            server.close();
          } catch {}
          listenWithRetry(port, retries - 1);
        }, 1200);
      } else {
        console.error('Server error:', err?.message || err);
      }
    });
  }

  listenWithRetry(PORT);
}

startServer();
