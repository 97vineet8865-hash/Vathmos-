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

function getSessionSecret(supabaseSecret: string): string {
  return (
    process.env.SESSION_SECRET ||
    supabaseSecret ||
    'vathmos_secure_session_secret_2026_prod'
  );
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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url, secretKey } = getSupabaseConfig();
  if (!url || !secretKey) {
    return res.status(500).json({ error: 'Supabase secret key is not configured.' });
  }

  const secret = getSessionSecret(secretKey);
  const authHeader = String(req.headers?.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'Authentication required to upgrade plan.' });
  }

  const session = verifySessionToken(token, secret);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }

  const { tier, paymentId } = req.body || {};
  const cleanTier = String(tier || '').trim().toLowerCase();
  if (!['starter', 'pro', 'agency'].includes(cleanTier)) {
    return res.status(400).json({ error: 'Invalid subscription tier selected.' });
  }

  const targetLimits = TIER_LIMITS[cleanTier];
  const cleanEmail = String(session.email || '').trim().toLowerCase();
  const cleanPaymentId = paymentId ? String(paymentId).trim().slice(0, 120) : undefined;
  const nowIso = new Date().toISOString();

  try {
    // 1. Fetch existing Supabase Auth user to preserve existing metadata
    let existingAuthUser: any = null;
    if (session.userId) {
      const userResp = await fetch(
        `${url}/auth/v1/admin/users/${encodeURIComponent(session.userId)}`,
        {
          headers: {
            apikey: secretKey,
            Authorization: `Bearer ${secretKey}`,
          },
        }
      );
      if (userResp.ok) {
        existingAuthUser = await userResp.json().catch(() => null);
      }
    }

    const existingMeta = existingAuthUser?.user_metadata || {};
    const updatedMeta: Record<string, any> = {
      ...existingMeta,
      tier: cleanTier,
      evaluationsLimit: targetLimits.evaluations,
      evaluationsUsed: 0,
      interviewQuestionsLimit: targetLimits.interviewQuestions,
      interviewQuestionsUsed: 0,
      hasSeenOnboardingPlans: true,
    };
    if (cleanPaymentId) {
      updatedMeta.razorpayPaymentId = cleanPaymentId;
    }

    if (existingAuthUser?.id) {
      await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(existingAuthUser.id)}`, {
        method: 'PUT',
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_metadata: updatedMeta }),
      });
    }

    // 2. Patch valid columns on public.vathmos_workspaces (no razorpay_payment_id column in schema)
    const patchPayload = {
      tier: cleanTier,
      evaluations_limit: targetLimits.evaluations,
      evaluations_used: 0,
      interview_questions_limit: targetLimits.interviewQuestions,
      interview_questions_used: 0,
      updated_at: nowIso,
    };

    const patchResp = await fetch(
      `${url}/rest/v1/vathmos_workspaces?email=eq.${encodeURIComponent(cleanEmail)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(patchPayload),
      }
    );

    let savedRows: any = await patchResp.json().catch(() => []);
    if (!patchResp.ok || !Array.isArray(savedRows) || savedRows.length === 0) {
      const insertResp = await fetch(`${url}/rest/v1/vathmos_workspaces?on_conflict=email`, {
        method: 'POST',
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify({
          email: cleanEmail,
          user_id: existingAuthUser?.id || session.userId,
          full_name: existingMeta.name || 'Recruiter',
          company_name: existingMeta.companyName || 'Organization',
          role_title: session.role || existingMeta.role || 'Senior Recruiter',
          avatar_color: existingMeta.avatarColor || '#0EA5E9',
          ...patchPayload,
        }),
      });
      savedRows = await insertResp.json().catch(() => []);
    }

    const row = Array.isArray(savedRows) ? savedRows[0] : savedRows;
    const isFounderAdmin = ADMIN_EMAILS.includes(cleanEmail);
    const resolvedRole = row?.role_title || existingMeta.role || session.role || 'Senior Recruiter';

    const refreshedToken = signSessionToken(
      {
        userId: existingAuthUser?.id || row?.user_id || session.userId,
        email: cleanEmail,
        role: isFounderAdmin ? 'Platform Administrator' : resolvedRole,
        tier: cleanTier,
      },
      secret
    );

    const safeUser = {
      id: existingAuthUser?.id || row?.user_id || session.userId,
      name: row?.full_name || existingMeta.name || 'Recruiter',
      email: cleanEmail,
      companyName: row?.company_name || existingMeta.companyName || 'Organization',
      role: resolvedRole,
      avatarColor: row?.avatar_color || existingMeta.avatarColor || '#0EA5E9',
      isEmailVerified: Boolean(existingMeta.isEmailVerified ?? true),
      tier: cleanTier,
      evaluationsLimit: row?.evaluations_limit ?? targetLimits.evaluations,
      evaluationsUsed: row?.evaluations_used ?? 0,
      interviewQuestionsLimit:
        row?.interview_questions_limit ?? targetLimits.interviewQuestions,
      interviewQuestionsUsed: row?.interview_questions_used ?? 0,
      whiteLabel: row?.white_label || existingMeta.whiteLabel || undefined,
      razorpayPaymentId: cleanPaymentId || existingMeta.razorpayPaymentId || undefined,
      hasSeenOnboardingPlans: true,
      createdAt: existingAuthUser?.created_at || row?.created_at || nowIso,
    };

    return res.status(200).json({
      success: true,
      token: refreshedToken,
      user: safeUser,
      message: `Successfully upgraded to ${cleanTier.toUpperCase()} tier!`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Subscription upgrade failed.' });
  }
}
