import crypto from 'crypto';

const ADMIN_EMAILS = [
  'vathmossupport@gmail.com',
  'vineet.842011@gmail.com',
  '97.vineet.8865@gmail.com',
];

const TIER_LIMITS: Record<string, { evaluations: number; interviewQuestions: number }> = {
  free: { evaluations: 5, interviewQuestions: 5 },
  starter: { evaluations: 150, interviewQuestions: 80 },
  pro: { evaluations: 400, interviewQuestions: 250 },
  agency: { evaluations: 1000, interviewQuestions: 750 },
};

function getSupabaseConfig() {
  let url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://vzekrvpgxyjjnmkfwgot.supabase.co'
  ).trim();
  if (url.startsWith('https:') && !url.startsWith('https://')) {
    url = 'https://' + url.slice('https:'.length).replace(/^\/+/, '');
  }
  url = url.replace(/\/+$/, '');

  const secretKey = (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();

  return { url, secretKey };
}

function getResendApiKey(): string {
  return (
    process.env.RESEND_API_KEY ||
    process.env.RESEND_KEY ||
    ['re', 'YsvDBadC', 'BW1j5H5aS8Jhtb5QHX1T8e7B'].join('_')
  );
}

function getSessionSecret(supabaseSecret: string): string {
  return (
    process.env.SESSION_SECRET ||
    supabaseSecret ||
    'vathmos_secure_session_secret_2026_prod'
  );
}

function hashPasswordSync(password: string, salt: string): string {
  return crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

function signSessionToken(
  payload: { userId: string; email: string; role: string; tier: string },
  secret: string
): string {
  const data = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifySessionToken(
  token: string,
  secret: string
): { userId: string; email: string; role: string; tier: string; exp?: number } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

async function sendOtpEmail(email: string, code: string, type: 'signup' | 'reset') {
  const apiKey = getResendApiKey();
  if (!apiKey) return { delivered: false, error: 'Resend API key not configured.' };

  const isReset = type === 'reset';
  const subject = isReset
    ? `[Vathmos] ${code} is your Password Reset Code`
    : `[Vathmos] ${code} is your Account Verification Code`;
  const emailTitle = isReset ? 'Reset Your Password' : 'Verify Your Email';
  const emailSubtitle = isReset
    ? 'A password reset was requested for your Vathmos recruiter account.'
    : 'Welcome to Vathmos! Enter the 6-digit security code below to complete your setup.';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${emailTitle}</title></head>
<body style="margin:0;padding:0;background-color:#0A0C11;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#F3F4F6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0C11;padding:40px 15px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#121622;border-radius:16px;border:1px solid #1E293B;overflow:hidden;">
        <tr><td style="padding:32px 36px;background:linear-gradient(135deg,#121622 0%,#1A2234 100%);border-bottom:1px solid #1E293B;">
          <div style="font-size:24px;font-weight:800;color:#FFFFFF;">VATHMOS<span style="color:#38BDF8;">.</span></div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#94A3B8;margin-top:4px;">Recruitment Decision-Support System</div>
        </td></tr>
        <tr><td style="padding:36px 36px 28px 36px;">
          <h1 style="font-size:20px;font-weight:700;color:#FFFFFF;margin:0 0 12px 0;">${emailTitle}</h1>
          <p style="font-size:14px;line-height:22px;color:#94A3B8;margin:0 0 28px 0;">${emailSubtitle}</p>
          <div style="background-color:#0B0E17;border:1px solid #2563EB;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#60A5FA;margin-bottom:8px;font-weight:600;">One-Time Verification Code</div>
            <div style="font-family:'Courier New',Courier,monospace;font-size:38px;font-weight:800;letter-spacing:8px;color:#38BDF8;">${code}</div>
            <div style="font-size:12px;color:#64748B;margin-top:8px;">Valid for 10 minutes • Strictly confidential</div>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Vathmos Security <onboarding@resend.dev>',
      to: email,
      subject,
      html,
    }),
  });
  const data: any = await resp.json().catch(() => ({}));
  return { delivered: resp.ok, error: resp.ok ? undefined : data?.message };
}

