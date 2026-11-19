import crypto from 'crypto';

const ADMIN_EMAILS = [
  'vathmossupport@gmail.com',
  'vineet.842011@gmail.com',
  '97.vineet.8865@gmail.com',
];

const ALLOWED_EVENTS = new Set([
  'page_view',
  'signup_completed',
  'login_completed',
  'evaluation_run',
  'interview_guide_generated',
  'upgrade_clicked',
]);

function isBotUserAgent(uaRaw: unknown): boolean {
  const ua = String(uaRaw || '').trim();
  if (!ua || ua.length < 12) return true;
  return /bot|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|preview|scanner|wget|curl|python|node-fetch|undici|vercel|phantom|puppeteer|playwright|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|ahrefs|semrush|mj12bot|yandex|bingpreview|googlebot|applebot/i.test(
    ua
  );
}

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

function sanitizeMeta(raw: any): Record<string, string | number | boolean> {
  if (!raw || typeof raw !== 'object') return {};
  const clean: Record<string, string | number | boolean> = {};
  const allowedKeys = ['count', 'mode', 'tier', 'method', 'source'];
  for (const k of allowedKeys) {
    const v = raw[k];
    if (typeof v === 'number' || typeof v === 'boolean') {
      clean[k] = v;
    } else if (typeof v === 'string') {
      clean[k] = v.slice(0, 64);
    }
  }
  return clean;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, secretKey } = getSupabaseConfig();

  // 1. Privacy-safe event ingestion (Zero-PII + Bot/Crawler filter)
  if (req.method === 'POST') {
    try {
      const userAgent = req.headers?.['user-agent'];
      if (isBotUserAgent(userAgent)) {
        return res.status(200).json({ success: true, ignored: 'bot' });
      }

      const body = req.body || {};
      const eventName = String(body.eventName || '').trim();
      if (!ALLOWED_EVENTS.has(eventName)) {
        return res.status(400).json({ error: 'Unsupported analytics event.' });
      }

      const cleanPath = String(body.path || '/').slice(0, 120);
      const cleanReferrer = String(body.referrerHost || 'direct')
        .toLowerCase()
        .replace(/[^a-z0-9.:-]/g, '')
        .slice(0, 100) || 'direct';
      const cleanSessionId = String(body.sessionId || '')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 64);
      const cleanTier = String(body.userTier || 'guest').slice(0, 24);
      const cleanMeta = sanitizeMeta(body.meta);

      if (secretKey && url.startsWith('https://')) {
        await fetch(`${url}/rest/v1/vathmos_analytics_events`, {
          method: 'POST',
          headers: {
            apikey: secretKey,
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            event_name: eventName,
            path: cleanPath,
            referrer_host: cleanReferrer,
            session_id: cleanSessionId || null,
            user_tier: cleanTier,
            meta: cleanMeta,
          }),
        }).catch(() => null);
      }

      return res.status(200).json({ success: true });
    } catch {
      return res.status(200).json({ success: true });
    }
  }

  // 2. Admin-only founder analytics summary (separates External Users vs Founder accounts)
  if (req.method === 'GET') {
    const secret = getSessionSecret(secretKey);
    const authHeader = String(req.headers?.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Missing authorization token.' });
    }

    const session = verifySessionToken(token, secret);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session token. Please sign in again.' });
    }

    const cleanEmail = String(session.email || '').trim().toLowerCase();
    const isAdmin =
      ADMIN_EMAILS.includes(cleanEmail) ||
      session.role === 'Platform Administrator' ||
      session.role === 'Founder & Lead Engineer';

    if (!isAdmin) {
      return res.status(403).json({ error: 'Access denied. Administrator credentials required.' });
    }

    const tierBreakdown: Record<string, number> = { free: 0, starter: 0, pro: 0, agency: 0 };
    const externalTierBreakdown: Record<string, number> = { free: 0, starter: 0, pro: 0, agency: 0 };
    let totalUsers = 0;
    let totalEvaluationsRun = 0;
    let totalGuidesGenerated = 0;
    let externalUsers = 0;
    let externalEvaluationsRun = 0;
    let externalGuidesGenerated = 0;

    type SignupSummary = {
      name: string;
      email: string;
      tier: string;
      evaluationsUsed: number;
      evaluationsLimit: number;
      interviewQuestionsUsed: number;
      createdAt: string;
      isAdmin: boolean;
    };

    let recentSignups: SignupSummary[] = [];
    let externalRecentSignups: SignupSummary[] = [];

    let analyticsTableReady = true;
    let pageViewsToday = 0;
    let pageViews7d = 0;
    let uniqueVisitors7d = 0;
    const funnel7d = {
      signups: 0,
      logins: 0,
      evaluations: 0,
      guides: 0,
      upgradeClicks: 0,
    };
    let topReferrers: Array<{ host: string; count: number }> = [];

    if (secretKey && url.startsWith('https://')) {
      try {
        const wsResp = await fetch(
          `${url}/rest/v1/vathmos_workspaces?select=email,full_name,tier,evaluations_used,evaluations_limit,interview_questions_used,created_at&order=created_at.desc&limit=500`,
          {
            headers: {
              apikey: secretKey,
              Authorization: `Bearer ${secretKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (wsResp.ok) {
          const rows: any[] = await wsResp.json();
          if (Array.isArray(rows)) {
            totalUsers = rows.length;
            const mapped: SignupSummary[] = rows.map((r) => {
              const rowEmail = String(r.email || '').trim().toLowerCase();
              const isRowAdmin = ADMIN_EMAILS.includes(rowEmail);
              const t = String(r.tier || 'free').toLowerCase();
              const evalsUsed = Number(r.evaluations_used || 0);
              const guidesUsed = Number(r.interview_questions_used || 0);

              tierBreakdown[t] = (tierBreakdown[t] || 0) + 1;
              totalEvaluationsRun += evalsUsed;
              totalGuidesGenerated += guidesUsed;

              if (!isRowAdmin) {
                externalUsers++;
                externalTierBreakdown[t] = (externalTierBreakdown[t] || 0) + 1;
                externalEvaluationsRun += evalsUsed;
                externalGuidesGenerated += guidesUsed;
              }

              return {
                name: String(r.full_name || 'Recruiter'),
                email: String(r.email || ''),
                tier: String(r.tier || 'free'),
                evaluationsUsed: evalsUsed,
                evaluationsLimit: Number(r.evaluations_limit || 5),
                interviewQuestionsUsed: guidesUsed,
                createdAt: String(r.created_at || ''),
                isAdmin: isRowAdmin,
              };
            });

            recentSignups = mapped.slice(0, 20);
            externalRecentSignups = mapped.filter((u) => !u.isAdmin).slice(0, 25);
          }
        }
      } catch {
        // Keep safe defaults
      }

      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const todayStartMs = new Date().setUTCHours(0, 0, 0, 0);

        const evResp = await fetch(
          `${url}/rest/v1/vathmos_analytics_events?select=event_name,referrer_host,session_id,created_at&created_at=gte.${encodeURIComponent(sevenDaysAgo)}&order=created_at.desc&limit=2000`,
          {
            headers: {
              apikey: secretKey,
              Authorization: `Bearer ${secretKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!evResp.ok) {
          if (evResp.status === 404 || evResp.status === 400) {
            analyticsTableReady = false;
          }
        } else {
          const events: any[] = await evResp.json();
          if (Array.isArray(events)) {
            const uniqueSessions = new Set<string>();
            const refCounts = new Map<string, number>();

            for (const ev of events) {
              const evName = String(ev.event_name || '');
              const createdMs = Date.parse(ev.created_at || '');
              if (ev.session_id) uniqueSessions.add(String(ev.session_id));

              if (evName === 'page_view') {
                pageViews7d++;
                if (!Number.isNaN(createdMs) && createdMs >= todayStartMs) {
                  pageViewsToday++;
                }
                const host = String(ev.referrer_host || 'direct') || 'direct';
                refCounts.set(host, (refCounts.get(host) || 0) + 1);
              } else if (evName === 'signup_completed') {
                funnel7d.signups++;
              } else if (evName === 'login_completed') {
                funnel7d.logins++;
              } else if (evName === 'evaluation_run') {
                funnel7d.evaluations++;
              } else if (evName === 'interview_guide_generated') {
                funnel7d.guides++;
              } else if (evName === 'upgrade_clicked') {
                funnel7d.upgradeClicks++;
              }
            }

            uniqueVisitors7d = uniqueSessions.size;
            topReferrers = Array.from(refCounts.entries())
              .map(([host, count]) => ({ host, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 6);
          }
        }
      } catch {
        analyticsTableReady = false;
      }
    }

    return res.status(200).json({
      source: secretKey ? 'supabase' : 'local',
      analyticsTableReady,
      supabaseConfigured: Boolean(secretKey && url.startsWith('https://')),
      totalUsers,
      tierBreakdown,
      totalEvaluationsRun,
      totalGuidesGenerated,
      externalUsers,
      externalTierBreakdown,
      externalEvaluationsRun,
      externalGuidesGenerated,
      pageViewsToday,
      pageViews7d,
      uniqueVisitors7d,
      funnel7d,
      topReferrers,
      recentSignups,
      externalRecentSignups,
      generatedAt: new Date().toISOString(),
    });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
