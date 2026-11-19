export type AnalyticsEventName =
  | 'page_view'
  | 'signup_completed'
  | 'login_completed'
  | 'evaluation_run'
  | 'interview_guide_generated'
  | 'upgrade_clicked';

const SESSION_KEY = 'vathmos_ephemeral_vid';

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
  userTier?: string
): void {
  try {
    const path =
      typeof window !== 'undefined' ? (window.location.pathname || '/').slice(0, 120) : '/';
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
