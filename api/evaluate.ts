import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

type RoleDomainId =
  | 'engineering'
  | 'sales'
  | 'marketing'
  | 'hr'
  | 'finance'
  | 'operations'
  | 'product_design'
  | 'general';

interface RoleDomainContext {
  domain: RoleDomainId;
  isTechnical: boolean;
  domainLabel: string;
  roleTitle: string;
}

const DOMAIN_CONFIG: Record<
  RoleDomainId,
  {
    isTechnical: boolean;
    label: string;
    defaultRole: string;
    signals: RegExp;
    depthKeywords: string[];
  }
> = {
  engineering: {
    isTechnical: true,
    label: 'Software & Engineering',
    defaultRole: 'Engineering Role',
    signals:
      /\b(software\s+engineer|developer|backend|frontend|full[\s-]?stack|devops|sre|site\s+reliability|cloud\s+architect|golang|python|java\b(?!\s*coffee)|typescript|javascript|react|node\.?js|kubernetes|docker|microservices|distributed\s+systems|data\s+engineer|machine\s+learning|api\s+design|qa\s+engineer|cybersecurity)\b/gi,
    depthKeywords: [
      'distributed',
      'microservices',
      'architecture',
      'scale',
      'production',
      'throughput',
      'latency',
      'concurrency',
      'cloud',
      'kubernetes',
      'ci/cd',
      'observability',
      'security',
      'reliability',
    ],
  },
  sales: {
    isTechnical: false,
    label: 'Sales & Business Development',
    defaultRole: 'Sales / Business Development Role',
    signals:
      /\b(sales|account\s+executive|business\s+development|bdr|sdr|quota|pipeline|arr|mrr|cold\s+call|prospecting|closing|enterprise\s+sales|territory|revenue\s+growth|key\s+account|salesforce|hubspot|crm|b2b\s+sales|lead\s+generation|upsell|renewal)\b/gi,
    depthKeywords: [
      'quota',
      'pipeline',
      'revenue',
      'arr',
      'mrr',
      'enterprise',
      'closing',
      'negotiation',
      'territory',
      'retention',
      'expansion',
      'renewal',
      'outbound',
      'prospecting',
      'deal',
    ],
  },
  marketing: {
    isTechnical: false,
    label: 'Marketing & Growth',
    defaultRole: 'Marketing & Growth Role',
    signals:
      /\b(marketing|growth\s+manager|demand\s+generation|seo|sem|paid\s+social|paid\s+search|google\s+ads|meta\s+ads|roas|cac|ltv|ctr|conversion\s+rate|cro|brand\s+strategy|content\s+marketing|copywriting|campaign|lifecycle|email\s+marketing|ga4|google\s+analytics|social\s+media)\b/gi,
    depthKeywords: [
      'campaign',
      'conversion',
      'roas',
      'cac',
      'ltv',
      'funnel',
      'acquisition',
      'retention',
      'organic',
      'paid',
      'brand',
      'attribution',
      'traffic',
      'engagement',
      'pipeline',
    ],
  },
  hr: {
    isTechnical: false,
    label: 'HR & Talent Operations',
    defaultRole: 'HR & Talent Role',
    signals:
      /\b(human\s+resources|hr\s+manager|hr\s+generalist|hrbp|talent\s+acquisition|recruiter|recruiting|people\s+operations|onboarding|employee\s+relations|compensation|benefits|hris|workday|bamboohr|payroll|attrition|labor\s+law|hr\s+compliance|performance\s+management|shrm)\b/gi,
    depthKeywords: [
      'hiring',
      'onboarding',
      'retention',
      'attrition',
      'compliance',
      'payroll',
      'compensation',
      'benefits',
      'sourcing',
      'talent',
      'engagement',
      'policy',
      'headcount',
      'relations',
      'appraisal',
    ],
  },
  finance: {
    isTechnical: false,
    label: 'Finance & Accounting',
    defaultRole: 'Finance & Accounting Role',
    signals:
      /\b(accountant|accounting|finance|fp&a|cpa|cfa|chartered\s+accountant|audit|taxation|gst|tds|gaap|ifrs|balance\s+sheet|p&l|reconciliation|tally|quickbooks|zoho\s+books|accounts\s+payable|accounts\s+receivable|general\s+ledger|treasury|bookkeeping|financial\s+modeling)\b/gi,
    depthKeywords: [
      'audit',
      'gaap',
      'ifrs',
      'reconciliation',
      'forecasting',
      'variance',
      'p&l',
      'balance sheet',
      'tax',
      'ledger',
      'compliance',
      'budgeting',
      'closing',
      'cash flow',
      'valuation',
    ],
  },
  operations: {
    isTechnical: false,
    label: 'Operations & Program Management',
    defaultRole: 'Operations & Management Role',
    signals:
      /\b(operations\s+manager|supply\s+chain|logistics|procurement|vendor\s+management|inventory|lean|six\s+sigma|sla|sop|project\s+manager|program\s+manager|warehouse|fulfillment|erp|pmp|dispatch|fleet|operations\s+lead)\b/gi,
    depthKeywords: [
      'sla',
      'sop',
      'procurement',
      'vendor',
      'supply chain',
      'inventory',
      'fulfillment',
      'logistics',
      'lean',
      'efficiency',
      'cost reduction',
      'turnaround',
      'dispatch',
      'operations',
      'workflow',
    ],
  },
  product_design: {
    isTechnical: false,
    label: 'Product & Design',
    defaultRole: 'Product & Design Role',
    signals:
      /\b(product\s+manager|product\s+owner|ux\s+designer|ui\/ux|ui\s+designer|product\s+designer|figma|user\s+research|wireframes|prototyping|design\s+system|product\s+roadmap|product\s+strategy|usability\s+testing|jira)\b/gi,
    depthKeywords: [
      'roadmap',
      'user research',
      'usability',
      'activation',
      'retention',
      'wireframe',
      'prototype',
      'discovery',
      'launch',
      'stakeholder',
      'backlog',
      'design system',
      'adoption',
      'kpi',
    ],
  },
  general: {
    isTechnical: false,
    label: 'Business & Professional',
    defaultRole: 'Target Role',
    signals: /\b(manager|coordinator|specialist|executive|analyst|consultant|lead|associate)\b/gi,
    depthKeywords: [
      'managed',
      'led',
      'strategy',
      'delivery',
      'client',
      'stakeholder',
      'revenue',
      'growth',
      'operations',
      'process',
      'quality',
      'compliance',
      'budget',
      'team',
    ],
  },
};

