// ============================================================================
// VATHMOS PRECISION MULTI-DOMAIN EVALUATION & VERIFICATION ENGINE
// 1. Tech + Non-Tech Native: Covers Engineering, Sales, Marketing, HR, Finance,
//    Operations, Product/Design, and General roles with dynamic JD requirement mining.
// 2. Zero "Uter Juter" / Hallucinated Evidence: Verifies every key_quote and
//    verifiable_evidence item verbatim against the uploaded resume text and strips
//    contact info, headers, URLs, declarations, and cut-off fragments.
// 3. Cross-Domain Mismatch Guard: Unrelated backgrounds score realistically low.
// ============================================================================

import { EvaluationResult, InterviewQuestion } from '../types';

export type RoleDomainId =
  | 'engineering'
  | 'sales'
  | 'marketing'
  | 'hr'
  | 'finance'
  | 'operations'
  | 'product_design'
  | 'general';

export interface RoleDomainContext {
  domain: RoleDomainId;
  isTechnical: boolean;
  domainLabel: string;
  roleTitle: string;
}

function hashString(str: any): string {
  let hash = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString();
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

export function detectRoleDomain(jobDescription: string): RoleDomainContext {
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

  // Extract clean role title from top of JD when present
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

interface SkillDef {
  name: string;
  domain: RoleDomainId | 'universal';
  jdRegex: RegExp;
  resumeRegex: RegExp;
}

const CANONICAL_SKILLS: SkillDef[] = [
  // Engineering & Tech
  { name: 'Python', domain: 'engineering', jdRegex: /\bpython\b/i, resumeRegex: /\bpython\b/i },
  { name: 'Java', domain: 'engineering', jdRegex: /\bjava\b(?!script)/i, resumeRegex: /\bjava\b(?!script)/i },
  {
    name: 'Go / Golang',
    domain: 'engineering',
    jdRegex: /\bgo\b|\bgolang\b/i,
    resumeRegex: /\bgolang\b|\bgo\s*(?:language|developer|backend|services|microservices)\b|Languages:[^.\n]*\bGo\b/i,
  },
  { name: 'TypeScript', domain: 'engineering', jdRegex: /\btypescript\b/i, resumeRegex: /\btypescript\b/i },
  { name: 'JavaScript', domain: 'engineering', jdRegex: /\bjavascript\b|\bjs\b/i, resumeRegex: /\bjavascript\b|\bjs\b/i },
  { name: 'Node.js', domain: 'engineering', jdRegex: /\bnode\.?js\b/i, resumeRegex: /\bnode\.?js\b/i },
  { name: 'React', domain: 'engineering', jdRegex: /\breact(?:\.js)?\b(?!-native)/i, resumeRegex: /\breact(?:\.js)?\b(?!-native)/i },
  { name: 'Next.js', domain: 'engineering', jdRegex: /\bnext\.?js\b/i, resumeRegex: /\bnext\.?js\b/i },
  { name: 'REST APIs', domain: 'engineering', jdRegex: /\brest\s*apis?\b|\brestful\b|\brest\b/i, resumeRegex: /\brest(?:ful)?(?:\s*apis?)?\b/i },
  { name: 'GraphQL', domain: 'engineering', jdRegex: /\bgraphql\b/i, resumeRegex: /\bgraphql\b/i },
  { name: 'gRPC', domain: 'engineering', jdRegex: /\bgrpc\b/i, resumeRegex: /\bgrpc\b/i },
  { name: 'Microservices', domain: 'engineering', jdRegex: /\bmicroservices?\b/i, resumeRegex: /\bmicroservices?\b/i },
  { name: 'Distributed Systems', domain: 'engineering', jdRegex: /\bdistributed(?:\s+systems?)?\b/i, resumeRegex: /\bdistributed(?:\s+systems?)?\b/i },
  { name: 'Event-Driven Architecture', domain: 'engineering', jdRegex: /\bevent[- ]driven(?:\s+architecture)?\b/i, resumeRegex: /\bevent[- ]driven(?:\s+architecture)?\b/i },
  { name: 'SQL / Databases', domain: 'engineering', jdRegex: /\bsql\b|\bdatabases?\b/i, resumeRegex: /\bpostgres(?:ql)?\b|\bmysql\b|\bsql\b|\bmongodb?\b|\brds\b|\bsupabase\b/i },
  { name: 'PostgreSQL', domain: 'engineering', jdRegex: /\bpostgres(?:ql)?\b/i, resumeRegex: /\bpostgres(?:ql)?\b/i },
  { name: 'MongoDB', domain: 'engineering', jdRegex: /\bmongodb?\b/i, resumeRegex: /\bmongodb?\b/i },
  { name: 'Redis', domain: 'engineering', jdRegex: /\bredis\b|\bcaching\b/i, resumeRegex: /\bredis\b|\bcaching\b/i },
  { name: 'RabbitMQ / Kafka', domain: 'engineering', jdRegex: /\brabbitmq\b|\bkafka\b/i, resumeRegex: /\brabbitmq\b|\bkafka\b/i },
  { name: 'AWS', domain: 'engineering', jdRegex: /\baws\b|\bamazon\s+web\s+services\b/i, resumeRegex: /\baws\b|\bec2\b|\bs3\b|\blambda\b|\brds\b/i },
  { name: 'Docker', domain: 'engineering', jdRegex: /\bdocker\b|\bcontainers?\b/i, resumeRegex: /\bdocker\b|\bcontainers?\b/i },
  { name: 'Kubernetes', domain: 'engineering', jdRegex: /\bkubernetes\b|\bk8s\b/i, resumeRegex: /\bkubernetes\b|\bk8s\b/i },
  { name: 'Azure', domain: 'engineering', jdRegex: /\bazure\b/i, resumeRegex: /\bazure\b/i },
  { name: 'GCP / Google Cloud', domain: 'engineering', jdRegex: /\bgcp\b|\bgoogle\s+cloud\b/i, resumeRegex: /\bgcp\b|\bgoogle\s+cloud\b/i },
  { name: 'Terraform / IaC', domain: 'engineering', jdRegex: /\bterraform\b|\binfrastructure\s+as\s+code\b/i, resumeRegex: /\bterraform\b|\binfrastructure\s+as\s+code\b/i },
  { name: 'CI/CD', domain: 'engineering', jdRegex: /\bci[\/\-]cd\b/i, resumeRegex: /\bci[\/\-]cd\b|\bgithub\s+actions\b|\bjenkins\b/i },
  { name: 'Linux', domain: 'engineering', jdRegex: /\blinux\b/i, resumeRegex: /\blinux\b/i },
  { name: 'Machine Learning / AI', domain: 'engineering', jdRegex: /\bmachine\s+learning\b|\bdeep\s+learning\b|\bllm\b|\bnlp\b/i, resumeRegex: /\bmachine\s+learning\b|\bdeep\s+learning\b|\bllm\b|\bnlp\b|\bpytorch\b|\btensorflow\b/i },
  { name: 'QA / Automated Testing', domain: 'engineering', jdRegex: /\bqa\b|\bautomated\s+testing\b|\bplaywright\b|\bcypress\b|\bselenium\b/i, resumeRegex: /\bqa\b|\bautomated\s+testing\b|\bplaywright\b|\bcypress\b|\bselenium\b|\bjest\b/i },

  // Sales & Business Development
  { name: 'B2B Sales', domain: 'sales', jdRegex: /\bb2b\s+sales\b|\bb2b\b/i, resumeRegex: /\bb2b(?:\s+sales)?\b|\benterprise\s+sales\b/i },
  { name: 'Enterprise Sales', domain: 'sales', jdRegex: /\benterprise\s+sales\b|\benterprise\s+accounts?\b/i, resumeRegex: /\benterprise\s+sales\b|\benterprise\s+accounts?\b|\benterprise\s+clients?\b/i },
  { name: 'SaaS Sales', domain: 'sales', jdRegex: /\bsaas\s+sales\b|\bsaas\b/i, resumeRegex: /\bsaas\b/i },
  { name: 'Lead Generation & Prospecting', domain: 'sales', jdRegex: /\blead\s+generation\b|\bprospecting\b|\boutbound\b|\bcold\s+calling\b/i, resumeRegex: /\blead\s+generation\b|\bprospecting\b|\boutbound\b|\bcold\s+call(?:ing|s)?\b/i },
  { name: 'Pipeline Management', domain: 'sales', jdRegex: /\bpipeline\s+management\b|\bsales\s+pipeline\b|\bpipeline\b/i, resumeRegex: /\bpipeline\b/i },
  { name: 'Quota Attainment', domain: 'sales', jdRegex: /\bquota\b|\btarget\s+achievement\b|\brevenue\s+targets?\b/i, resumeRegex: /\bquota\b|\brevenue\s+target\b|\barr\b|\bmrr\b/i },
  { name: 'Account Management & Retention', domain: 'sales', jdRegex: /\baccount\s+management\b|\bkey\s+accounts?\b|\brenewals?\b|\bupsell/i, resumeRegex: /\baccount\s+manag(?:er|ement)\b|\bkey\s+accounts?\b|\brenewals?\b|\bupsell|\bcross[- ]sell/i },
  { name: 'Contract Negotiation', domain: 'sales', jdRegex: /\bnegotiation\b|\bcontract\s+closing\b|\bdeal\s+closing\b/i, resumeRegex: /\bnegotiat(?:ion|ed|ing)\b|\bclosed\s+\$|\bclosing\b/i },
  { name: 'Salesforce CRM', domain: 'sales', jdRegex: /\bsalesforce\b/i, resumeRegex: /\bsalesforce\b/i },
  { name: 'HubSpot CRM', domain: 'sales', jdRegex: /\bhubspot\b/i, resumeRegex: /\bhubspot\b/i },
  { name: 'CRM Systems', domain: 'sales', jdRegex: /\bcrm\b/i, resumeRegex: /\bcrm\b|\bsalesforce\b|\bhubspot\b|\bzoho\b|\bpipedrive\b/i },

  // Marketing & Growth
  { name: 'Growth Marketing', domain: 'marketing', jdRegex: /\bgrowth\s+marketing\b|\buser\s+acquisition\b/i, resumeRegex: /\bgrowth\s+marketing\b|\buser\s+acquisition\b|\bcustomer\s+acquisition\b/i },
  { name: 'Demand Generation', domain: 'marketing', jdRegex: /\bdemand\s+gen(?:eration)?\b|\bmql\b|\bsqls?\b/i, resumeRegex: /\bdemand\s+gen(?:eration)?\b|\bmql\b/i },
  { name: 'SEO / SEM', domain: 'marketing', jdRegex: /\bseo\b|\bsem\b|\bsearch\s+engine\s+optimization\b/i, resumeRegex: /\bseo\b|\bsem\b|\bsearch\s+engine\b|\bahrefs\b|\bsemrush\b/i },
  { name: 'Paid Ads (Google / Meta)', domain: 'marketing', jdRegex: /\bgoogle\s+ads\b|\bmeta\s+ads\b|\bppc\b|\bpaid\s+(?:media|search|social|ads)\b|\bperformance\s+marketing\b/i, resumeRegex: /\bgoogle\s+ads\b|\bmeta\s+ads\b|\bfacebook\s+ads\b|\bppc\b|\bpaid\s+(?:media|search|social|ads)\b|\broas\b/i },
  { name: 'Google Analytics / Attribution', domain: 'marketing', jdRegex: /\bgoogle\s+analytics\b|\bga4\b|\battribution\b/i, resumeRegex: /\bgoogle\s+analytics\b|\bga4\b|\bmixpanel\b|\bamplitude\b/i },
  { name: 'Content Strategy & Copywriting', domain: 'marketing', jdRegex: /\bcontent\s+(?:marketing|strategy)\b|\bcopywriting\b/i, resumeRegex: /\bcontent\s+(?:marketing|strategy)\b|\bcopywriting\b/i },
  { name: 'Email & Lifecycle Marketing', domain: 'marketing', jdRegex: /\bemail\s+marketing\b|\blifecycle\s+marketing\b|\bklaviyo\b|\bmailchimp\b/i, resumeRegex: /\bemail\s+marketing\b|\blifecycle\b|\bklaviyo\b|\bmailchimp\b|\bdrip\s+campaigns?\b/i },
  { name: 'Conversion Rate Optimization (CRO)', domain: 'marketing', jdRegex: /\bcro\b|\bconversion\s+rate\s+optimization\b|\ba\/b\s+test/i, resumeRegex: /\bcro\b|\bconversion\s+rate\b|\ba\/b\s+test/i },
  { name: 'Brand & Social Media Marketing', domain: 'marketing', jdRegex: /\bbrand\s+(?:marketing|management|strategy)\b|\bsocial\s+media\b/i, resumeRegex: /\bbrand\s+(?:marketing|management|strategy)\b|\bsocial\s+media\b/i },

  // HR & Talent Acquisition
  { name: 'Talent Acquisition / Recruiting', domain: 'hr', jdRegex: /\btalent\s+acquisition\b|\bfull[- ]cycle\s+recruit|\brecruitment\b/i, resumeRegex: /\btalent\s+acquisition\b|\bfull[- ]cycle\s+recruit|\brecruit(?:ing|ment|ed)\b/i },
  { name: 'Sourcing & Headhunting', domain: 'hr', jdRegex: /\bsourcing\b|\blinkedin\s+recruiter\b|\bnaukri\b|\bheadhunting\b/i, resumeRegex: /\bsourc(?:ing|ed)\b|\blinkedin\s+recruiter\b|\bnaukri\b|\bheadhunting\b/i },
  { name: 'Employee Onboarding & Relations', domain: 'hr', jdRegex: /\bonboarding\b|\bemployee\s+relations\b|\bemployee\s+engagement\b/i, resumeRegex: /\bonboarding\b|\bemployee\s+relations\b|\bemployee\s+engagement\b/i },
  { name: 'HRIS / Workday / BambooHR', domain: 'hr', jdRegex: /\bhris\b|\bworkday\b|\bbamboohr\b|\bzoho\s+people\b|\bkeka\b/i, resumeRegex: /\bhris\b|\bworkday\b|\bbamboohr\b|\bzoho\s+people\b|\bkeka\b|\bdarwinbox\b/i },
  { name: 'Compensation & Benefits / Payroll', domain: 'hr', jdRegex: /\bcompensation\b|\bbenefits\b|\bpayroll\b/i, resumeRegex: /\bcompensation\b|\bbenefits\b|\bpayroll\b/i },
  { name: 'Performance Management', domain: 'hr', jdRegex: /\bperformance\s+management\b|\bappraisals?\b|\bokrs?\b/i, resumeRegex: /\bperformance\s+(?:management|review|appraisal)\b|\bappraisal\b/i },
  { name: 'HR Policy & Labor Compliance', domain: 'hr', jdRegex: /\blabor\s+law\b|\bhr\s+compliance\b|\bstatutory\s+compliance\b|\bposh\b/i, resumeRegex: /\blabor\s+law\b|\bcompliance\b|\bstatutory\b|\bposh\b|\bpolicy\b/i },

  // Finance & Accounting
  { name: 'GAAP / IFRS Accounting', domain: 'finance', jdRegex: /\bgaap\b|\bifrs\b|\bstatutory\s+accounting\b/i, resumeRegex: /\bgaap\b|\bifrs\b|\baccounting\s+standards\b/i },
  { name: 'Financial Modeling & FP&A', domain: 'finance', jdRegex: /\bfinancial\s+modeling\b|\bfp&a\b|\bforecasting\b|\bbudgeting\b/i, resumeRegex: /\bfinancial\s+modeling\b|\bfp&a\b|\bforecast(?:ing)?\b|\bbudget(?:ing)?\b/i },
  { name: 'P&L & Financial Reporting', domain: 'finance', jdRegex: /\bp&l\b|\bbalance\s+sheet\b|\bfinancial\s+reporting\b|\bmonth[- ]end\s+close\b/i, resumeRegex: /\bp&l\b|\bbalance\s+sheet\b|\bfinancial\s+(?:reporting|statements)\b|\bmonth[- ]end\b/i },
  { name: 'Accounts Payable / Receivable', domain: 'finance', jdRegex: /\baccounts\s+payable\b|\baccounts\s+receivable\b|\bap\/ar\b|\binvoicing\b/i, resumeRegex: /\baccounts\s+payable\b|\baccounts\s+receivable\b|\bap\/ar\b|\binvoicing\b/i },
  { name: 'General Ledger & Reconciliation', domain: 'finance', jdRegex: /\bgeneral\s+ledger\b|\breconciliation\b|\bbank\s+reconciliation\b/i, resumeRegex: /\bgeneral\s+ledger\b|\breconcil(?:iation|ed|ing)\b/i },
  { name: 'Taxation & Audit (GST / TDS)', domain: 'finance', jdRegex: /\btax(?:ation)?\b|\baudit\b|\bgst\b|\btds\b|\bcompliance\b/i, resumeRegex: /\btax(?:ation)?\b|\baudit(?:ing|ed)?\b|\bgst\b|\btds\b/i },
  { name: 'QuickBooks / Tally / Zoho Books', domain: 'finance', jdRegex: /\bquickbooks\b|\btally\b|\bxero\b|\bzoho\s+books\b|\bnetsuite\b/i, resumeRegex: /\bquickbooks\b|\btally\b|\bxero\b|\bzoho\s+books\b|\bnetsuite\b/i },
  { name: 'SAP Financials', domain: 'finance', jdRegex: /\bsap\b|\boracle\s+financials\b/i, resumeRegex: /\bsap\b|\boracle\s+financials\b/i },

  // Operations & Management
  { name: 'Operations & Process Optimization', domain: 'operations', jdRegex: /\boperations\s+management\b|\bprocess\s+improvement\b|\bsop\b/i, resumeRegex: /\boperations\b|\bprocess\s+(?:improvement|optimization)\b|\bsop\b/i },
  { name: 'Supply Chain & Logistics', domain: 'operations', jdRegex: /\bsupply\s+chain\b|\blogistics\b|\bfulfillment\b|\bwarehouse\b/i, resumeRegex: /\bsupply\s+chain\b|\blogistics\b|\bfulfillment\b|\bwarehouse\b/i },
  { name: 'Procurement & Vendor Management', domain: 'operations', jdRegex: /\bprocurement\b|\bvendor\s+management\b|\bpurchasing\b/i, resumeRegex: /\bprocurement\b|\bvendor\s+manag(?:ement|ing)\b|\bpurchasing\b|\bsuppliers?\b/i },
  { name: 'Inventory Management', domain: 'operations', jdRegex: /\binventory\b/i, resumeRegex: /\binventory\b/i },
  { name: 'Lean / Six Sigma', domain: 'operations', jdRegex: /\blean\b|\bsix\s+sigma\b|\bkaizen\b/i, resumeRegex: /\blean\b|\bsix\s+sigma\b|\bkaizen\b/i },
  { name: 'SLA & Quality Management', domain: 'operations', jdRegex: /\bsla\b|\bquality\s+control\b|\bquality\s+assurance\b/i, resumeRegex: /\bsla\b|\bquality\s+(?:control|assurance)\b/i },
  { name: 'Project / Program Management', domain: 'operations', jdRegex: /\bproject\s+management\b|\bprogram\s+management\b|\bpmp\b/i, resumeRegex: /\bproject\s+manag(?:er|ement)\b|\bprogram\s+manag(?:er|ement)\b|\bpmp\b/i },

  // Product & Design
  { name: 'Product Strategy & Roadmapping', domain: 'product_design', jdRegex: /\bproduct\s+(?:strategy|roadmap|management)\b|\broadmap\b/i, resumeRegex: /\bproduct\s+(?:strategy|roadmap|management)\b|\broadmap\b/i },
  { name: 'UI / UX Design', domain: 'product_design', jdRegex: /\bui\/ux\b|\bux\s+design\b|\bui\s+design\b|\bdesign\s+systems?\b/i, resumeRegex: /\bui\/ux\b|\bux\s+design\b|\bui\s+design\b|\bdesign\s+systems?\b/i },
  { name: 'Figma & Prototyping', domain: 'product_design', jdRegex: /\bfigma\b|\bprototyping\b|\bwirefram/i, resumeRegex: /\bfigma\b|\bprototyp(?:e|ing)\b|\bwirefram/i },
  { name: 'User Research & Usability Testing', domain: 'product_design', jdRegex: /\buser\s+research\b|\busability\s+testing\b/i, resumeRegex: /\buser\s+research\b|\busability\s+testing\b/i },
  { name: 'Agile / Scrum / Jira', domain: 'product_design', jdRegex: /\bagile\b|\bscrum\b|\bjira\b/i, resumeRegex: /\bagile\b|\bscrum\b|\bjira\b|\blinear\b/i },

  // Universal Business Tools & Capabilities
  { name: 'Excel / Google Sheets', domain: 'universal', jdRegex: /\bexcel\b|\bgoogle\s+sheets\b|\bspreadsheets?\b|\bpivot\s+tables?\b/i, resumeRegex: /\bexcel\b|\bgoogle\s+sheets\b|\bspreadsheets?\b|\bvlookup\b|\bpivot\b/i },
  { name: 'SQL / Data Analysis', domain: 'universal', jdRegex: /\bdata\s+analysis\b|\bpower\s+bi\b|\btableau\b/i, resumeRegex: /\bdata\s+analysis\b|\bpower\s+bi\b|\btableau\b|\blooker\b/i },
  { name: 'Stakeholder Management', domain: 'universal', jdRegex: /\bstakeholder\s+management\b|\bcross[- ]functional\b/i, resumeRegex: /\bstakeholder\b|\bcross[- ]functional\b/i },
  { name: 'Team Leadership & Mentoring', domain: 'universal', jdRegex: /\bteam\s+leadership\b|\bpeople\s+management\b|\bmanage\s+a\s+team\b/i, resumeRegex: /\bled\s+a\s+team\b|\bmanaged\s+\d+|\bmentored\b|\bteam\s+lead/i },
  { name: 'Client Relationship Management', domain: 'universal', jdRegex: /\bclient\s+relationship\b|\bclient\s+facing\b|\bcustomer\s+success\b/i, resumeRegex: /\bclient\s+(?:relationship|facing|retention)\b|\bcustomer\s+success\b/i },
];

const STOPWORDS = new Set([
  'with', 'that', 'this', 'from', 'have', 'will', 'your', 'about', 'into', 'across', 'their', 'they',
  'what', 'when', 'where', 'which', 'while', 'were', 'been', 'being', 'more', 'most', 'some', 'such',
  'than', 'then', 'them', 'these', 'those', 'very', 'well', 'work', 'working', 'role', 'team', 'years',
  'year', 'experience', 'required', 'preferred', 'skills', 'must', 'strong', 'good', 'excellent', 'ability',
  'including', 'looking', 'candidate', 'company', 'business', 'responsibilities', 'requirements',
  'qualifications', 'job', 'description', 'join', 'help', 'ensure', 'support', 'drive', 'build', 'using',
]);

// ============================================================================
// STRICT VERBATIM QUOTE VERIFICATION & SANITIZATION (KILLS "UTER JUTER" TEXT)
// ============================================================================

const JUNK_LINE_RE =
  /(@|https?:\/\/|www\.|linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com|\+?\d[\d\s\-().]{7,}\d|i\s+hereby\s+declare|declaration|references\s+available|date\s+of\s+birth|\bdob\b|marital\s+status|nationality\s*:|father'?s\s+name|permanent\s+address|languages\s+known|hobbies\s*:|curriculum\s+vitae|resume\s*$)/i;

const SECTION_HEADER_ONLY_RE =
  /^(professional\s+summary|executive\s+summary|career\s+objective|objective|work\s+experience|professional\s+experience|experience|employment\s+history|technical\s+skills|core\s+competencies|skills|education|academic\s+qualifications|certifications|projects|key\s+achievements|achievements|awards|references|declaration|contact|profile)$/i;

const SKILL_DUMP_PREFIX_RE =
  /^(languages|databases|cloud|frameworks|tools|technologies|tech\s+stack|core\s+skills|skills|competencies|software|platforms|certifications)\s*:/i;

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

  // Reject bare university / degree / date lines without work achievement context
  if (
    /^(b\.?tech|b\.?e|m\.?tech|b\.?sc|m\.?sc|b\.?com|m\.?com|bba|mba|bachelor|master|high\s+school|university|institute)\b/i.test(
      clean
    ) &&
    clean.length < 75 &&
    !/\b(led|built|architected|managed|increased|reduced|closed|launched|grew|won|%|\$)\b/i.test(clean)
  ) {
    return true;
  }

  // Reject contact / location / pure uppercase header lines
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
  // Try ending cleanly at a period/semicolon inside window
  const slice = clean.slice(0, maxLen);
  const lastPeriod = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('; '));
  if (lastPeriod >= 55) {
    return slice.slice(0, lastPeriod + 1).trim();
  }
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace >= 50 ? slice.slice(0, lastSpace) : slice;
  return cut.replace(/[,:;\-\s]+$/, '').trim() + '...';
}

export function extractCleanResumeSegments(resumeText: string): string[] {
  const raw = String(resumeText || '').trim();
  if (!raw) return [];

  // Split by newlines, bullet symbols, pipes, and sentence boundaries
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
      // Split overly long paragraph blocks on sentence boundaries
      const subSentences = chunk
        .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
        .map((s) => cleanQuoteSurface(s))
        .filter((s) => s.length >= 24 && !isJunkQuote(s));
      if (subSentences.length > 0) {
        for (const sub of subSentences) {
          segments.push(smartTruncateComplete(sub, 165));
        }
      } else if (!isJunkQuote(chunk)) {
        segments.push(smartTruncateComplete(chunk, 165));
      }
    }
  }

  // Deduplicate by normalized prefix
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

