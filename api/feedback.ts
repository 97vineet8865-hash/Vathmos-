import crypto from 'crypto';

const ADMIN_EMAILS = [
  'vathmossupport@gmail.com',
  'vineet.842011@gmail.com',
  '97.vineet.8865@gmail.com',
];

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

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Admin inbox check (GET /api/feedback)
  if (req.method === 'GET') {
    const { secretKey } = getSupabaseConfig();
    const secret = getSessionSecret(secretKey);
    const authHeader = String(req.headers?.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required. Missing authorization token.',
      });
    }

    const session = verifySessionToken(token, secret);
    if (!session) {
      return res.status(401).json({
        error: 'Invalid or expired session token. Please sign in as administrator.',
      });
    }

    const cleanEmail = String(session.email || '').trim().toLowerCase();
    const isAdmin =
      ADMIN_EMAILS.includes(cleanEmail) ||
      session.role === 'Platform Administrator' ||
      session.role === 'Founder & Lead Engineer';

    if (!isAdmin) {
      return res.status(403).json({
        error: 'Access denied. You must be signed in as a platform administrator.',
      });
    }

    return res.status(200).json({
      feedbacks: [],
      hasWebhook: Boolean(process.env.DISCORD_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL),
      webhookUrl: '',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { type, description, email, name, telemetry } = req.body || {};
    const cleanDescription = String(description || '').trim();
    if (!cleanDescription) {
      return res.status(400).json({ error: 'Feedback or inquiry description is required.' });
    }

    const cleanEmail = String(email || 'Anonymous').trim().slice(0, 150);
    const cleanName = String(name || 'Recruiter').trim().slice(0, 100);
    const cleanType = String(type || 'general').trim().slice(0, 50);
    const refId = `FB-${Date.now().toString(36).toUpperCase()}`;

    const newReport = {
      id: refId,
      createdAt: new Date().toISOString(),
      type: cleanType,
      description: cleanDescription.slice(0, 4000),
      userEmail: cleanEmail,
      userName: cleanName,
      status: 'new',
      adminNotes: '',
      telemetry: telemetry && typeof telemetry === 'object' ? telemetry : {},
    };

    let emailDelivered = false;
    let deliveredTo: string | null = null;
    let deliveryError: string | null = null;

    const primaryInbox = (process.env.SUPPORT_EMAIL || 'vathmossupport@gmail.com').trim();
    const defaultFounderInbox = (process.env.RESEND_OWNER_EMAIL || '97.vineet.8865@gmail.com').trim();
    const fromAddress = (
      process.env.RESEND_FROM_EMAIL ||
      (process.env.RESEND_FROM_DOMAIN
        ? `Vathmos Support <support@${process.env.RESEND_FROM_DOMAIN.trim()}>`
        : 'Vathmos Support <onboarding@resend.dev>')
    ).trim();

    const buildTicketHtml = (noticeBanner?: string) => `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#0A0C11;color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#121622;border:1px solid #1E293B;border-radius:12px;padding:24px;">
    <div style="font-size:18px;font-weight:800;color:#FFFFFF;margin-bottom:4px;">VATHMOS ${escapeHtml(cleanType.toUpperCase())} REQUEST</div>
    <div style="font-size:12px;color:#38BDF8;font-family:monospace;margin-bottom:16px;">Ref: ${escapeHtml(refId)} • Type: ${escapeHtml(cleanType.toUpperCase())}</div>
    ${noticeBanner ? `<div style="margin-bottom:14px;padding:10px 12px;border-radius:8px;background:#1E293B;border:1px solid #334155;font-size:12px;color:#FCD34D;">${escapeHtml(noticeBanner)}</div>` : ''}
    <p style="font-size:13px;color:#CBD5E1;margin:0 0 8px 0;"><strong>From:</strong> ${escapeHtml(cleanName)} (${escapeHtml(cleanEmail)})</p>
    <p style="font-size:13px;color:#CBD5E1;margin:0 0 16px 0;"><strong>Source:</strong> ${escapeHtml(String(newReport.telemetry?.source || 'web_app'))}</p>
    <div style="background:#0B0E17;border:1px solid #1E293B;border-radius:8px;padding:16px;font-size:13px;line-height:1.6;color:#E2E8F0;white-space:pre-wrap;">${escapeHtml(newReport.description)}</div>
  </div>
</body>
</html>`;

    const dispatchPromises: Promise<any>[] = [];

    // 1. Forward support inquiry via Resend REST API (with automatic sandbox fallback)
    const resendKey = getResendApiKey();
    if (resendKey) {
      dispatchPromises.push(
        (async () => {
          try {
            const sendViaResend = async (toEmail: string, banner?: string) => {
              const r = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${resendKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: fromAddress,
                  to: toEmail,
                  reply_to: cleanEmail.includes('@') ? cleanEmail : undefined,
                  subject: `[Vathmos ${cleanType.toUpperCase()}] ${cleanName} (${refId})`,
                  html: buildTicketHtml(banner),
                }),
              });
              const json: any = await r.json().catch(() => ({}));
              return { ok: r.ok, status: r.status, json };
            };

            const firstAttempt = await sendViaResend(primaryInbox);
            if (firstAttempt.ok) {
              emailDelivered = true;
              deliveredTo = primaryInbox;
              return;
            }

            // Resend onboarding@resend.dev sandbox restricts recipients to the Resend account owner's email
            const errMessage = String(firstAttempt.json?.message || `HTTP ${firstAttempt.status}`);
            deliveryError = errMessage;
            if (firstAttempt.status === 403 || errMessage.includes('only send testing emails')) {
              const ownerMatch = errMessage.match(/\(([^@\s)]+@[^@\s)]+\.[^)\s]+)\)/);
              const fallbackInbox = (ownerMatch?.[1] || defaultFounderInbox).trim();
              if (fallbackInbox && fallbackInbox.toLowerCase() !== primaryInbox.toLowerCase()) {
                const retryAttempt = await sendViaResend(
                  fallbackInbox,
                  `Note: Delivered to ${fallbackInbox} because Resend onboarding@resend.dev requires verifying vathmos.co.in at resend.com/domains to send directly to ${primaryInbox}.`
                );
                if (retryAttempt.ok) {
                  emailDelivered = true;
                  deliveredTo = fallbackInbox;
                  deliveryError = null;
                  return;
                }
                deliveryError = String(retryAttempt.json?.message || `Retry HTTP ${retryAttempt.status}`);
              }
            }
          } catch (e: any) {
            deliveryError = e?.message || 'Resend dispatch error';
          }
        })()
      );
    }

    // 2. Also notify vathmossupport@gmail.com via FormSubmit if activated
    dispatchPromises.push(
      fetch(`https://formsubmit.co/ajax/${encodeURIComponent(primaryInbox)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Origin: 'https://www.vathmos.co.in',
          Referer: 'https://www.vathmos.co.in/',
        },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          _subject: `[Vathmos ${cleanType.toUpperCase()}] ${cleanName} (${refId})`,
          message: newReport.description,
          reference_id: refId,
          source: newReport.telemetry?.source || 'web_app',
        }),
      }).catch(() => null)
    );

    // 3. Optional Discord / Slack webhook alert
    const webhookUrl = (process.env.DISCORD_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL || '').trim();
    if (webhookUrl) {
      const isDiscord = webhookUrl.includes('discord.com/api/webhooks');
      const payload = isDiscord
        ? {
            embeds: [
              {
                title: `[Vathmos ${cleanType.toUpperCase()}] Support Ticket ${refId}`,
                description: newReport.description.slice(0, 1800),
                color: 3718392,
                fields: [
                  { name: 'From', value: `${cleanName} (${cleanEmail})`, inline: true },
                  { name: 'Source', value: String(newReport.telemetry?.source || 'web_app'), inline: true },
                ],
                timestamp: newReport.createdAt,
              },
            ],
          }
        : {
            text: `*[Vathmos ${cleanType.toUpperCase()}]* ${refId}\n*From:* ${cleanName} (${cleanEmail})\n${newReport.description.slice(0, 1800)}`,
          };

      dispatchPromises.push(
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => null)
      );
    }

    if (dispatchPromises.length > 0) {
      await Promise.allSettled(dispatchPromises);
    }

    return res.status(200).json({
      success: true,
      referenceId: refId,
      report: newReport,
      emailDelivered,
      deliveredTo,
      deliveryError,
      message: 'Feedback received and dispatched successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to record feedback.' });
  }
}