function detectRoleDomain(jobDescription: string): RoleDomainContext {
  const safeJD = String(jobDescription || '').trim();
  const scores: Record<RoleDomainId, number> = {
    engineering: 0,
    sales: 0,
    marketing: 0,
    hr: 0,
    finance: 0,
    operations: 0,
    product_design: 0,
    general: 0.5,
  };

  (Object.keys(DOMAIN_CONFIG) as RoleDomainId[]).forEach((domainId) => {
    if (domainId === 'general') return;
    const matches = safeJD.match(DOMAIN_CONFIG[domainId].signals);
    scores[domainId] = matches ? matches.length : 0;
  });

  let bestDomain: RoleDomainId = 'general';
  let bestScore = 0;
  for (const domainId of Object.keys(scores) as RoleDomainId[]) {
    if (domainId === 'general') continue;
    if (scores[domainId] > bestScore) {
      bestScore = scores[domainId];
      bestDomain = domainId;
    }
  }

  let inferredTitle = DOMAIN_CONFIG[bestDomain].defaultRole;
  const firstLines = safeJD
    .split(/[\r\n]+/)
    .map((l) => l.replace(/^(job\s*title|role|position|title)\s*[:\-–]\s*/i, '').trim())
    .filter((l) => l.length >= 4 && l.length <= 75);

  const explicitTitleMatch = safeJD.match(/(?:job\s*title|role|position)\s*[:\-–]\s*([^\r\n]{4,70})/i);
  if (explicitTitleMatch?.[1]) {
    inferredTitle = explicitTitleMatch[1].trim();
  } else if (firstLines[0] && !/^(about\s+us|company|overview|summary|we\s+are\s+looking)/i.test(firstLines[0])) {
    inferredTitle = firstLines[0].replace(/[.:]+$/, '').trim();
  }

  return {
    domain: bestDomain,
    isTechnical: DOMAIN_CONFIG[bestDomain].isTechnical,
    domainLabel: DOMAIN_CONFIG[bestDomain].label,
    roleTitle: inferredTitle,
  };
}

const STOPWORDS = new Set([
  'with', 'that', 'this', 'from', 'have', 'will', 'your', 'about', 'into', 'across', 'their', 'they',
  'what', 'when', 'where', 'which', 'while', 'were', 'been', 'being', 'more', 'most', 'some', 'such',
  'than', 'then', 'them', 'these', 'those', 'very', 'well', 'work', 'working', 'role', 'team', 'years',
  'year', 'experience', 'required', 'preferred', 'skills', 'must', 'strong', 'good', 'excellent', 'ability',
  'including', 'looking', 'candidate', 'company', 'business', 'responsibilities', 'requirements',
  'qualifications', 'job', 'description', 'join', 'help', 'ensure', 'support', 'drive', 'build', 'using',
]);