const IMPACT_METRIC_RE =
  /(\d+(?:\.\d+)?%|[$₹€£]\s?\d+(?:[.,]\d+)?[kKmMbB]?|\b\d+(?:\.\d+)?[kKmMbB]\+?|\b\d+(?:\.\d+)?x\b|\b\d+\+?\s*(?:users|clients|customers|accounts|deals|leads|candidates|hires|engineers|employees|services|requests|orders|projects|campaigns|calls|meetings|hours|days|months|qps|rps|ms))/i;

const ACTION_VERB_RE =
  /\b(spearheaded|architected|built|developed|optimized|reduced|increased|grew|closed|generated|negotiated|exceeded|delivered|shipped|managed|led|launched|designed|scaled|reconciled|audited|recruited|hired|streamlined|automated|improved|drove|owned|implemented)\b/i;

/**
 * Verifies AI-proposed quotes against the real resume text and fills missing slots
 * with top-ranked verbatim achievement lines from the resume.
 */
export function sanitizeAndVerifyQuotes(
  candidateQuotes: unknown,
  resumeText: string,
  matchedSkills: string[] = [],
  jobDescription: string = ''
): string[] {
  const safeResume = String(resumeText || '').trim();
  if (!safeResume) return [];

  const normalizedResume = normalizeMatchText(safeResume);
  const cleanSegments = extractCleanResumeSegments(safeResume);
  const jdLower = String(jobDescription || '').toLowerCase();
  const jdWords = jdLower
    .split(/[^a-z0-9+#/]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  const jdWordSet = new Set(jdWords);

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

  // 1. Validate AI-returned quotes strictly against resumeText
  if (Array.isArray(candidateQuotes)) {
    for (const rawItem of candidateQuotes) {
      if (typeof rawItem !== 'string') continue;
      const cleaned = cleanQuoteSurface(rawItem);
      if (isJunkQuote(cleaned)) continue;

      const normQuote = normalizeMatchText(cleaned);
      if (!normQuote || normQuote.length < 20) continue;

      // Check direct normalized substring presence (strip trailing "..." if any)
      const coreNorm = normQuote.replace(/\.\.\.$/, '').trim();
      if (normalizedResume.includes(coreNorm)) {
        pushUnique(cleaned);
        if (verified.length >= 4) break;
        continue;
      }

      // Check high word overlap against real segments -> snap back to exact verbatim line
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

  // 2. Rank & fill from actual clean resume lines so we always have 2-4 crisp verbatim quotes
  if (verified.length < 3 && cleanSegments.length > 0) {
    const skillTokens = matchedSkills
      .flatMap((s) => s.toLowerCase().split(/[\/,&()]+/))
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);

    const scoredSegments = cleanSegments.map((seg, idx) => {
      let rank = 0;
      const lower = seg.toLowerCase();
      if (IMPACT_METRIC_RE.test(seg)) rank += 6;
      if (ACTION_VERB_RE.test(seg)) rank += 3;
      if (skillTokens.some((sk) => lower.includes(sk))) rank += 4;
      const jdHits = seg
        .toLowerCase()
        .split(/[^a-z0-9+#/]+/)
        .filter((w) => w.length >= 4 && jdWordSet.has(w)).length;
      rank += Math.min(4, jdHits * 1.5);
      if (seg.length >= 45 && seg.length <= 145) rank += 2;
      return { seg, rank, idx };
    });

    scoredSegments.sort((a, b) => b.rank - a.rank || a.idx - b.idx);

    for (const item of scoredSegments) {
      pushUnique(item.seg);
      if (verified.length >= 4) break;
    }
  }

  // 3. Last-resort fallback for ultra-short resumes
  if (verified.length === 0) {
    const fallbackLine = safeResume
      .split(/[\r\n]+/)
      .map((l) => cleanQuoteSurface(l))
      .find((l) => l.length >= 18 && !JUNK_LINE_RE.test(l));
    if (fallbackLine) {
      verified.push(smartTruncateComplete(fallbackLine, 140));
    }
  }

  return verified.slice(0, 4);
}

// ============================================================================
// DYNAMIC JD REQUIREMENT EXTRACTOR (CATCHES DOMAIN-SPECIFIC NON-TECH TERMS)
// ============================================================================

function extractDynamicJdRequirements(jobDescription: string, alreadyTracked: Set<string>): string[] {
  const safeJD = String(jobDescription || '');
  const extracted: string[] = [];
  const seen = new Set<string>(Array.from(alreadyTracked).map((s) => s.toLowerCase()));

  // Mine uppercase/mixed-case acronyms & certifications (e.g., CPA, SHRM, PMP, ERP, GAAP, GST, B2B)
  const acronymMatches =
    safeJD.match(/\b(CPA|CFA|CMA|SHRM|PHR|SPHR|PMP|MBA|CA|GAAP|IFRS|GST|TDS|SOP|SLA|OKR|KPI|ERP|CRM|ROAS|CAC|LTV|ARR|MRR|FDA|ISO)\b/g) ||
    [];
  for (const ac of acronymMatches) {
    const norm = ac.toUpperCase();
    if (!seen.has(norm.toLowerCase())) {
      seen.add(norm.toLowerCase());
      extracted.push(norm);
    }
  }

  // Mine explicit short phrases after requirement triggers
  const phraseMatches =
    safeJD.matchAll(
      /(?:proficiency\s+in|experience\s+(?:with|in)|knowledge\s+of|certified\s+in|expertise\s+in|must\s+have)\s+([A-Za-z0-9&/+,\-\s]{3,45}?)(?=[.\r\n;]|$)/gi
    ) || [];

  for (const match of phraseMatches) {
    const rawList = String(match[1] || '').split(/,|\band\b|\bor\b/i);
    for (const part of rawList) {
      const clean = part
        .replace(/^(a|an|the|strong|proven|solid|working|hands[- ]on)\s+/i, '')
        .trim();
      const words = clean.split(/\s+/);
      if (
        clean.length >= 3 &&
        clean.length <= 32 &&
        words.length <= 4 &&
        !STOPWORDS.has(clean.toLowerCase()) &&
        !seen.has(clean.toLowerCase())
      ) {
        // Avoid duplicating skills already matched semantically
        const alreadyCovered = Array.from(seen).some(
          (s) => s.includes(clean.toLowerCase()) || clean.toLowerCase().includes(s.split('/')[0].trim())
        );
        if (!alreadyCovered) {
          seen.add(clean.toLowerCase());
          extracted.push(clean);
        }
      }
      if (extracted.length >= 5) break;
    }
    if (extracted.length >= 5) break;
  }

  return extracted.slice(0, 5);
}

// ============================================================================
// SERVER OUTPUT POST-VALIDATOR & SANITIZER
// ============================================================================

export function sanitizeEvaluationResult(
  rawEval: any,
  jobDescription: string,
  resumeText: string,
  candidateName?: string,
  strictnessMode: string = 'standard'
): EvaluationResult {
  const domainCtx = detectRoleDomain(jobDescription);
  const safeResume = String(resumeText || '').trim();

  const hardReq = Math.max(0, Math.min(40, Math.round(Number(rawEval?.score_breakdown?.hard_requirements ?? 0))));
  const domainDepth = Math.max(0, Math.min(30, Math.round(Number(rawEval?.score_breakdown?.domain_depth ?? 0))));
  const verifiableEv = Math.max(0, Math.min(30, Math.round(Number(rawEval?.score_breakdown?.verifiable_evidence ?? 0))));

  let total = hardReq + domainDepth + verifiableEv;
  if (total === 0 && typeof rawEval?.score === 'number' && rawEval.score > 0) {
    total = Math.max(0, Math.min(100, Math.round(rawEval.score)));
  }
  total = Math.max(0, Math.min(100, total));

  let recommendation: 'Strong Fit' | 'Qualified' | 'Marginal / Borderline' | 'Unqualified';
  if (total >= 85) recommendation = 'Strong Fit';
  else if (total >= 70) recommendation = 'Qualified';
  else if (total >= 50) recommendation = 'Marginal / Borderline';
  else recommendation = 'Unqualified';

  // Deduplicate matched vs missing skills
  const matchedRaw: string[] = Array.isArray(rawEval?.matched_skills)
    ? rawEval.matched_skills.map((s: any) => String(s || '').trim()).filter(Boolean)
    : [];
  const matchedSet = new Set(matchedRaw.map((s) => s.toLowerCase()));

  const missingRaw: string[] = Array.isArray(rawEval?.missing_skills)
    ? rawEval.missing_skills
        .map((s: any) => String(s || '').trim())
        .filter((s: string) => Boolean(s) && !matchedSet.has(s.toLowerCase()))
    : [];

  // Programmatically verify & sanitize all quotes against actual resume text
  const candidateQuotesInput = [
    ...(Array.isArray(rawEval?.key_quotes) ? rawEval.key_quotes : []),
    ...(Array.isArray(rawEval?.verifiable_evidence) ? rawEval.verifiable_evidence : []),
  ];
  const verifiedQuotes = sanitizeAndVerifyQuotes(candidateQuotesInput, safeResume, matchedRaw, jobDescription);

  const pros: string[] = Array.isArray(rawEval?.pros)
    ? rawEval.pros.map((p: any) => String(p || '').trim()).filter(Boolean).slice(0, 3)
    : [];
  while (pros.length < 3) {
    if (pros.length === 0 && matchedRaw.length > 0) {
      pros.push(`Demonstrates documented alignment on key requirements: ${matchedRaw.slice(0, 3).join(', ')}.`);
    } else if (pros.length === 1 && verifiedQuotes[0]) {
      pros.push(`Verifiable track record highlighted in resume: "${verifiedQuotes[0]}".`);
    } else {
      pros.push(`Shows baseline background relevant to ${domainCtx.domainLabel.toLowerCase()} workflows.`);
    }
  }

  const resumeMetrics = safeResume.match(new RegExp(IMPACT_METRIC_RE.source, 'gi')) || [];
  const falseMetricClaimRe =
    /\b(not\s+quantified|unquantified|could\s+be\s+(?:further\s+)?quantified|lacks?\s+(?:quantif\w*|metrics|throughput|concrete\s+numbers)|no\s+(?:quantif\w*|metrics|numbers|throughput)|missing\s+(?:quantif\w*|metrics))\b/i;

  const rawCons: string[] = Array.isArray(rawEval?.cons)
    ? rawEval.cons.map((c: any) => String(c || '').trim()).filter(Boolean).slice(0, 3)
    : [];
  const cons: string[] = rawCons.map((conText) => {
    if (resumeMetrics.length >= 2 && falseMetricClaimRe.test(conText)) {
      if (missingRaw.length > 0) {
        return `Requires targeted verification on JD gaps not evidenced in work history (${missingRaw.slice(0, 2).join(', ')}).`;
      }
      return `Verify direct individual ownership behind reported production metrics (${resumeMetrics.slice(0, 2).join(', ')}) during interview.`;
    }
    return conText;
  });
  while (cons.length < 3) {
    if (cons.length === 0 && missingRaw.length > 0) {
      cons.push(`No explicit evidence found for target requirements: ${missingRaw.slice(0, 3).join(', ')}.`);
    } else if (cons.length === 1) {
      cons.push(`Quantifiable ownership and independent scope for ${domainCtx.roleTitle} should be verified in interview.`);
    } else {
      cons.push(`Requires validation on day-one readiness under ${strictnessMode} calibration standards.`);
    }
  }

  const fallbackName = String(candidateName || '').trim() || 'Candidate';
  const rawName = String(rawEval?.candidate_name || '').trim();
  const resolvedName =
    !rawName || ['unknown', 'candidate name', 'n/a', 'none'].includes(rawName.toLowerCase())
      ? fallbackName
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
      `${resolvedName} scored ${total}/100 (${recommendation}) for ${domainCtx.roleTitle} based on verified evidence across mandatory criteria (${hardReq}/40), role depth (${domainDepth}/30), and measurable outcomes (${verifiableEv}/30).`,
    rubric_analysis: {
      hard_requirements_notes:
        String(rawEval?.rubric_analysis?.hard_requirements_notes || '').trim() ||
        `Hard Requirements evaluated at ${hardReq}/40 against ${domainCtx.roleTitle} prerequisites.`,
      domain_depth_notes:
        String(rawEval?.rubric_analysis?.domain_depth_notes || '').trim() ||
        `Role & Domain Depth evaluated at ${domainDepth}/30 within ${domainCtx.domainLabel}.`,
      verifiable_evidence_notes:
        String(rawEval?.rubric_analysis?.verifiable_evidence_notes || '').trim() ||
        `Verifiable Evidence scored ${verifiableEv}/30 based on concrete metrics and verified resume citations.`,
    },
    recommendation,
    key_quotes: verifiedQuotes,
    verifiable_evidence: verifiedQuotes,
    evaluated_at: new Date().toISOString(),
  };
}

// ============================================================================
// CLIENT & SERVER MULTI-DOMAIN HEURISTIC EVALUATOR (OFFLINE / NO-KEY FALLBACK)
// ============================================================================

export function evaluateWithHeuristicRubric(
  jobDescription: string,
  resumeText: string,
  candidateName?: string,
  strictnessMode: string = 'standard'
): EvaluationResult {
  const safeJD = String(jobDescription || '').trim();
  const safeResume = String(resumeText || '').trim();
  const domainCtx = detectRoleDomain(safeJD);
  const resumeLower = safeResume.toLowerCase();

  // 1. Resolve Candidate Name safely
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

  // 2. Match Multi-Domain Canonical Skills Demanded in Job Description
  const matched_skills: string[] = [];
  const missing_skills: string[] = [];

  const hasAwsOrCloud = /\b(aws|amazon\s+web\s+services|ec2|s3|lambda|kubernetes|docker)\b/i.test(safeResume);

  for (const skill of CANONICAL_SKILLS) {
    if (skill.jdRegex.test(safeJD)) {
      if (skill.resumeRegex.test(safeResume)) {
        matched_skills.push(skill.name);
      } else {
        if (
          (skill.name === 'Azure' || skill.name === 'GCP / Google Cloud') &&
          hasAwsOrCloud &&
          !/must\s+have\s+(?:azure|gcp)|mandatory.*(?:azure|gcp)|strictly\s+(?:azure|gcp)/i.test(safeJD)
        ) {
          continue;
        }
        if (skill.name === 'SQL / Databases' && /\b(postgres|postgresql|mysql|sql)\b/i.test(safeResume)) {
          matched_skills.push(skill.name);
          continue;
        }
        missing_skills.push(skill.name);
      }
    }
  }

  // Mine custom/niche skills mentioned in JD (especially helpful for specialized non-tech roles)
  const trackedSet = new Set([...matched_skills, ...missing_skills]);
  const dynamicReqs = extractDynamicJdRequirements(safeJD, trackedSet);
  for (const req of dynamicReqs) {
    const escaped = req.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(safeResume)) {
      matched_skills.push(req);
    } else {
      missing_skills.push(req);
    }
  }

  // General JD-to-Resume keyword overlap check (prevents false highs when completely wrong profession is uploaded)
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

  // Detect severe cross-domain mismatch
  const resumeDomainCtx = detectRoleDomain(safeResume);
  const isCrossDomainMismatch =
    matched_skills.length === 0 &&
    jdOverlapRatio < 0.12 &&
    domainCtx.domain !== 'general' &&
    resumeDomainCtx.domain !== 'general' &&
    resumeDomainCtx.domain !== domainCtx.domain;

  // If no explicit JD canonical/dynamic skills were parsed at all, surface domain skills present in resume (only if same domain)
  if (matched_skills.length === 0 && missing_skills.length === 0 && !isCrossDomainMismatch) {
    for (const skill of CANONICAL_SKILLS) {
      if ((skill.domain === domainCtx.domain || skill.domain === 'universal') && skill.resumeRegex.test(safeResume)) {
        matched_skills.push(skill.name);
        if (matched_skills.length >= 6) break;
      }
    }
  }

  // 3. Extract SHORT, CLEAN, VERBATIM Verifiable Quotes (Zero Junk!)
  const finalQuotes = sanitizeAndVerifyQuotes([], safeResume, matched_skills, safeJD);

  // 4. PARAMETER 1: HARD REQUIREMENTS (0 to 40 pts)
  const totalTrackedReqs = matched_skills.length + missing_skills.length;
  const matchRatio =
    totalTrackedReqs > 0 ? matched_skills.length / totalTrackedReqs : Math.min(0.85, jdOverlapRatio * 2.2);

  let baseSkillPts = Math.round(matchRatio * 26);
  if (strictnessMode === 'strict') {
    baseSkillPts = Math.max(0, baseSkillPts - missing_skills.length * 4);
  } else if (strictnessMode === 'lenient') {
    baseSkillPts = Math.min(28, baseSkillPts + 4);
  }

  const expMatch = resumeLower.match(/(\d+)\+?\s*years?(?:\s+of)?\s+(?:experience|exp|in|working)/);
  const yearsExp = expMatch ? parseInt(expMatch[1], 10) : safeResume.length > 1000 ? 4 : 2;
  const expPts = isCrossDomainMismatch ? 2 : Math.min(8, Math.round(yearsExp * 1.3));

  const hasDegree =
    /\b(bachelor|b\.?s|bs|b\.?tech|b\.?e|b\.?com|bba|master|m\.?s|ms|m\.?tech|mba|m\.?com|cpa|cfa|ca\b|shrm|pmp|phd|degree)\b/i.test(
      safeResume
    );
  const degreePts = hasDegree ? (isCrossDomainMismatch ? 2 : 4) : 2;

  let hardReqScore = Math.max(0, Math.min(40, baseSkillPts + expPts + degreePts));

  // 5. PARAMETER 2: ROLE & DOMAIN DEPTH (0 to 30 pts)
  const seniorityTiers = [
    { words: ['vp ', 'vice president', 'head of', 'principal', 'staff', 'director', 'architect'], pts: 10 },
    { words: ['senior', 'sr.', 'lead', 'manager'], pts: 8 },
    { words: ['associate', 'specialist', 'executive', 'analyst', 'engineer', 'coordinator'], pts: 6 },
  ];
  let seniorityPts = 5;
  for (const tier of seniorityTiers) {
    if (tier.words.some((w) => resumeLower.includes(w))) {
      seniorityPts = tier.pts;
      break;
    }
  }

  const domainDepthWords = DOMAIN_CONFIG[domainCtx.domain].depthKeywords;
  const depthHits = domainDepthWords.filter((w) => resumeLower.includes(w)).length;
  const depthPts = Math.min(12, Math.round(depthHits * 2.2));

  let alignmentBaseline = strictnessMode === 'strict' ? 4 : 6;
  if (strictnessMode === 'lenient') alignmentBaseline += 2;
  if (strictnessMode === 'strict' && missing_skills.length > 2) alignmentBaseline = Math.max(0, alignmentBaseline - 3);
  if (jdOverlapRatio >= 0.25) alignmentBaseline += 2;

  let domainDepthScore = Math.max(0, Math.min(30, seniorityPts + depthPts + alignmentBaseline));

  // 6. PARAMETER 3: VERIFIABLE EVIDENCE (0 to 30 pts)
  const metricMatches = safeResume.match(new RegExp(IMPACT_METRIC_RE.source, 'gi')) || [];
  let metricPts = Math.min(16, metricMatches.length * 4);
  if (strictnessMode === 'strict' && metricMatches.length === 0) {
    metricPts = 0;
  }

  const actionVerbs = [
    'spearheaded',
    'architected',
    'optimized',
    'reduced',
    'increased',
    'grew',
    'closed',
    'generated',
    'negotiated',
    'exceeded',
    'developed',
    'delivered',
    'shipped',
    'managed',
    'led',
    'launched',
    'mentored',
    'reconciled',
    'audited',
    'recruited',
    'hired',
    'implemented',
  ];
  const verbHits = actionVerbs.filter((v) => resumeLower.includes(v)).length;
  const verbPts = Math.min(8, Math.round(verbHits * 1.5));

  const credPts = metricMatches.length > 0 || hasDegree ? 5 : 2;
  const textHash = Math.abs(parseInt(hashString(safeResume), 10));
  const subtleVariance = (textHash % 3) - 1;

  let evidenceScore = Math.max(0, Math.min(30, metricPts + verbPts + credPts + subtleVariance));

  // Apply realistic cap when resume belongs to an unrelated occupation / field
  if (isCrossDomainMismatch || (totalTrackedReqs >= 3 && matched_skills.length === 0 && jdOverlapRatio < 0.14)) {
    hardReqScore = Math.min(hardReqScore, 12);
    domainDepthScore = Math.min(domainDepthScore, 10);
    evidenceScore = Math.min(evidenceScore, 14);
  }

  // 7. TOTAL SCORE & RECOMMENDATION
  const totalScore = Math.max(0, Math.min(100, hardReqScore + domainDepthScore + evidenceScore));

  let recommendation: 'Strong Fit' | 'Qualified' | 'Marginal / Borderline' | 'Unqualified';
  if (totalScore >= 85) recommendation = 'Strong Fit';
  else if (totalScore >= 70) recommendation = 'Qualified';
  else if (totalScore >= 50) recommendation = 'Marginal / Borderline';
  else recommendation = 'Unqualified';

  // 8. ROLE-AUTHENTIC PROS, CONS & NOTES (Zero Tech Jargon on Non-Tech Roles!)
  const pros: string[] = [
    matched_skills.length > 0
      ? `Verified alignment on key ${domainCtx.domainLabel.toLowerCase()} requirements: ${matched_skills.slice(0, 4).join(', ')}.`
      : isCrossDomainMismatch
      ? `Shows transferable professional experience in ${resumeDomainCtx.domainLabel.toLowerCase()}, though outside the target role.`
      : `Solid foundational competencies aligned with core ${domainCtx.roleTitle} expectations.`,
    metricMatches.length > 0
      ? `Documented quantifiable outcomes in resume text: ${metricMatches.slice(0, 3).join(', ')}.`
      : finalQuotes[0]
      ? `Direct track record cited: "${smartTruncateComplete(finalQuotes[0], 95)}".`
      : `Demonstrates structured execution history across prior ${domainCtx.domainLabel.toLowerCase()} responsibilities.`,
    seniorityPts >= 8
      ? `Senior-level ownership and leadership track record relevant to ${domainCtx.roleTitle}.`
      : `Adaptable background with capacity to contribute across ${domainCtx.domainLabel.toLowerCase()} deliverables.`,
  ];

  const cons: string[] = [
    missing_skills.length > 0
      ? `Missing explicit documentation for target JD requirements: ${missing_skills.slice(0, 3).join(', ')}.`
      : isCrossDomainMismatch
      ? `Primary career background (${resumeDomainCtx.domainLabel}) does not match mandatory ${domainCtx.roleTitle} prerequisites.`
      : `Requires targeted interview validation on edge-case execution within ${domainCtx.roleTitle}.`,
    metricMatches.length < 2
      ? 'Limited quantifiable performance metrics or KPIs provided to substantiate claimed impact.'
      : `Verify individual ownership vs. team-wide contribution behind reported metrics (${metricMatches[0]}).`,
    strictnessMode === 'strict'
      ? `Does not fulfill 100% of strict ${domainCtx.roleTitle} criteria without targeted onboarding.`
      : `Scope complexity and day-one autonomy in ${domainCtx.domainLabel.toLowerCase()} require interview verification.`,
  ];

  const rank_reasoning = isCrossDomainMismatch
    ? `Candidate scored ${totalScore}/100 (${recommendation}) due to a primary domain mismatch between their ${resumeDomainCtx.domainLabel} background and the ${domainCtx.roleTitle} requirements. Hard requirements scored ${hardReqScore}/40, role depth ${domainDepthScore}/30, and verifiable evidence ${evidenceScore}/30.`
    : `Candidate scored ${totalScore}/100 under ${strictnessMode} calibration for ${domainCtx.roleTitle} with ${matched_skills.length} confirmed skill matches. Hard requirements evaluated at ${hardReqScore}/40, role & domain depth at ${domainDepthScore}/30, and verifiable evidence at ${evidenceScore}/30.`;

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
    pros,
    cons,
    rank_reasoning,
    rubric_analysis: {
      hard_requirements_notes: `Candidate matches ${matched_skills.length} of ${Math.max(matched_skills.length + missing_skills.length, 1)} tracked ${domainCtx.domainLabel.toLowerCase()} requirements (${hardReqScore}/40).`,
      domain_depth_notes: `Work history shows ${depthHits} domain-depth indicators for ${domainCtx.roleTitle} (${domainDepthScore}/30).`,
      verifiable_evidence_notes: `Resume contains ${metricMatches.length} quantifiable metrics and ${finalQuotes.length} verified textual citations (${evidenceScore}/30).`,
    },
    recommendation,
    key_quotes: finalQuotes,
    verifiable_evidence: finalQuotes,
    evaluated_at: new Date().toISOString(),
  };
}

// ============================================================================
// ROLE-AWARE FALLBACK INTERVIEW QUESTIONS (TECH + NON-TECH)
// ============================================================================

export function buildFallbackInterviewQuestions(params: {
  jobDescription: string;
  pros?: string[];
  cons?: string[];
  matched_skills?: string[];
  missing_skills?: string[];
}): InterviewQuestion[] {
  const ctx = detectRoleDomain(params.jobDescription || '');
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
        caution:
          'Watch for high-level buzzwords without hands-on ownership or inability to explain failure modes.',
      },
      {
        type: 'con_gap_probe',
        badge: 'Q2 • Probing Missing Requirement (Con)',
        targetPoint: topCon1,
        question: `Regarding "${topCon1}" — what is the closest hands-on work you have done in adjacent tools or workflows, and how would you close this gap in your first 30 days?`,
        idealAnswer:
          'Look for honest self-awareness, accurate explanation of transferable fundamentals, and a structured ramp-up plan.',
        caution:
          'Be wary of candidates overclaiming tutorial familiarity as production mastery or getting defensive about gaps.',
      },
      {
        type: 'con_risk_probe',
        badge: 'Q3 • Probing Risk & Trade-offs (Con)',
        targetPoint: topCon2,
        question: `Thinking about "${topCon2}", tell me about a high-stakes production trade-off where you had to balance delivery speed, reliability, and maintainability.`,
        idealAnswer:
          'Clear trade-off reasoning, measurable risk mitigation, monitoring/testing discipline, and pragmatic business alignment.',
        caution:
          'Watch out for over-engineering without business context or dismissing operational reliability.',
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
      caution:
        'Watch for taking credit for company-wide results without being able to explain their specific day-to-day actions.',
    },
    {
      type: 'con_gap_probe',
      badge: 'Q2 • Probing Role Gap (Con)',
      targetPoint: topCon1,
      question: `In "${ctx.roleTitle}", "${topCon1}" is important. What is the closest real-world situation you have handled, and how would you ramp up quickly here?`,
      idealAnswer:
        'Candid acknowledgment of where their experience stops, strong transferable examples from prior roles, and a realistic 30-day execution plan.',
      caution:
        'Red flag if they bluff through missing domain workflows or give vague textbook answers instead of real examples.',
    },
    {
      type: 'con_risk_probe',
      badge: 'Q3 • Probing Execution & Judgment (Con)',
      targetPoint: topCon2,
      question: `Around "${topCon2}", tell me about a tough deadline, difficult stakeholder, or missed target—what decisions did you make and what would you do differently next time?`,
      idealAnswer:
        'Accountability without blaming others, data-informed prioritization under pressure, clear stakeholder communication, and concrete process improvements.',
      caution:
        'Watch for deflection of blame, buzzword-heavy storytelling without measurable outcomes, or rigid thinking.',
    },
  ];
}
