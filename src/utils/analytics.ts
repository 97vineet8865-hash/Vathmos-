export type AnalyticsEventName =
  | 'page_view'
  | 'signup_completed'
  | 'login_completed'
  | 'evaluation_run'
  | 'interview_guide_generated'
  | 'upgrade_clicked';

const SESSION_KEY = 'vathmos_ephemeral_vid';
const FOUNDER_DEVICE_KEY = 'vathmos_founder_device';
const LAST_PV_KEY = 'vathmos_last_pv';

const ADMIN_EMAILS = new Set([
  'vathmossupport@gmail.com',
  'vineet.842011@gmail.com',
  '97.vineet.8865@gmail.com',
]);

export function isFounderEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(String(email).trim().toLowerCase());
}

export function markFounderDevice(email?: string | null): void {
  try {
    if (!email) return;
    if (isFounderEmail(email)) {
      localStorage.setItem(FOUNDER_DEVICE_KEY, '1');
    } else {
      localStorage.removeItem(FOUNDER_DEVICE_KEY);
    }
  } catch {
    // Non-blocking
  }
}

export function isAutomatedTraffic(): boolean {
  try {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
    if ((navigator as any).webdriver === true) return true;

    const ua = String(navigator.userAgent || '').trim();
    if (!ua || ua.length < 12) return true;

    if (
      /bot|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|preview|scanner|wget|curl|phantom|puppeteer|playwright|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|vercel|ahrefs|semrush|mj12bot|yandex|bingpreview|googlebot|applebot/i.test(
        ua
      )
    ) {
      return true;
    }

    if ((window as any).__nightmare || (window as any)._phantom || (window as any).callPhantom) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

function isFounderSessionActive(explicitEmail?: string | null): boolean {
  if (isFounderEmail(explicitEmail)) return true;
  try {
    if (localStorage.getItem(FOUNDER_DEVICE_KEY) === '1') return true;
    const rawUser = localStorage.getItem('vathmos_current_user_session');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (isFounderEmail(parsed?.email)) {
        localStorage.setItem(FOUNDER_DEVICE_KEY, '1');
        return true;
      }
    }
  } catch {
    // Non-blocking
  }
  return false;
}

export function getEphemeralSessionId(): string {
  try {
    let existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const rand =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
        : Math.random().toString(36).slice(2, 14) + Date.now().toString(36);
    existing = `v_${rand}`;
    sessionStorage.setItem(SESSION_KEY, existing);
    return existing;
  } catch {
    return `v_${Date.now().toString(36)}`;
  }
}

export function extractReferrerHost(): string {
  try {
    const raw = document.referrer;
    if (!raw) return 'direct';
    const parsed = new URL(raw);
    const currentHost = window.location.hostname.toLowerCase();
    const refHost = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!refHost || refHost === currentHost || refHost === `www.${currentHost}`) {
      return 'direct';
    }
    if (refHost === 't.co' || refHost === 'twitter.com' || refHost === 'x.com') {
      return 'x.com';
    }
    if (refHost === 'lnkd.in' || refHost.endsWith('linkedin.com')) {
      return 'linkedin.com';
    }
    return refHost.slice(0, 80);
  } catch {
    return 'direct';
  }
}

export function trackEvent(
  eventName: AnalyticsEventName,
  meta?: Record<string, string | number | boolean>,
  userTier?: string,
  userEmail?: string | null
): void {
  try {
    if (isAutomatedTraffic()) return;
    if (isFounderSessionActive(userEmail)) return;

    const path =
      typeof window !== 'undefined' ? (window.location.pathname || '/').slice(0, 120) : '/';

    // Prevent duplicate page_view firing within 1.5s for the exact same path (StrictMode / rapid re-mount)
    if (eventName === 'page_view') {
      try {
        const now = Date.now();
        const prevRaw = sessionStorage.getItem(LAST_PV_KEY);
        if (prevRaw) {
          const prev = JSON.parse(prevRaw);
          if (prev?.path === path && now - Number(prev?.ts || 0) < 1500) {
            return;
          }
        }
        sessionStorage.setItem(LAST_PV_KEY, JSON.stringify({ path, ts: now }));
      } catch {
        // ignore
      }
    }

    const referrerHost = extractReferrerHost();
    const sessionId = getEphemeralSessionId();

    const payload = {
      eventName,
      path,
      referrerHost,
      sessionId,
      userTier: userTier || 'guest',
      meta: meta || {},
    };

    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Non-blocking: analytics never interrupts user workflows
    });
  } catch {
    // Non-blocking
  }
}
