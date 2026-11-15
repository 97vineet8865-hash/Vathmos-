export interface ScoreBreakdown {
  hard_requirements: number; // 0-40 pts: Direct mandatory skills & experience
  domain_depth: number; // 0-30 pts: Relevance of roles & projects
  verifiable_evidence: number; // 0-30 pts: Clear achievements & concrete details
  total: number; // 0-100 pts
}

export interface RubricAnalysis {
  hard_requirements_notes: string;
  domain_depth_notes: string;
  verifiable_evidence_notes: string;
}

export interface InterviewQuestion {
  type: 'pro_verification' | 'con_gap_probe' | 'con_risk_probe';
  badge: string;
  targetPoint: string;
  question: string;
  idealAnswer: string;
  caution: string;
}

export interface EvaluationResult {
  score: number; // 0-100 total score
  score_breakdown: ScoreBreakdown;
  matched_skills: string[];
  missing_skills: string[];
  pros: string[]; // Exactly 3 strengths
  cons: string[]; // Exactly 3 gaps
  rank_reasoning: string; // Exactly 2 sentences
  rubric_analysis?: RubricAnalysis;
  recommendation: 'Strong Fit' | 'Qualified' | 'Marginal / Borderline' | 'Unqualified';
  key_quotes?: string[];
  verifiable_evidence?: string[];
  candidate_name?: string;
  evaluated_at?: string;
  interview_questions?: InterviewQuestion[];
}

export interface CandidateItem {
  id: string;
  name: string;
  resumeText: string;
  fileName?: string;
  status: 'idle' | 'evaluating' | 'completed' | 'error';
  result?: EvaluationResult;
  error?: string;
  isDuplicateContent?: boolean;
  duplicateOfName?: string;
}

export interface WhiteLabelConfig {
  enabled: boolean;
  companyName: string;
  logoDataUrl?: string;
  tagline?: string;
  contactEmail?: string;
  website?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  companyName: string;
  role: string;
  joinedAt: string;
  avatarColor: string;
  isEmailVerified?: boolean;
  tier?: 'free' | 'starter' | 'pro' | 'agency';
  evaluationsLimit?: number;
  evaluationsUsed?: number;
  interviewQuestionsLimit?: number;
  interviewQuestionsUsed?: number;
  razorpayPaymentId?: string;
  hasSeenOnboardingPlans?: boolean;
  whiteLabel?: WhiteLabelConfig;
}

export interface StoredUserAccount {
  id: string;
  name: string;
  email: string;
  companyName: string;
  role: string;
  joinedAt: string;
  avatarColor: string;
  salt: string;
  passwordHash: string;
  isEmailVerified: boolean;
  verificationCode?: string;
  verificationCodeExpires?: number;
}

export interface FeedbackItem {
  id: string;
  createdAt: string;
  type: 'bug' | 'feature' | 'general';
  description: string;
  userEmail: string;
  userName: string;
  status: 'new' | 'investigating' | 'resolved';
  adminNotes?: string;
  telemetry?: {
    userAgent?: string;
    evaluatedCandidatesCount?: number;
    activeRole?: string;
    screenResolution?: string;
  };
}