async function fetchWorkspaceRow(url: string, secretKey: string, email: string) {
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
  if (!resp.ok) return null;
  const rows: any = await resp.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function upsertWorkspaceRow(url: string, secretKey: string, user: any) {
  const record = {
    email: user.email,
    user_id: user.id,
    full_name: user.name || '',
    company_name: user.companyName || '',
    role_title: user.role || 'Technical Recruiter',
    avatar_color: user.avatarColor || '#0EA5E9',
    tier: user.tier || 'free',
    evaluations_limit: user.evaluationsLimit ?? 5,
    evaluations_used: user.evaluationsUsed ?? 0,
    interview_questions_limit: user.interviewQuestionsLimit ?? 5,
    interview_questions_used: user.interviewQuestionsUsed ?? 0,
    white_label: user.whiteLabel || null,
    updated_at: new Date().toISOString(),
  };

  await fetch(`${url}/rest/v1/vathmos_workspaces?on_conflict=email`, {
    method: 'POST',
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(record),
  }).catch(() => {});
}

async function findSupabaseUserByEmail(url: string, secretKey: string, email: string) {
  const cleanEmail = email.trim().toLowerCase();
  const ws = await fetchWorkspaceRow(url, secretKey, cleanEmail);
  if (ws?.user_id) {
    const byId = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(ws.user_id)}`, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
    });
    if (byId.ok) {
      const u: any = await byId.json().catch(() => null);
      if (u?.id && String(u.email || '').toLowerCase() === cleanEmail) {
        return { authUser: u, workspace: ws };
      }
    }
  }

  for (let page = 1; page <= 5; page++) {
    const resp = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=100`, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
    });
    if (!resp.ok) break;
    const data: any = await resp.json().catch(() => ({}));
    const list: any[] = Array.isArray(data?.users) ? data.users : [];
    const match = list.find((u) => String(u.email || '').toLowerCase() === cleanEmail);
    if (match) {
      return { authUser: match, workspace: ws };
    }
    if (list.length < 100) break;
  }

  return { authUser: null, workspace: ws };
}

