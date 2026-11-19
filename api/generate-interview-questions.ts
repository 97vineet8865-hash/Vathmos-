import crypto from 'crypto';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

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

function detectRoleContext(jobDescription: string) {
  const safeJD = String(jobDescription || '').trim();
  const domainPatterns: Array<{ id: string; isTechnical: boolean; label: string; defaultRole: string; re: RegExp }> = [
    {
      id: 'engineering',
      isTechnical: true,
      label: 'Software & Engineering',
      defaultRole: 'Engineering Role',
      re: /\b(software\s+engineer|developer|backend|frontend|full[\s-]?stack|devops|sre|golang|python|java\b(?!\s*coffee)|typescript|react|kubernetes|docker|microservices|distributed\s+systems|data\s+engineer|machine\s+learning|api)\b/gi,
    },
    {
      id: 'sales',
      isTechnical: false,
      label: 'Sales & Business Development',
      defaultRole: 'Sales / Business Development Role',
      re: /\b(sales|account\s+executive|business\s+development|bdr|sdr|quota|pipeline|arr|mrr|prospecting|closing|salesforce|hubspot|crm|b2b\s+sales|lead\s+generation)\b/gi,
    },
    {
      id: 'marketing',
      isTechnical: false,
      label: 'Marketing & Growth',
      defaultRole: 'Marketing & Growth Role',
      re: /\b(marketing|growth\s+manager|demand\s+generation|seo|sem|google\s+ads|meta\s+ads|roas|cac|ltv|conversion\s+rate|content\s+marketing|campaign|lifecycle|ga4)\b/gi,
    },
    {
      id: 'hr',
      isTechnical: false,
      label: 'HR & Talent Operations',
      defaultRole: 'HR & Talent Role',
      re: /\b(human\s+resources|hr\s+manager|hr\s+generalist|hrbp|talent\s+acquisition|recruiter|recruiting|onboarding|employee\s+relations|compensation|hris|workday|payroll|shrm)\b/gi,
    },
    {
      id: 'finance',
      isTechnical: false,
      label: 'Finance & Accounting',
      defaultRole: 'Finance & Accounting Role',
      re: /\b(accountant|accounting|finance|fp&a|cpa|cfa|audit|taxation|gst|gaap|ifrs|balance\s+sheet|p&l|reconciliation|tally|quickbooks|zoho\s+books|general\s+ledger)\b/gi,
    },
    {
      id: 'operations',
      isTechnical: false,
      label: 'Operations & Program Management',
      defaultRole: 'Operations & Management Role',
      re: /\b(operations\s+manager|supply\s+chain|logistics|procurement|vendor\s+management|inventory|lean|six\s+sigma|sla|sop|project\s+manager|program\s+manager|warehouse|fulfillment|erp)\b/gi,
    },
    {
      id: 'product_design',
      isTechnical: false,
      label: 'Product & Design',
      defaultRole: 'Product & Design Role',
      re: /\b(product\s+manager|product\s+owner|ux\s+designer|ui\/ux|product\s+designer|figma|user\s+research|wireframes|design\s+system|roadmap)\b/gi,
    },
  ];

  let best = { id: 'general', isTechnical: false, label: 'Business & Professional', defaultRole: 'Target Role', hits: 0 };
  for (const d of domainPatterns) {
    const m = safeJD.match(d.re);
    const hits = m ? m.length : 0;
    if (hits > best.hits) best = { ...d, hits };
  }

  let roleTitle = best.defaultRole;
  const titleMatch = safeJD.match(/(?:job\s*title|role|position)\s*[:\-–]\s*([^\r\n]{4,70})/i);
  if (titleMatch?.[1]) {
    roleTitle = titleMatch[1].trim();
  } else {
    const firstLine = safeJD.split(/[\r\n]+/).map((l) => l.trim()).find((l) => l.length >= 4 && l.length <= 75);
    if (firstLine && !/^(about\s+us|company|overview|summary|we\s+are\s+looking)/i.test(firstLine)) {
      roleTitle = firstLine.replace(/[.:]+$/, '').trim();
    }
  }

  return { isTechnical: best.isTechnical, domainLabel: best.label, roleTitle };
}