const JUNK_LINE_RE =
  /(@|https?:\/\/|www\.|linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com|\+?\d[\d\s\-().]{7,}\d|i\s+hereby\s+declare|declaration|references\s+available|date\s+of\s+birth|\bdob\b|marital\s+status|nationality\s*:|father'?s\s+name|permanent\s+address|languages\s+known|hobbies\s*:|curriculum\s+vitae|resume\s*$)/i;

const SECTION_HEADER_ONLY_RE =
  /^(professional\s+summary|executive\s+summary|career\s+objective|objective|work\s+experience|professional\s+experience|experience|employment\s+history|technical\s+skills|core\s+competencies|skills|education|academic\s+qualifications|certifications|projects|key\s+achievements|achievements|awards|references|declaration|contact|profile)$/i;

const SKILL_DUMP_PREFIX_RE =
  /^(languages|databases|cloud|frameworks|tools|technologies|tech\s+stack|core\s+skills|skills|competencies|software|platforms|certifications)\s*:/i;

const IMPACT_METRIC_RE =
  /(\d+(?:\.\d+)?%|[$₹€£]\s?\d+(?:[.,]\d+)?[kKmMbB]?|\b\d+(?:\.\d+)?[kKmMbB]\+?|\b\d+(?:\.\d+)?x\b|\b\d+\+?\s*(?:users|clients|customers|accounts|deals|leads|candidates|hires|engineers|employees|services|requests|orders|projects|campaigns|calls|meetings|hours|days|months|qps|rps|ms))/i;

const ACTION_VERB_RE =
  /\b(spearheaded|architected|built|developed|optimized|reduced|increased|grew|closed|generated|negotiated|exceeded|delivered|shipped|managed|led|launched|designed|scaled|reconciled|audited|recruited|hired|streamlined|automated|improved|drove|owned|implemented)\b/i;

function normalizeMatchText(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[•●▪▫▸‣\-–—*`"'“”‘’()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanQuoteSurface(raw: string): string {
  return String(raw || '')
    .replace(/^[\s•●▪▫▸‣\-–—*\d.)"“'‘]+/, '')
    .replace(/["”'’\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isJunkQuote(q: string): boolean {
  const clean = cleanQuoteSurface(q);
  if (clean.length < 24) return true;
  if (JUNK_LINE_RE.test(clean)) return true;
  if (SECTION_HEADER_ONLY_RE.test(clean)) return true;
  if (SKILL_DUMP_PREFIX_RE.test(clean)) return true;
  if (
    /^(b\.?tech|b\.?e|m\.?tech|b\.?sc|m\.?sc|b\.?com|m\.?com|bba|mba|bachelor|master|high\s+school|university|institute)\b/i.test(
      clean
    ) &&
    clean.length < 75 &&
    !/\b(led|built|architected|managed|increased|reduced|closed|launched|grew|won|%|\$)\b/i.test(clean)
  ) {
    return true;
  }
  const words = clean.split(/\s+/);
  if (words.length < 4) return true;
  const digitRatio = (clean.match(/\d/g) || []).length / clean.length;
  if (digitRatio > 0.35 && !clean.includes('%') && !clean.includes('$') && !clean.includes('₹')) {
    return true;
  }
  return false;
}

function smartTruncateComplete(text: string, maxLen: number = 165): string {
  const clean = cleanQuoteSurface(text);
  if (clean.length <= maxLen) return clean;
  const slice = clean.slice(0, maxLen);
  const lastPeriod = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('; '));
  if (lastPeriod >= 55) return slice.slice(0, lastPeriod + 1).trim();
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace >= 50 ? slice.slice(0, lastSpace) : slice;
  return cut.replace(/[,:;\-\s]+$/, '').trim() + '...';
}

function extractCleanResumeSegments(resumeText: string): string[] {
  const raw = String(resumeText || '').trim();
  if (!raw) return [];

  const firstPass = raw
    .replace(/\b(EXPERIENCE|WORK HISTORY|PROFESSIONAL SUMMARY|KEY ACHIEVEMENTS|PROJECTS|EDUCATION|SKILLS)\b/g, '\n')
    .split(/(?:[\r\n]+|\s*[•●▪▫▸‣]\s*|\s+\-\s+|\s*\|\s*)/)
    .map((s) => cleanQuoteSurface(s))
    .filter((s) => s.length >= 24);

  const segments: string[] = [];
  for (const chunk of firstPass) {
    if (chunk.length <= 170) {
      if (!isJunkQuote(chunk)) segments.push(chunk);
    } else {
      const subSentences = chunk
        .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
        .map((s) => cleanQuoteSurface(s))
        .filter((s) => s.length >= 24 && !isJunkQuote(s));
      if (subSentences.length > 0) {
        for (const sub of subSentences) segments.push(smartTruncateComplete(sub, 165));
      } else if (!isJunkQuote(chunk)) {
        segments.push(smartTruncateComplete(chunk, 165));
      }
    }
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const seg of segments) {
    const key = normalizeMatchText(seg).slice(0, 60);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(seg);
    }
  }
  return unique;
}

function sanitizeAndVerifyQuotes(
  candidateQuotes: unknown,
  resumeText: string,
  matchedSkills: string[] = [],
  jobDescription: string = ''
): string[] {
  const safeResume = String(resumeText || '').trim();
  if (!safeResume) return [];

  const normalizedResume = normalizeMatchText(safeResume);
  const cleanSegments = extractCleanResumeSegments(safeResume);
  const jdWordSet = new Set(
    String(jobDescription || '')
      .toLowerCase()
      .split(/[^a-z0-9+#/]+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
  );

  const verified: string[] = [];
  const seenNorm = new Set<string>();

  const pushUnique = (text: string) => {
    const trimmed = smartTruncateComplete(text, 165);
    if (isJunkQuote(trimmed)) return;
    const norm = normalizeMatchText(trimmed).slice(0, 65);
    if (!norm || seenNorm.has(norm)) return;
    seenNorm.add(norm);
    verified.push(trimmed);
  };

  if (Array.isArray(candidateQuotes)) {
    for (const rawItem of candidateQuotes) {
      if (typeof rawItem !== 'string') continue;
      const cleaned = cleanQuoteSurface(rawItem);
      if (isJunkQuote(cleaned)) continue;

      const normQuote = normalizeMatchText(cleaned);
      if (!normQuote || normQuote.length < 20) continue;

      const coreNorm = normQuote.replace(/\.\.\.$/, '').trim();
      if (normalizedResume.includes(coreNorm)) {
        pushUnique(cleaned);
        if (verified.length >= 4) break;
        continue;
      }

      const qWords = coreNorm.split(' ').filter((w) => w.length >= 4);
      if (qWords.length >= 3) {
        let bestSeg = '';
        let bestScore = 0;
        for (const seg of cleanSegments) {
          const segNorm = normalizeMatchText(seg);
          const hits = qWords.filter((w) => segNorm.includes(w)).length;
          const ratio = hits / qWords.length;
          if (hits >= 3 && ratio >= 0.65 && ratio > bestScore) {
            bestScore = ratio;
            bestSeg = seg;
          }
        }
        if (bestSeg) {
          pushUnique(bestSeg);
          if (verified.length >= 4) break;
        }
      }
    }
  }

  if (verified.length < 3 && cleanSegments.length > 0) {
    const skillTokens = matchedSkills
      .flatMap((s) => s.toLowerCase().split(/[\/,&()]+/))
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);

    const scored = cleanSegments.map((seg, idx) => {
      let rank = 0;
      const lower = seg.toLowerCase();
      if (IMPACT_METRIC_RE.test(seg)) rank += 6;
      if (ACTION_VERB_RE.test(seg)) rank += 3;
      if (skillTokens.some((sk) => lower.includes(sk))) rank += 4;
      const jdHits = lower
        .split(/[^a-z0-9+#/]+/)
        .filter((w) => w.length >= 4 && jdWordSet.has(w)).length;
      rank += Math.min(4, jdHits * 1.5);
      if (seg.length >= 45 && seg.length <= 145) rank += 2;
      return { seg, rank, idx };
    });

    scored.sort((a, b) => b.rank - a.rank || a.idx - b.idx);
    for (const item of scored) {
      pushUnique(item.seg);
      if (verified.length >= 4) break;
    }
  }

  if (verified.length === 0) {
    const fallbackLine = safeResume
      .split(/[\r\n]+/)
      .map((l) => cleanQuoteSurface(l))
      .find((l) => l.length >= 18 && !JUNK_LINE_RE.test(l));
    if (fallbackLine) verified.push(smartTruncateComplete(fallbackLine, 140));
  }

  return verified.slice(0, 4);
}

interface SkillDef {
  name: string;
  domain: RoleDomainId | 'universal';
  jdRegex: RegExp;
  resumeRegex: RegExp;
}

const CANONICAL_SKILLS: SkillDef[] = [
  { name: 'Python', domain: 'engineering', jdRegex: /\bpython\b/i, resumeRegex: /\bpython\b/i },
  { name: 'Java', domain: 'engineering', jdRegex: /\bjava\b(?!script)/i, resumeRegex: /\bjava\b(?!script)/i },
  { name: 'Go / Golang', domain: 'engineering', jdRegex: /\bgo\b|\bgolang\b/i, resumeRegex: /\bgolang\b|\bgo\s*(?:language|developer|backend|services|microservices)\b|Languages:[^.\n]*\bGo\b/i },
  { name: 'TypeScript', domain: 'engineering', jdRegex: /\btypescript\b/i, resumeRegex: /\btypescript\b/i },
  { name: 'JavaScript', domain: 'engineering', jdRegex: /\bjavascript\b|\bjs\b/i, resumeRegex: /\bjavascript\b|\bjs\b/i },
  { name: 'Node.js', domain: 'engineering', jdRegex: /\bnode\.?js\b/i, resumeRegex: /\bnode\.?js\b/i },
  { name: 'React', domain: 'engineering', jdRegex: /\breact(?:\.js)?\b(?!-native)/i, resumeRegex: /\breact(?:\.js)?\b(?!-native)/i },
  { name: 'REST APIs', domain: 'engineering', jdRegex: /\brest\s*apis?\b|\brestful\b|\brest\b/i, resumeRegex: /\brest(?:ful)?(?:\s*apis?)?\b/i },
  { name: 'Microservices', domain: 'engineering', jdRegex: /\bmicroservices?\b/i, resumeRegex: /\bmicroservices?\b/i },
  { name: 'Distributed Systems', domain: 'engineering', jdRegex: /\bdistributed(?:\s+systems?)?\b/i, resumeRegex: /\bdistributed(?:\s+systems?)?\b/i },
  { name: 'SQL / Databases', domain: 'engineering', jdRegex: /\bsql\b|\bdatabases?\b/i, resumeRegex: /\bpostgres(?:ql)?\b|\bmysql\b|\bsql\b|\bmongodb?\b|\brds\b|\bsupabase\b/i },
  { name: 'AWS', domain: 'engineering', jdRegex: /\baws\b|\bamazon\s+web\s+services\b/i, resumeRegex: /\baws\b|\bec2\b|\bs3\b|\blambda\b|\brds\b/i },
  { name: 'Docker', domain: 'engineering', jdRegex: /\bdocker\b|\bcontainers?\b/i, resumeRegex: /\bdocker\b|\bcontainers?\b/i },
  { name: 'Kubernetes', domain: 'engineering', jdRegex: /\bkubernetes\b|\bk8s\b/i, resumeRegex: /\bkubernetes\b|\bk8s\b/i },
  { name: 'CI/CD', domain: 'engineering', jdRegex: /\bci[\/\-]cd\b/i, resumeRegex: /\bci[\/\-]cd\b|\bgithub\s+actions\b|\bjenkins\b/i },
  { name: 'B2B Sales', domain: 'sales', jdRegex: /\bb2b\s+sales\b|\bb2b\b/i, resumeRegex: /\bb2b(?:\s+sales)?\b|\benterprise\s+sales\b/i },
  { name: 'Enterprise Sales', domain: 'sales', jdRegex: /\benterprise\s+sales\b|\benterprise\s+accounts?\b/i, resumeRegex: /\benterprise\s+sales\b|\benterprise\s+accounts?\b|\benterprise\s+clients?\b/i },
  { name: 'Lead Generation & Prospecting', domain: 'sales', jdRegex: /\blead\s+generation\b|\bprospecting\b|\boutbound\b|\bcold\s+calling\b/i, resumeRegex: /\blead\s+generation\b|\bprospecting\b|\boutbound\b|\bcold\s+call(?:ing|s)?\b/i },
  { name: 'Pipeline Management', domain: 'sales', jdRegex: /\bpipeline\b/i, resumeRegex: /\bpipeline\b/i },
  { name: 'Quota Attainment', domain: 'sales', jdRegex: /\bquota\b|\btarget\s+achievement\b|\brevenue\s+targets?\b/i, resumeRegex: /\bquota\b|\brevenue\s+target\b|\barr\b|\bmrr\b/i },
  { name: 'CRM Systems (Salesforce / HubSpot)', domain: 'sales', jdRegex: /\bcrm\b|\bsalesforce\b|\bhubspot\b/i, resumeRegex: /\bcrm\b|\bsalesforce\b|\bhubspot\b|\bzoho\b|\bpipedrive\b/i },
  { name: 'Growth Marketing', domain: 'marketing', jdRegex: /\bgrowth\s+marketing\b|\buser\s+acquisition\b/i, resumeRegex: /\bgrowth\s+marketing\b|\buser\s+acquisition\b|\bcustomer\s+acquisition\b/i },
  { name: 'Demand Generation', domain: 'marketing', jdRegex: /\bdemand\s+gen(?:eration)?\b|\bmql\b/i, resumeRegex: /\bdemand\s+gen(?:eration)?\b|\bmql\b/i },
  { name: 'SEO / SEM', domain: 'marketing', jdRegex: /\bseo\b|\bsem\b/i, resumeRegex: /\bseo\b|\bsem\b|\bahrefs\b|\bsemrush\b/i },
  { name: 'Paid Ads (Google / Meta)', domain: 'marketing', jdRegex: /\bgoogle\s+ads\b|\bmeta\s+ads\b|\bppc\b|\bpaid\s+(?:media|search|social|ads)\b/i, resumeRegex: /\bgoogle\s+ads\b|\bmeta\s+ads\b|\bppc\b|\bpaid\s+(?:media|search|social|ads)\b|\broas\b/i },
  { name: 'Google Analytics / Attribution', domain: 'marketing', jdRegex: /\bgoogle\s+analytics\b|\bga4\b|\battribution\b/i, resumeRegex: /\bgoogle\s+analytics\b|\bga4\b|\bmixpanel\b|\bamplitude\b/i },
  { name: 'Talent Acquisition / Recruiting', domain: 'hr', jdRegex: /\btalent\s+acquisition\b|\brecruit(?:ment|ing)\b/i, resumeRegex: /\btalent\s+acquisition\b|\brecruit(?:ment|ing|ed)\b/i },
  { name: 'Employee Onboarding & Relations', domain: 'hr', jdRegex: /\bonboarding\b|\bemployee\s+relations\b/i, resumeRegex: /\bonboarding\b|\bemployee\s+relations\b|\bemployee\s+engagement\b/i },
  { name: 'HRIS / Payroll / Compliance', domain: 'hr', jdRegex: /\bhris\b|\bworkday\b|\bpayroll\b|\bhr\s+compliance\b|\blabor\s+law\b/i, resumeRegex: /\bhris\b|\bworkday\b|\bpayroll\b|\bcompliance\b|\bkeka\b|\bdarwinbox\b/i },
  { name: 'GAAP / IFRS Accounting', domain: 'finance', jdRegex: /\bgaap\b|\bifrs\b/i, resumeRegex: /\bgaap\b|\bifrs\b/i },
  { name: 'Financial Modeling & FP&A', domain: 'finance', jdRegex: /\bfinancial\s+modeling\b|\bfp&a\b|\bforecasting\b|\bbudgeting\b/i, resumeRegex: /\bfinancial\s+modeling\b|\bfp&a\b|\bforecast(?:ing)?\b|\bbudget(?:ing)?\b/i },
  { name: 'P&L & Reconciliation', domain: 'finance', jdRegex: /\bp&l\b|\bbalance\s+sheet\b|\breconciliation\b/i, resumeRegex: /\bp&l\b|\bbalance\s+sheet\b|\breconcil(?:iation|ed|ing)\b/i },
  { name: 'Taxation & Audit', domain: 'finance', jdRegex: /\btax(?:ation)?\b|\baudit\b|\bgst\b|\btds\b/i, resumeRegex: /\btax(?:ation)?\b|\baudit(?:ing|ed)?\b|\bgst\b|\btds\b/i },
  { name: 'QuickBooks / Tally / SAP', domain: 'finance', jdRegex: /\bquickbooks\b|\btally\b|\bxero\b|\bsap\b|\bzoho\s+books\b/i, resumeRegex: /\bquickbooks\b|\btally\b|\bxero\b|\bsap\b|\bzoho\s+books\b/i },
  { name: 'Operations & Process Improvement', domain: 'operations', jdRegex: /\boperations\b|\bsop\b|\bprocess\s+improvement\b/i, resumeRegex: /\boperations\b|\bsop\b|\bprocess\s+(?:improvement|optimization)\b/i },
  { name: 'Supply Chain & Procurement', domain: 'operations', jdRegex: /\bsupply\s+chain\b|\blogistics\b|\bprocurement\b|\bvendor\s+management\b/i, resumeRegex: /\bsupply\s+chain\b|\blogistics\b|\bprocurement\b|\bvendor\b/i },
  { name: 'Product Strategy & UI/UX', domain: 'product_design', jdRegex: /\bproduct\s+(?:strategy|roadmap|management)\b|\bfigma\b|\bui\/ux\b/i, resumeRegex: /\bproduct\s+(?:strategy|roadmap|management)\b|\bfigma\b|\bui\/ux\b/i },
  { name: 'Excel / Data Analysis', domain: 'universal', jdRegex: /\bexcel\b|\bgoogle\s+sheets\b|\bdata\s+analysis\b|\bpower\s+bi\b/i, resumeRegex: /\bexcel\b|\bgoogle\s+sheets\b|\bdata\s+analysis\b|\bpower\s+bi\b|\btableau\b/i },
  { name: 'Stakeholder & Team Leadership', domain: 'universal', jdRegex: /\bstakeholder\b|\bcross[- ]functional\b|\bteam\s+leadership\b/i, resumeRegex: /\bstakeholder\b|\bcross[- ]functional\b|\bled\s+a\s+team\b|\bmanaged\s+\d+/i },
];

function heuristicFallbackEvaluate(
  jobDescription: string,
  resumeText: string,
  candidateName?: string,
  strictnessMode: string = 'standard'
) {
  const safeJD = String(jobDescription || '').trim();
  const safeResume = String(resumeText || '').trim();
  const domainCtx = detectRoleDomain(safeJD);
  const resumeLower = safeResume.toLowerCase();

  let resolvedName = candidateName || 'Candidate';
  const firstLine = safeResume.split(/[\r\n]+/)[0]?.trim() || '';
  const headerMatch = firstLine.match(/^([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})$/);
  if (
    headerMatch &&
    !/(resume|curriculum|vitae|summary|profile|experience|skills|contact|objective|engineer|manager|executive)/i.test(
      headerMatch[1]
    )
  ) {
    resolvedName = headerMatch[1].trim();
  }

  const matched_skills: string[] = [];
  const missing_skills: string[] = [];
  for (const skill of CANONICAL_SKILLS) {
    if (skill.jdRegex.test(safeJD)) {
      if (skill.resumeRegex.test(safeResume)) matched_skills.push(skill.name);
      else missing_skills.push(skill.name);
    }
  }

  const jdKeywords = Array.from(
    new Set(
      safeJD
        .toLowerCase()
        .split(/[^a-z0-9+#/]+/)
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    )
  );
  const jdMatchedKeywords = jdKeywords.filter((kw) => resumeLower.includes(kw));
  const jdOverlapRatio = jdKeywords.length > 0 ? jdMatchedKeywords.length / jdKeywords.length : 0;

  const resumeDomainCtx = detectRoleDomain(safeResume);
  const isCrossDomainMismatch =
    matched_skills.length === 0 &&
    jdOverlapRatio < 0.12 &&
    domainCtx.domain !== 'general' &&
    resumeDomainCtx.domain !== 'general' &&
    resumeDomainCtx.domain !== domainCtx.domain;

  const finalQuotes = sanitizeAndVerifyQuotes([], safeResume, matched_skills, safeJD);

  const reqCount = matched_skills.length + missing_skills.length;
  const matchRatio = reqCount > 0 ? matched_skills.length / reqCount : Math.min(0.85, jdOverlapRatio * 2.2);
  let baseSkillPts = Math.round(matchRatio * 26);
  if (strictnessMode === 'strict') baseSkillPts = Math.max(0, baseSkillPts - missing_skills.length * 4);
  else if (strictnessMode === 'lenient') baseSkillPts = Math.min(28, baseSkillPts + 4);

  const expMatch = resumeLower.match(/(\d+)\+?\s*years?(?:\s+of)?\s+(?:experience|exp|in|working)/);
  const yearsExp = expMatch ? parseInt(expMatch[1], 10) : safeResume.length > 1000 ? 4 : 2;
  const expPts = isCrossDomainMismatch ? 2 : Math.min(8, Math.round(yearsExp * 1.3));
  const hasDegree = /\b(bachelor|b\.?s|bs|b\.?tech|b\.?com|bba|master|m\.?s|ms|mba|cpa|cfa|ca\b|shrm|pmp|phd|degree)\b/i.test(safeResume);
  const degreePts = hasDegree ? (isCrossDomainMismatch ? 2 : 4) : 2;
  let hardReqScore = Math.max(0, Math.min(40, baseSkillPts + expPts + degreePts));

  const depthHits = DOMAIN_CONFIG[domainCtx.domain].depthKeywords.filter((w) => resumeLower.includes(w)).length;
  const seniorityPts = /\b(vp|head of|principal|director|architect|senior|lead|manager)\b/i.test(safeResume) ? 8 : 5;
  let domainDepthScore = Math.max(0, Math.min(30, seniorityPts + Math.min(12, Math.round(depthHits * 2.2)) + (jdOverlapRatio >= 0.25 ? 8 : 5)));

  const metricMatches = safeResume.match(new RegExp(IMPACT_METRIC_RE.source, 'gi')) || [];
  let metricPts = Math.min(16, metricMatches.length * 4);
  if (strictnessMode === 'strict' && metricMatches.length === 0) metricPts = 0;
  const verbHits = (safeResume.match(new RegExp(ACTION_VERB_RE.source, 'gi')) || []).length;
  let evidenceScore = Math.max(0, Math.min(30, metricPts + Math.min(8, verbHits * 2) + (metricMatches.length > 0 ? 5 : 2)));

  if (isCrossDomainMismatch || (reqCount >= 3 && matched_skills.length === 0 && jdOverlapRatio < 0.14)) {
    hardReqScore = Math.min(hardReqScore, 12);
    domainDepthScore = Math.min(domainDepthScore, 10);
    evidenceScore = Math.min(evidenceScore, 14);
  }

  const totalScore = Math.max(0, Math.min(100, hardReqScore + domainDepthScore + evidenceScore));
  let recommendation: 'Strong Fit' | 'Qualified' | 'Marginal / Borderline' | 'Unqualified';
  if (totalScore >= 85) recommendation = 'Strong Fit';
  else if (totalScore >= 70) recommendation = 'Qualified';
  else if (totalScore >= 50) recommendation = 'Marginal / Borderline';
  else recommendation = 'Unqualified';

  return {
    candidate_name: resolvedName,
    score: totalScore,
    score_breakdown: {
      hard_requirements: hardReqScore,
      domain_depth: domainDepthScore,
      verifiable_evidence: evidenceScore,
      total: totalScore,
    },
    matched_skills: matched_skills.slice(0, 8),
    missing_skills: missing_skills.slice(0, 6),
    pros: [
      matched_skills.length > 0
        ? `Verified alignment on key ${domainCtx.domainLabel.toLowerCase()} requirements: ${matched_skills.slice(0, 4).join(', ')}.`
        : `Baseline background evaluated against ${domainCtx.roleTitle} expectations.`,
      metricMatches.length > 0
        ? `Documented quantifiable outcomes in resume text: ${metricMatches.slice(0, 3).join(', ')}.`
        : finalQuotes[0]
        ? `Direct track record cited: "${smartTruncateComplete(finalQuotes[0], 95)}".`
        : `Structured execution history across prior responsibilities.`,
      `Seniority and role scope calibrated against ${domainCtx.domainLabel.toLowerCase()} standards.`,
    ],
    cons: [
      missing_skills.length > 0
        ? `Missing explicit documentation for target JD requirements: ${missing_skills.slice(0, 3).join(', ')}.`
        : isCrossDomainMismatch
        ? `Primary background (${resumeDomainCtx.domainLabel}) mismatches target ${domainCtx.roleTitle} criteria.`
        : `Requires targeted interview probe on edge-case execution in ${domainCtx.roleTitle}.`,
      metricMatches.length < 2
        ? 'Limited quantifiable metrics provided in resume text to substantiate claimed impact.'
        : `Verify personal ownership behind reported results (${metricMatches[0]}).`,
      `Independent verification of day-one readiness required under ${strictnessMode} calibration.`,
    ],
    rank_reasoning: isCrossDomainMismatch
      ? `${resolvedName} scored ${totalScore}/100 (${recommendation}) due to a domain mismatch between their ${resumeDomainCtx.domainLabel} profile and the ${domainCtx.roleTitle} requirements.`
      : `${resolvedName} scored ${totalScore}/100 under ${strictnessMode} calibration for ${domainCtx.roleTitle} with ${matched_skills.length} matched criteria. Hard requirements scored ${hardReqScore}/40, role depth ${domainDepthScore}/30, and verifiable evidence ${evidenceScore}/30.`,
    rubric_analysis: {
      hard_requirements_notes: `Matched ${matched_skills.length} of ${Math.max(reqCount, 1)} tracked ${domainCtx.domainLabel.toLowerCase()} criteria (${hardReqScore}/40).`,
      domain_depth_notes: `Role history shows ${depthHits} domain-depth signals for ${domainCtx.roleTitle} (${domainDepthScore}/30).`,
      verifiable_evidence_notes: `Found ${metricMatches.length} quantifiable metrics and ${finalQuotes.length} verified verbatim citations (${evidenceScore}/30).`,
    },
    recommendation,
    key_quotes: finalQuotes,
    verifiable_evidence: finalQuotes,
    evaluated_at: new Date().toISOString(),
  };
}

function sanitizeGeminiEvaluation(
  rawEval: any,
  jobDescription: string,
  resumeText: string,
  candidateName?: string,
  strictnessMode: string = 'standard'
) {
  const domainCtx = detectRoleDomain(jobDescription);
  const hardReq = Math.max(0, Math.min(40, Math.round(Number(rawEval?.score_breakdown?.hard_requirements ?? 0))));
  const domainDepth = Math.max(0, Math.min(30, Math.round(Number(rawEval?.score_breakdown?.domain_depth ?? 0))));
  const verifiableEv = Math.max(0, Math.min(30, Math.round(Number(rawEval?.score_breakdown?.verifiable_evidence ?? 0))));
  const total = Math.max(0, Math.min(100, hardReq + domainDepth + verifiableEv));

  let recommendation: 'Strong Fit' | 'Qualified' | 'Marginal / Borderline' | 'Unqualified';
  if (total >= 85) recommendation = 'Strong Fit';
  else if (total >= 70) recommendation = 'Qualified';
  else if (total >= 50) recommendation = 'Marginal / Borderline';
  else recommendation = 'Unqualified';

  const matchedRaw: string[] = Array.isArray(rawEval?.matched_skills)
    ? rawEval.matched_skills.map((s: any) => String(s || '').trim()).filter(Boolean)
    : [];
  const matchedSet = new Set(matchedRaw.map((s) => s.toLowerCase()));
  const missingRaw: string[] = Array.isArray(rawEval?.missing_skills)
    ? rawEval.missing_skills.map((s: any) => String(s || '').trim()).filter((s: string) => Boolean(s) && !matchedSet.has(s.toLowerCase()))
    : [];

  const candidateQuotesInput = [
    ...(Array.isArray(rawEval?.key_quotes) ? rawEval.key_quotes : []),
    ...(Array.isArray(rawEval?.verifiable_evidence) ? rawEval.verifiable_evidence : []),
  ];
  const verifiedQuotes = sanitizeAndVerifyQuotes(candidateQuotesInput, resumeText, matchedRaw, jobDescription);

  const pros: string[] = Array.isArray(rawEval?.pros)
    ? rawEval.pros.map((p: any) => String(p || '').trim()).filter(Boolean).slice(0, 3)
    : [];
  while (pros.length < 3) {
    pros.push(
      pros.length === 0 && matchedRaw.length > 0
        ? `Verified proficiency in target requirements: ${matchedRaw.slice(0, 3).join(', ')}.`
        : `Demonstrated experience relevant to ${domainCtx.domainLabel.toLowerCase()} objectives.`
    );
  }

  const cons: string[] = Array.isArray(rawEval?.cons)
    ? rawEval.cons.map((c: any) => String(c || '').trim()).filter(Boolean).slice(0, 3)
    : [];
  while (cons.length < 3) {
    cons.push(
      cons.length === 0 && missingRaw.length > 0
        ? `Missing explicit evidence for required criteria: ${missingRaw.slice(0, 3).join(', ')}.`
        : `Independent verification of outcomes needed for ${domainCtx.roleTitle} under ${strictnessMode} calibration.`
    );
  }

  const rawName = String(rawEval?.candidate_name || '').trim();
  const resolvedName =
    !rawName || ['unknown', 'candidate name', 'n/a', 'none'].includes(rawName.toLowerCase())
      ? String(candidateName || '').trim() || 'Candidate'
      : rawName;

  return {
    candidate_name: resolvedName,
    score: total,
    score_breakdown: {
      hard_requirements: hardReq,
      domain_depth: domainDepth,
      verifiable_evidence: verifiableEv,
      total,
    },
    matched_skills: Array.from(new Set(matchedRaw)).slice(0, 10),
    missing_skills: Array.from(new Set(missingRaw)).slice(0, 8),
    pros,
    cons,
    rank_reasoning:
      String(rawEval?.rank_reasoning || '').trim() ||
      `${resolvedName} scored ${total}/100 (${recommendation}) for ${domainCtx.roleTitle} across mandatory requirements (${hardReq}/40), role depth (${domainDepth}/30), and verifiable evidence (${verifiableEv}/30).`,
    rubric_analysis: {
      hard_requirements_notes:
        String(rawEval?.rubric_analysis?.hard_requirements_notes || '').trim() ||
        `Hard Requirements evaluated at ${hardReq}/40 against ${domainCtx.roleTitle}.`,
      domain_depth_notes:
        String(rawEval?.rubric_analysis?.domain_depth_notes || '').trim() ||
        `Role & Domain Depth evaluated at ${domainDepth}/30 within ${domainCtx.domainLabel}.`,
      verifiable_evidence_notes:
        String(rawEval?.rubric_analysis?.verifiable_evidence_notes || '').trim() ||
        `Verifiable Evidence scored ${verifiableEv}/30 based on verified resume citations.`,
    },
    recommendation,
    key_quotes: verifiedQuotes,
    verifiable_evidence: verifiedQuotes,
    evaluated_at: new Date().toISOString(),
  };
}

const candidateEvaluationSchema = {
  type: Type.OBJECT,
  properties: {
    candidate_name: {
      type: Type.STRING,
      description: 'Real full name of the candidate extracted from the resume',
    },
    score: {
      type: Type.INTEGER,
      description: 'Total score from 0 to 100 matching sum of score_breakdown',
    },
    score_breakdown: {
      type: Type.OBJECT,
      properties: {
        hard_requirements: {
          type: Type.INTEGER,
          description: '0 to 40: mandatory skills, tools, credentials, certifications, and minimum years of experience required by this specific JD',
        },
        domain_depth: {
          type: Type.INTEGER,
          description: '0 to 30: direct relevance of past roles, scope, seniority, and execution depth within this JD domain (technical or non-technical)',
        },
        verifiable_evidence: {
          type: Type.INTEGER,
          description: '0 to 30: concrete metrics, KPIs, revenue, volume, latency, retention, or measurable project deliverables vs. vague buzzwords',
        },
        total: {
          type: Type.INTEGER,
          description: 'Exact sum of hard_requirements + domain_depth + verifiable_evidence',
        },
      },
      required: ['hard_requirements', 'domain_depth', 'verifiable_evidence', 'total'],
    },
    matched_skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Concrete skills, tools, methodologies, or credentials required by the JD and explicitly verified in the resume',
    },
    missing_skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Mandatory skills, credentials, or experience from the JD missing from the resume',
    },
    pros: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Exactly 3 factual, domain-appropriate strengths grounded in resume text',
    },
    cons: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Exactly 3 factual gaps, missing credentials, or interview verification risks',
    },
    rank_reasoning: {
      type: Type.STRING,
      description: 'Exactly 2 concise, objective sentences explaining the score using the exact terminology of the JD domain',
    },
    rubric_analysis: {
      type: Type.OBJECT,
      properties: {
        hard_requirements_notes: { type: Type.STRING },
        domain_depth_notes: { type: Type.STRING },
        verifiable_evidence_notes: { type: Type.STRING },
      },
      required: ['hard_requirements_notes', 'domain_depth_notes', 'verifiable_evidence_notes'],
    },
    recommendation: {
      type: Type.STRING,
      description: 'Strong Fit (85-100), Qualified (70-84), Marginal / Borderline (50-69), or Unqualified (<50)',
    },
    key_quotes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2 to 4 VERBATIM exact substrings copied directly from candidate work achievements or responsibilities (30-150 chars each). NEVER include emails, phone numbers, URLs, addresses, or invented text.',
    },
    verifiable_evidence: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2 to 4 VERBATIM exact substrings proving measurable outcomes or responsibilities directly from the resume.',
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

function decodeJwtTier(req: any): string | null {
  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
    return payload?.tier ? String(payload.tier) : null;
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { jobDescription, resumeText, candidateName, strictnessMode } = req.body || {};
    if (!jobDescription || !String(jobDescription).trim()) {
      return res.status(400).json({ error: 'Job Description is required.' });
    }
    if (!resumeText || !String(resumeText).trim()) {
      return res.status(400).json({ error: 'Candidate Resume text is required.' });
    }

    const tokenTier = decodeJwtTier(req);
    const effectiveMode = tokenTier === 'starter' ? 'standard' : String(strictnessMode || 'standard');
    const domainCtx = detectRoleDomain(jobDescription);
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_SECURE || '';

    if (apiKey) {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const calibrationNote =
        effectiveMode === 'strict'
          ? 'STRICT CALIBRATION: Start at 0. Deduct heavily for any missing mandatory qualification. Give 0 evidence points for vague claims without concrete numbers/outcomes.'
          : effectiveMode === 'lenient'
          ? 'LENIENT CALIBRATION: Credit strongly adjacent transferable skills and practical experience closely related to JD goals.'
          : 'STANDARD CALIBRATION: Objective, balanced 100-point rubric auditing exact JD fit, domain execution depth, and verifiable evidence.';

      const systemInstruction = `You are Vathmos, a precision cross-domain hiring evaluation engine calibrated for BOTH Technical roles (Software, Data, DevOps, Cloud) AND Non-Technical roles (Sales, Growth Marketing, HR, Finance/Accounting, Operations, Product, Design, General Business).

CRITICAL RULES:
1. DOMAIN AUTHENTICITY: Evaluate strictly in the language and criteria of "${domainCtx.domainLabel}". NEVER mention software engineering, code, or microservices unless the Job Description actually asks for them.
2. ZERO FABRICATION ("NO UTER JUTER"): Every string in key_quotes and verifiable_evidence MUST be copied VERBATIM character-for-character from a work achievement, responsibility, or metric line in the Candidate Resume Text.
3. FORBIDDEN QUOTE TYPES: NEVER put email addresses, phone numbers, URLs, home addresses, section headers alone ("SKILLS", "EXPERIENCE"), skill-tag lists, date-of-birth, or "I hereby declare" boilerplate in key_quotes or verifiable_evidence.
4. CROSS-DOMAIN MISMATCH RULE: If the candidate comes from a completely unrelated profession with little or no overlap against the JD's core requirements, cap their total score below 45 and set recommendation to "Unqualified".
5. EXACT ARITHMETIC: score = score_breakdown.total = hard_requirements (0-40) + domain_depth (0-30) + verifiable_evidence (0-30). Use granular non-rounded scores (e.g., 73, 81, 64).`;

      const prompt = `${calibrationNote}

TARGET DOMAIN: ${domainCtx.domainLabel}
ROLE TITLE: ${domainCtx.roleTitle}
CANDIDATE LABEL: ${candidateName || 'Candidate'}

JOB DESCRIPTION:
${String(jobDescription).slice(0, 4500)}

CANDIDATE RESUME TEXT:
${String(resumeText).slice(0, 6500)}`;

      const modelConfigs: Array<{ model: string; thinkingLevel: ThinkingLevel; timeoutMs: number }> = [
        { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW, timeoutMs: 5200 },
        { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL, timeoutMs: 3200 },
      ];

      for (const cfg of modelConfigs) {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), cfg.timeoutMs);
        try {
          const response = await ai.models.generateContent({
            model: cfg.model,
            contents: prompt,
            config: {
              systemInstruction,
              seed: 42,
              responseMimeType: 'application/json',
              responseSchema: candidateEvaluationSchema,
              thinkingConfig: { thinkingLevel: cfg.thinkingLevel },
              abortSignal: ac.signal,
            },
          });
          clearTimeout(timer);

          const rawText = (response.text || '{}')
            .trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/, '')
            .replace(/```$/, '')
            .trim();
          const parsed = JSON.parse(rawText);
          const verified = sanitizeGeminiEvaluation(
            parsed,
            jobDescription,
            resumeText,
            candidateName,
            effectiveMode
          );
          return res.status(200).json(verified);
        } catch (err: any) {
          clearTimeout(timer);
          console.log(`[api/evaluate:${cfg.model}] fallback note:`, String(err?.message || err).slice(0, 140));
        }
      }
    }

    // Deterministic Multi-Domain Engine fallback (when GEMINI_API_KEY is unset or upstream throttles)
    const fallbackResult = heuristicFallbackEvaluate(jobDescription, resumeText, candidateName, effectiveMode);
    return res.status(200).json(fallbackResult);
  } catch (err: any) {
    console.error('api/evaluate fatal error:', err);
    return res.status(500).json({ error: 'Evaluation failed.', details: String(err?.message || err) });
  }
}