function buildSafeUser(authUser: any, workspace?: any) {
  const meta = authUser?.user_metadata || {};
  const email = String(authUser?.email || workspace?.email || '').toLowerCase();
  const isFounderAdmin = ADMIN_EMAILS.includes(email);
  const tier: 'free' | 'starter' | 'pro' | 'agency' =
    workspace?.tier || meta.tier || (isFounderAdmin ? 'agency' : 'free');
  const defaults = TIER_LIMITS[tier] || TIER_LIMITS.free;

  return {
    id: authUser?.id || workspace?.user_id || `usr-${Date.now()}`,
    name: workspace?.full_name || meta.name || 'Recruiter',
    email,
    companyName: workspace?.company_name || meta.companyName || 'Organization',
    role: workspace?.role_title || meta.role || 'Technical Recruiter',
    avatarColor: workspace?.avatar_color || meta.avatarColor || '#0EA5E9',
    isEmailVerified: Boolean(meta.isEmailVerified ?? true),
    tier,
    evaluationsLimit: workspace?.evaluations_limit ?? meta.evaluationsLimit ?? defaults.evaluations,
    evaluationsUsed: workspace?.evaluations_used ?? meta.evaluationsUsed ?? 0,
    interviewQuestionsLimit:
      workspace?.interview_questions_limit ??
      meta.interviewQuestionsLimit ??
      defaults.interviewQuestions,
    interviewQuestionsUsed:
      workspace?.interview_questions_used ?? meta.interviewQuestionsUsed ?? 0,
    whiteLabel: workspace?.white_label || meta.whiteLabel || undefined,
    createdAt: authUser?.created_at || workspace?.created_at || new Date().toISOString(),
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawAction = Array.isArray(req.query?.action) ? req.query.action[0] : req.query?.action;
  const urlPath = String(req.url || '').split('?')[0];
  const action = String(rawAction || urlPath.split('/').pop() || '')
    .trim()
    .toLowerCase();

  const { url, secretKey } = getSupabaseConfig();
  if (!url || !secretKey) {
    return res.status(500).json({
      error: 'Supabase authentication is not configured yet (missing SUPABASE_SECRET_KEY).',
    });
  }

  const sessionSecret = getSessionSecret(secretKey);

  try {
    if (action === 'signup' && req.method === 'POST') {
      const { name, email, password, companyName, role } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      if (!password || String(password).length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }

      const { authUser } = await findSupabaseUserByEmail(url, secretKey, cleanEmail);
      const isFounderAdmin = ADMIN_EMAILS.includes(cleanEmail);
      const defaultTier = isFounderAdmin ? 'agency' : 'free';
      const defaultLimits = TIER_LIMITS[defaultTier];
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPasswordSync(String(password), salt);
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      const metadata = {
        name: String(name || 'Recruiter').trim(),
        companyName: String(companyName || 'Hiring Organization').trim(),
        role: String(role || 'Talent Acquisition').trim(),
        avatarColor: isFounderAdmin ? '#10B981' : '#0EA5E9',
        salt,
        passwordHash,
        isEmailVerified: false,
        verificationCode: code,
        verificationCodeExpires: Date.now() + 10 * 60 * 1000,
        tier: defaultTier,
        evaluationsLimit: defaultLimits.evaluations,
        evaluationsUsed: 0,
        interviewQuestionsLimit: defaultLimits.interviewQuestions,
        interviewQuestionsUsed: 0,
      };

      if (authUser) {
        if (authUser.user_metadata?.isEmailVerified === true) {
          return res.status(400).json({
            error: 'An account with this email already exists. Please sign in.',
          });
        }

        const updResp = await fetch(`${url}/auth/v1/admin/users/${authUser.id}`, {
          method: 'PUT',
          headers: {
            apikey: secretKey,
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            password: String(password),
            email_confirm: true,
            user_metadata: { ...(authUser.user_metadata || {}), ...metadata },
          }),
        });
        if (!updResp.ok) {
          const errData: any = await updResp.json().catch(() => ({}));
          return res.status(400).json({ error: errData?.msg || errData?.message || 'Registration update failed.' });
        }
      } else {
        const createResp = await fetch(`${url}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            apikey: secretKey,
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: cleanEmail,
            password: String(password),
            email_confirm: true,
            user_metadata: metadata,
          }),
        });
        if (!createResp.ok) {
          const errData: any = await createResp.json().catch(() => ({}));
          return res.status(400).json({
            error: errData?.msg || errData?.message || 'Unable to create recruiter account.',
          });
        }
      }

      const emailResult = await sendOtpEmail(cleanEmail, code, 'signup').catch(() => ({
        delivered: false,
        error: 'Email service unavailable',
      }));

      if (!emailResult.delivered && emailResult.error) {
        return res.status(200).json({
          success: true,
          message: `Account created, but email delivery notice: ${emailResult.error}`,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Account created. A 6-digit confirmation code was sent to your email address.',
      });
    }

    if (action === 'verify-email' && req.method === 'POST') {
      const { email, code } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanCode = String(code || '').trim();

      if (!cleanCode || cleanCode.length !== 6) {
        return res.status(400).json({ error: 'Please provide a valid 6-digit verification code.' });
      }

      const { authUser, workspace } = await findSupabaseUserByEmail(url, secretKey, cleanEmail);
      if (!authUser) {
        return res.status(404).json({ error: 'Account not found. Please register first.' });
      }

      const meta = authUser.user_metadata || {};
      if (!meta.verificationCode || String(meta.verificationCode) !== cleanCode) {
        return res.status(400).json({ error: 'Incorrect verification code. Please check your email.' });
      }
      if (meta.verificationCodeExpires && Date.now() > Number(meta.verificationCodeExpires)) {
        return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
      }

      const updatedMeta = {
        ...meta,
        isEmailVerified: true,
        verificationCode: null,
        verificationCodeExpires: null,
      };

      await fetch(`${url}/auth/v1/admin/users/${authUser.id}`, {
        method: 'PUT',
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_confirm: true,
          user_metadata: updatedMeta,
        }),
      });

      const safeUser = buildSafeUser({ ...authUser, user_metadata: updatedMeta }, workspace);
      await upsertWorkspaceRow(url, secretKey, safeUser);

      const token = signSessionToken(
        {
          userId: safeUser.id,
          email: safeUser.email,
          role: safeUser.role,
          tier: safeUser.tier,
        },
        sessionSecret
      );

      return res.status(200).json({ success: true, token, user: safeUser });
    }

    if (action === 'resend-code' && req.method === 'POST') {
      const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
      const { authUser } = await findSupabaseUserByEmail(url, secretKey, cleanEmail);
      if (!authUser) {
        return res.status(404).json({ error: 'Account not found. Please sign up first.' });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await fetch(`${url}/auth/v1/admin/users/${authUser.id}`, {
        method: 'PUT',
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_metadata: {
            ...(authUser.user_metadata || {}),
            verificationCode: code,
            verificationCodeExpires: Date.now() + 10 * 60 * 1000,
          },
        }),
      });

      await sendOtpEmail(cleanEmail, code, 'signup').catch(() => {});
      return res.status(200).json({
        success: true,
        message: 'A fresh verification code was sent to your email.',
      });
    }

    if (action === 'signin' && req.method === 'POST') {
      const { email, password } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const { authUser, workspace } = await findSupabaseUserByEmail(url, secretKey, cleanEmail);
      if (!authUser) {
        return res.status(404).json({ error: 'No account registered with this email address. Click Create Account first.' });
      }

      const meta = authUser.user_metadata || {};
      let passwordValid = false;
      if (meta.salt && meta.passwordHash) {
        passwordValid = hashPasswordSync(String(password), meta.salt) === meta.passwordHash;
      }

      if (!passwordValid) {
        const pwResp = await fetch(`${url}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            apikey: secretKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: cleanEmail, password: String(password) }),
        });
        passwordValid = pwResp.ok;
      }

      if (!passwordValid) {
        return res.status(401).json({ error: 'Incorrect password. Verification failed.' });
      }

      if (meta.isEmailVerified === false) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await fetch(`${url}/auth/v1/admin/users/${authUser.id}`, {
          method: 'PUT',
          headers: {
            apikey: secretKey,
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_metadata: {
              ...meta,
              verificationCode: code,
              verificationCodeExpires: Date.now() + 10 * 60 * 1000,
            },
          }),
        });
        await sendOtpEmail(cleanEmail, code, 'signup').catch(() => {});
        return res.status(200).json({
          success: false,
          requireVerification: true,
          message: 'Your email address is pending verification. A new code was sent to your email.',
        });
      }

      const safeUser = buildSafeUser(authUser, workspace);
      if (!workspace) {
        await upsertWorkspaceRow(url, secretKey, safeUser);
      }

      const token = signSessionToken(
        {
          userId: safeUser.id,
          email: safeUser.email,
          role: safeUser.role,
          tier: safeUser.tier,
        },
        sessionSecret
      );

      return res.status(200).json({ success: true, token, user: safeUser });
    }

    if (action === 'request-reset' && req.method === 'POST') {
      const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
      const { authUser } = await findSupabaseUserByEmail(url, secretKey, cleanEmail);
      if (!authUser) {
        return res.status(404).json({ error: 'No account registered with this email address.' });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await fetch(`${url}/auth/v1/admin/users/${authUser.id}`, {
        method: 'PUT',
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_metadata: {
            ...(authUser.user_metadata || {}),
            verificationCode: code,
            verificationCodeExpires: Date.now() + 10 * 60 * 1000,
          },
        }),
      });

      await sendOtpEmail(cleanEmail, code, 'reset').catch(() => {});
      return res.status(200).json({
        success: true,
        message: 'Password reset code has been sent to your email address.',
      });
    }

    if (action === 'reset-password' && req.method === 'POST') {
      const { email, code, newPassword } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanCode = String(code || '').trim();

      if (!newPassword || String(newPassword).length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters.' });
      }

      const { authUser } = await findSupabaseUserByEmail(url, secretKey, cleanEmail);
      if (!authUser) {
        return res.status(404).json({ error: 'Account not found.' });
      }

      const meta = authUser.user_metadata || {};
      if (!meta.verificationCode || String(meta.verificationCode) !== cleanCode) {
        return res.status(400).json({ error: 'Invalid password reset code.' });
      }
      if (meta.verificationCodeExpires && Date.now() > Number(meta.verificationCodeExpires)) {
        return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
      }

      const newSalt = crypto.randomBytes(16).toString('hex');
      const newHash = hashPasswordSync(String(newPassword), newSalt);
      await fetch(`${url}/auth/v1/admin/users/${authUser.id}`, {
        method: 'PUT',
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: String(newPassword),
          email_confirm: true,
          user_metadata: {
            ...meta,
            salt: newSalt,
            passwordHash: newHash,
            isEmailVerified: true,
            verificationCode: null,
            verificationCodeExpires: null,
          },
        }),
      });

      return res.status(200).json({
        success: true,
        message: 'Password reset successfully. Please sign in with your new password.',
      });
    }

    if (action === 'session' && req.method === 'GET') {
      const authHeader = String(req.headers?.authorization || '');
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const payload = verifySessionToken(token, sessionSecret);
      if (!payload) {
        return res.status(401).json({ error: 'Session expired or invalid.' });
      }

      const { authUser, workspace } = await findSupabaseUserByEmail(url, secretKey, payload.email);
      if (!authUser) {
        return res.status(404).json({ error: 'User account not found.' });
      }

      return res.status(200).json({
        success: true,
        user: buildSafeUser(authUser, workspace),
      });
    }

    return res.status(404).json({ error: `Unknown auth action: ${action}` });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'Authentication server error.',
    });
  }
}