function buildRoleAwareFallback(params: {
  jobDescription: string;
  pros?: string[];
  cons?: string[];
  matched_skills?: string[];
  missing_skills?: string[];
}) {
  const ctx = detectRoleContext(params.jobDescription);
  const topPro =
    params.pros?.[0] ||
    (params.matched_skills?.[0] ? `Demonstrated strength in ${params.matched_skills[0]}` : `Core strengths in ${ctx.domainLabel}`);
  const topCon1 =
    params.missing_skills?.[0]
      ? `Missing explicit experience: ${params.missing_skills[0]}`
      : params.cons?.[0] || `Key requirement depth for ${ctx.roleTitle}`;
  const topCon2 =
    params.cons?.[1] ||
    (params.missing_skills?.[1] ? `Requirement gap: ${params.missing_skills[1]}` : `Execution ownership and measurable impact in ${ctx.domainLabel}`);

  if (ctx.isTechnical) {
    return [
      {
        type: 'pro_verification',
        badge: 'Q1 • Testing Claimed Strength (Pro)',
        targetPoint: topPro,
        question: `Can you walk us through your direct ownership and implementation behind "${topPro}"? What concrete production metrics or reliability benchmarks proved its impact?`,
        idealAnswer:
          'Listen for clear individual contribution ("I designed/implemented" vs vague "we"), real latency/throughput/reliability numbers, trade-offs evaluated, and debugging lessons.',
        caution: 'Watch for high-level buzzwords without hands-on ownership or inability to explain failure modes.',
      },
      {
        type: 'con_gap_probe',
        badge: 'Q2 • Probing Missing Requirement (Con)',
        targetPoint: topCon1,
        question: `Regarding "${topCon1}" — what is the closest hands-on work you have done in adjacent tools or workflows, and how would you close this gap in your first 30 days?`,
        idealAnswer: 'Look for honest self-awareness, accurate explanation of transferable fundamentals, and a structured ramp-up plan.',
        caution: 'Be wary of candidates overclaiming tutorial familiarity as production mastery or getting defensive about gaps.',
      },
      {
        type: 'con_risk_probe',
        badge: 'Q3 • Probing Risk & Trade-offs (Con)',
        targetPoint: topCon2,
        question: `Thinking about "${topCon2}", tell me about a high-stakes production trade-off where you had to balance delivery speed, reliability, and maintainability.`,
        idealAnswer: 'Clear trade-off reasoning, measurable risk mitigation, monitoring/testing discipline, and pragmatic business alignment.',
        caution: 'Watch out for over-engineering without business context or dismissing operational reliability.',
      },
    ];
  }

  return [
    {
      type: 'pro_verification',
      badge: 'Q1 • Verifying Claimed Result (Pro)',
      targetPoint: topPro,
      question: `Looking at "${topPro}", walk me through the exact steps you personally owned—what baseline did you start from, what changed because of your work, and what numbers proved success?`,
      idealAnswer:
        'Listen for clear personal ownership ("I built/closed/led"), concrete before-and-after numbers (revenue, conversion, time saved, retention, cost), and how obstacles were handled.',
      caution: 'Watch for taking credit for company-wide results without being able to explain their specific day-to-day actions.',
    },
    {
      type: 'con_gap_probe',
      badge: 'Q2 • Probing Role Gap (Con)',
      targetPoint: topCon1,
      question: `In "${ctx.roleTitle}", "${topCon1}" is important. What is the closest real-world situation you have handled, and how would you ramp up quickly here?`,
      idealAnswer: 'Candid acknowledgment of where their experience stops, strong transferable examples from prior roles, and a realistic 30-day execution plan.',
      caution: 'Red flag if they bluff through missing domain workflows or give vague textbook answers instead of real examples.',
    },
    {
      type: 'con_risk_probe',
      badge: 'Q3 • Probing Execution & Judgment (Con)',
      targetPoint: topCon2,
      question: `Around "${topCon2}", tell me about a tough deadline, difficult stakeholder, or missed target—what decisions did you make and what would you do differently next time?`,
      idealAnswer: 'Accountability without blaming others, data-informed prioritization under pressure, clear stakeholder communication, and concrete process improvements.',
      caution: 'Watch for deflection of blame, buzzword-heavy storytelling without measurable outcomes, or rigid thinking.',
    },
  ];
}

const interviewQuestionsSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: 'pro_verification, con_gap_probe, or con_risk_probe' },
          badge: { type: Type.STRING },
          targetPoint: { type: Type.STRING },
          question: { type: Type.STRING },
          idealAnswer: { type: Type.STRING },
          caution: { type: Type.STRING },
        },
        required: ['type', 'badge', 'targetPoint', 'question', 'idealAnswer', 'caution'],
      },
    },
  },
  required: ['questions'],
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { url, secretKey } = getSupabaseConfig();
  const secret = getSessionSecret(secretKey);
  const authHeader = String(req.headers?.authorization || req.headers?.Authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Sign up free or sign in to unlock your 5 free AI interview guides.',
    });
  }

  const session = verifySessionToken(token, secret);
  if (!session) {
    return res.status(401).json({
      error: 'Session expired or invalid token. Please sign in again.',
    });
  }

  const cleanEmail = String(session.email || '').trim().toLowerCase();
  const isAdmin =
    ADMIN_EMAILS.includes(cleanEmail) ||
    session.role === 'Platform Administrator' ||
    session.role === 'Founder & Lead Engineer';

  let userTier = String(session.tier || 'free').toLowerCase();
  let currentUsed = 0;
  let currentLimit = (TIER_LIMITS[userTier] || TIER_LIMITS.free).interviewQuestions;
  let hasWorkspaceRow = false;

  if (secretKey && url.startsWith('https://') && cleanEmail) {
    try {
      const wsResp = await fetch(
        `${url}/rest/v1/vathmos_workspaces?email=eq.${encodeURIComponent(cleanEmail)}&select=tier,interview_questions_limit,interview_questions_used`,
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
        if (Array.isArray(rows) && rows.length > 0) {
          hasWorkspaceRow = true;
          userTier = String(rows[0].tier || userTier).toLowerCase();
          currentLimit = Number(
            rows[0].interview_questions_limit ??
              (TIER_LIMITS[userTier] || TIER_LIMITS.free).interviewQuestions
          );
          currentUsed = Number(rows[0].interview_questions_used ?? 0);
        }
      }
    } catch {
      // Proceed cleanly on transient Supabase timeout
    }
  }

  if (!isAdmin && currentUsed >= currentLimit) {
    return res.status(403).json({
      error: `You have used all ${currentLimit} interview question guides on your ${userTier.toUpperCase()} tier. Please upgrade to continue.`,
    });
  }

  const incrementInterviewGuideUsed = async () => {
    if (isAdmin || !hasWorkspaceRow || !secretKey || !url.startsWith('https://') || !cleanEmail) return;
    try {
      await fetch(
        `${url}/rest/v1/vathmos_workspaces?email=eq.${encodeURIComponent(cleanEmail)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: secretKey,
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            interview_questions_used: currentUsed + 1,
            updated_at: new Date().toISOString(),
          }),
        }
      );
    } catch {
      // Non-blocking sync
    }
  };

  const { jobDescription, candidateName, resumeText, pros, cons, matched_skills, missing_skills } = req.body || {};
  if (!jobDescription || !String(jobDescription).trim()) {
    return res.status(400).json({ error: 'Job Description is required.' });
  }

  try {
    const ctx = detectRoleContext(jobDescription);
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_SECURE || '';

    if (apiKey) {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const topPro = Array.isArray(pros) && pros[0] ? pros[0] : `Demonstrated strength in ${ctx.domainLabel}`;
      const topCon1 =
        (Array.isArray(cons) && cons[0]) ||
        (Array.isArray(missing_skills) && missing_skills[0]) ||
        `Core gap for ${ctx.roleTitle}`;
      const topCon2 =
        (Array.isArray(cons) && cons[1]) ||
        (Array.isArray(missing_skills) && missing_skills[1]) ||
        `Execution depth and measurable impact in ${ctx.domainLabel}`;

      const prompt = `You are a senior hiring specialist generating a calibrated 3-question interview guide for Vathmos.
TARGET ROLE: ${ctx.roleTitle} (${ctx.domainLabel})
CANDIDATE: ${candidateName || 'Candidate'}

CRITICAL DOMAIN RULE: Match the exact terminology and reality of "${ctx.domainLabel}". If this is a Sales, Marketing, HR, Finance, or Operations role, NEVER ask software engineering or coding questions. Focus on real workflows, numbers, decisions, and stakeholders for that specific role.

Follow the 1 PRO + 2 CONS formula:
1. pro_verification: Verify claimed strength ("${topPro}"). Ask for exact actions personally owned and concrete before/after metrics.
2. con_gap_probe: Probe primary missing requirement or resume gap ("${topCon1}") using a realistic scenario for "${ctx.roleTitle}".
3. con_risk_probe: Probe risk/trade-off ("${topCon2}") to distinguish authentic judgment from buzzword bluffing.

JOB DESCRIPTION:
${String(jobDescription).slice(0, 3500)}

KEY PROS: ${Array.isArray(pros) ? pros.join(' | ') : topPro}
KEY CONS: ${Array.isArray(cons) ? cons.join(' | ') : topCon1}
RESUME CONTEXT: ${String(resumeText || '').slice(0, 3500)}`;

      const modelConfigs: Array<{ model: string; thinkingLevel: ThinkingLevel; timeoutMs: number; useZeroTemp: boolean }> = [
        { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW, timeoutMs: 10500, useZeroTemp: false },
        { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL, timeoutMs: 6000, useZeroTemp: true },
      ];

      for (const cfg of modelConfigs) {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), cfg.timeoutMs);
        try {
          const config: any = {
            systemInstruction:
              'Generate exactly 3 role-authentic, bias-free interview questions grounded strictly in the JD and candidate resume context.',
            seed: 42,
            responseMimeType: 'application/json',
            responseSchema: interviewQuestionsSchema,
            thinkingConfig: { thinkingLevel: cfg.thinkingLevel },
            abortSignal: ac.signal,
          };
          if (cfg.useZeroTemp) {
            config.temperature = 0;
          }

          const response = await ai.models.generateContent({
            model: cfg.model,
            contents: prompt,
            config,
          });
          clearTimeout(timer);

          const rawText = (response.text || '{}')
            .trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/, '')
            .replace(/```$/, '')
            .trim();
          const parsed = JSON.parse(rawText);
          if (Array.isArray(parsed?.questions) && parsed.questions.length > 0) {
            await incrementInterviewGuideUsed();
            return res.status(200).json({ questions: parsed.questions.slice(0, 3) });
          }
        } catch (err: any) {
          clearTimeout(timer);
          console.log(`[api/generate-interview-questions:${cfg.model}] fallback note:`, String(err?.message || err).slice(0, 120));
        }
      }
    }

    await incrementInterviewGuideUsed();
    return res.status(200).json({
      questions: buildRoleAwareFallback({ jobDescription, pros, cons, matched_skills, missing_skills }),
    });
  } catch (err: any) {
    console.log('api/generate-interview-questions fallback:', String(err?.message || err));
    await incrementInterviewGuideUsed();
    return res.status(200).json({
      questions: buildRoleAwareFallback({ jobDescription, pros, cons, matched_skills, missing_skills }),
    });
  }
}
