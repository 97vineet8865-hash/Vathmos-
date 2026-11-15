import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  LogOut,
  Check,
  Building2,
  Briefcase,
  Mail,
  Calendar,
  ShieldCheck,
  Award,
  Edit2,
  Save,
  Bot,
  Send,
  Sparkles,
  Bug,
  MessageSquare,
  Loader2,
  ChevronDown,
  Inbox,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  Settings,
  RefreshCw,
  CreditCard,
  Zap,
  Lock,
  Image,
  Globe,
  Palette,
  Eye,
  Database,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CandidateItem, FeedbackItem } from '../types';
import { openRazorpayCheckout, TIERS } from '../utils/razorpayService';
import { isSupabaseConfigured, syncProfileToSupabase, checkBackendSupabaseStatus } from '../lib/supabaseClient';
import { detectRoleDomain } from '../utils/clientRubricEvaluator';

interface ProfileModalProps {
  candidates?: CandidateItem[];
  jobDescription?: string;
}

const COLOR_OPTIONS = [
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#0EA5E9', // Sky Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F59E0B', // Amber
];

const ADMIN_EMAILS = ['vathmossupport@gmail.com'];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  candidates = [],
  jobDescription = '',
}) => {
  const { currentUser, isProfileModalOpen, closeProfileModal, updateProfile, upgradeTier, updateWhiteLabel, signOut, openAuthModal, token } =
    useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [companyName, setCompanyName] = useState(currentUser?.companyName || '');
  const [role, setRole] = useState(currentUser?.role || '');
  const [selectedColor, setSelectedColor] = useState(currentUser?.avatarColor || '#6366F1');

  const [showUpgradePlans, setShowUpgradePlans] = useState(false);
  const [upgradeNotification, setUpgradeNotification] = useState<string | null>(null);

  const handleUpgradeFromProfile = (tierId: 'starter' | 'pro' | 'agency') => {
    openRazorpayCheckout({
      tierId,
      customerEmail: currentUser?.email || 'vathmossupport@gmail.com',
      onSuccess: (res) => {
        upgradeTier(tierId, res.razorpay_payment_id);
        setUpgradeNotification(`🎉 Successfully upgraded to ${res.tier.name}! Quota has been refreshed.`);
        setShowUpgradePlans(false);
      },
    });
  };

  // Co-Pilot & Support states
  const [activeTab, setActiveTab] = useState<'copilot' | 'feedback' | 'admin' | 'whitelabel'>('copilot');
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      text: string;
      timestamp?: string;
      emailAction?: {
        type: 'interview_invite' | 'rejection' | 'screening' | 'offer';
        candidateName: string;
        candidateEmail: string;
        subject: string;
        body: string;
        screeningQuestions?: {
          expectedSalary?: string;
          noticePeriod?: string;
          availability?: string;
        };
      } | null;
      dispatchStatus?: 'pending' | 'sending' | 'sent' | 'error';
      dispatchRef?: string;
      dispatchNote?: string;
    }>
  >([
    {
      role: 'assistant',
      text: 'Hi! I am your Vathmos Recruiter Co-Pilot. Ask me who to hire, compare candidates, or draft interview invitations & polite rejection notes.\n\n🛡️ **Safety Guarantee**: I will never send an email to a candidate automatically. You will always review the exact text and click "Approve & Send".',
      timestamp: 'Now',
    },
  ]);
  const copilotEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    copilotEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [copilotMessages, copilotLoading]);

  // Feedback Submission State
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'general'>('bug');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [lastRefId, setLastRefId] = useState<string | null>(null);

  // Admin Feedback Management State
  const [adminReports, setAdminReports] = useState<FeedbackItem[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminFilter, setAdminFilter] = useState<'all' | 'bug' | 'feature' | 'general'>('all');
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [hasWebhook, setHasWebhook] = useState(false);
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [webhookStatusNotice, setWebhookStatusNotice] = useState<string | null>(null);

  // White-Label State (Exclusively for Agency $119 / Admin)
  const [wlEnabled, setWlEnabled] = useState(currentUser?.whiteLabel?.enabled ?? false);
  const [wlCompanyName, setWlCompanyName] = useState(currentUser?.whiteLabel?.companyName || currentUser?.companyName || '');
  const [wlLogoDataUrl, setWlLogoDataUrl] = useState<string | undefined>(currentUser?.whiteLabel?.logoDataUrl);
  const [wlTagline, setWlTagline] = useState(currentUser?.whiteLabel?.tagline || '');
  const [wlContactEmail, setWlContactEmail] = useState(currentUser?.whiteLabel?.contactEmail || '');
  const [wlWebsite, setWlWebsite] = useState(currentUser?.whiteLabel?.website || '');
  const [wlSaving, setWlSaving] = useState(false);
  const [wlStatus, setWlStatus] = useState<string | null>(null);
  const [supabaseServerConnected, setSupabaseServerConnected] = useState<boolean>(false);

  const isAdmin = currentUser?.email && ADMIN_EMAILS.includes(currentUser.email.toLowerCase());

  useEffect(() => {
    if (isProfileModalOpen) {
      checkBackendSupabaseStatus().then((st) => {
        setSupabaseServerConnected(Boolean(st.configured));
      }).catch(() => {});
    }
  }, [isProfileModalOpen]);

  // Fetch feedback records from server
  const loadReports = async () => {
    setAdminLoading(true);
    try {
      const res = await fetch('/api/feedback', {
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminReports(data.feedbacks || []);
        setHasWebhook(Boolean(data.hasWebhook));
        if (data.webhookUrl) {
          setWebhookUrlInput(data.webhookUrl);
        }
      }
    } catch (err) {
      console.error('Failed to load feedback reports:', err);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setCompanyName(currentUser.companyName);
      setRole(currentUser.role);
      setSelectedColor(currentUser.avatarColor);

      if (currentUser.whiteLabel) {
        setWlEnabled(currentUser.whiteLabel.enabled ?? false);
        setWlCompanyName(currentUser.whiteLabel.companyName || currentUser.companyName || '');
        setWlLogoDataUrl(currentUser.whiteLabel.logoDataUrl || '');
        setWlTagline(currentUser.whiteLabel.tagline || '');
        setWlContactEmail(currentUser.whiteLabel.contactEmail || '');
        setWlWebsite(currentUser.whiteLabel.website || '');
      } else {
        setWlCompanyName(currentUser.companyName || '');
      }
    }
  }, [currentUser, isProfileModalOpen]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      setWlStatus('Logo file must be under 1.5MB for fast PDF rendering.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setWlLogoDataUrl(reader.result as string);
      setWlStatus(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveWhiteLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    setWlSaving(true);
    setWlStatus(null);
    const result = await updateWhiteLabel({
      enabled: wlEnabled,
      companyName: wlCompanyName.trim() || currentUser?.companyName || 'Agency Partner',
      logoDataUrl: wlLogoDataUrl,
      tagline: wlTagline.trim(),
      contactEmail: wlContactEmail.trim(),
      website: wlWebsite.trim(),
    });
    setWlSaving(false);
    if (result.success) {
      setWlStatus('✅ White-label settings saved successfully! Exported PDFs will use your branding.');
      // Sync to Supabase if connected
      syncProfileToSupabase({
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        companyName: wlCompanyName.trim() || currentUser.companyName,
        role: currentUser.role,
        avatarColor: currentUser.avatarColor,
        tier: currentUser.tier,
        evaluationsLimit: currentUser.evaluationsLimit,
        evaluationsUsed: currentUser.evaluationsUsed,
        interviewQuestionsLimit: currentUser.interviewQuestionsLimit,
        interviewQuestionsUsed: currentUser.interviewQuestionsUsed,
        whiteLabel: {
          enabled: wlEnabled,
          companyName: wlCompanyName.trim() || currentUser.companyName,
          logoDataUrl: wlLogoDataUrl,
          tagline: wlTagline.trim(),
          contactEmail: wlContactEmail.trim(),
          website: wlWebsite.trim(),
        },
      }).catch(() => {});
    } else {
      setWlStatus(`❌ ${result.error || 'Failed to save white-label branding.'}`);
    }
  };

  useEffect(() => {
    if (isProfileModalOpen && isAdmin) {
      loadReports();
    }
  }, [isProfileModalOpen, isAdmin]);

  if (!isProfileModalOpen || !currentUser) return null;

  // Calculate live user session stats
  const completedCandidates = candidates
    .filter((c) => (c.status === 'completed' || c.result) && c.result?.score !== undefined)
    .sort((a, b) => {
      const scoreDiff = (b.result?.score || 0) - (a.result?.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const evDiff = (b.result?.score_breakdown?.verifiable_evidence || 0) - (a.result?.score_breakdown?.verifiable_evidence || 0);
      if (evDiff !== 0) return evDiff;
      return (b.result?.score_breakdown?.hard_requirements || 0) - (a.result?.score_breakdown?.hard_requirements || 0);
    });
  const totalEvaluated = completedCandidates.length;
  const topMatches = completedCandidates.filter((c) => (c.result?.score || 0) >= 85).length;
  const averageScore =
    totalEvaluated > 0
      ? Math.round(
          completedCandidates.reduce((sum, c) => sum + (c.result?.score || 0), 0) /
            totalEvaluated
        )
      : null;

  const newReportsCount = adminReports.filter((r) => r.status === 'new').length;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      name: name.trim() || currentUser.name,
      companyName: companyName.trim() || currentUser.companyName,
      role: role.trim() || currentUser.role,
      avatarColor: selectedColor,
    });
    // Sync to Supabase if connected
    syncProfileToSupabase({
      id: currentUser.id,
      email: currentUser.email,
      name: name.trim() || currentUser.name,
      companyName: companyName.trim() || currentUser.companyName,
      role: role.trim() || currentUser.role,
      avatarColor: selectedColor,
      tier: currentUser.tier,
      evaluationsLimit: currentUser.evaluationsLimit,
      evaluationsUsed: currentUser.evaluationsUsed,
      interviewQuestionsLimit: currentUser.interviewQuestionsLimit,
      interviewQuestionsUsed: currentUser.interviewQuestionsUsed,
      whiteLabel: currentUser.whiteLabel,
    }).catch(() => {});
    setIsEditing(false);
  };

  function extractEmailAction(text: string): {
    cleanText: string;
    emailAction: {
      type: 'interview_invite' | 'rejection' | 'screening' | 'offer';
      candidateName: string;
      candidateEmail: string;
      subject: string;
      body: string;
      screeningQuestions?: {
        expectedSalary?: string;
        noticePeriod?: string;
        availability?: string;
      };
    } | null;
  } {
    const match = text.match(/```vathmos_email_action\s*([\s\S]*?)\s*```/);
    if (!match) return { cleanText: text, emailAction: null };
    try {
      const parsed = JSON.parse(match[1]);
      const cleanText = text.replace(/```vathmos_email_action\s*[\s\S]*?\s*```/, '').trim();
      return { cleanText, emailAction: parsed };
    } catch {
      return { cleanText: text, emailAction: null };
    }
  }

  const generateLocalCopilotReply = (
    query: string,
    candidates: any[],
    jd?: string
  ): string => {
    const q = (query || '').toLowerCase();
    // Sort candidates by score descending to guarantee #1 is always the highest scoring candidate!
    const sortedCandidates = [...(candidates || [])].sort((a, b) => (b.score || 0) - (a.score || 0));

    // If user mentioned a specific candidate name in the query, pick that candidate!
    let targetCandObj = sortedCandidates[0];
    if (sortedCandidates.length > 0) {
      for (const cand of sortedCandidates) {
        if (cand.name && q.includes(cand.name.toLowerCase().split(' ')[0])) {
          targetCandObj = cand;
          break;
        }
      }
    }
    const topCand = targetCandObj ? targetCandObj.name : 'Candidate';
    const topScore = targetCandObj?.score ?? 88;
    const emailMatch = query.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const userSpecifiedEmail = emailMatch ? emailMatch[1] : null;
    const domainCtx = detectRoleDomain(jobDescription || '');
    const interviewType = domainCtx.isTechnical ? 'technical conversation' : 'interview conversation';
    const roundFocus = domainCtx.isTechnical
      ? 'your projects and how your background aligns with our roadmap'
      : 'your past achievements, workflow ownership, and fit for this role';
    const destinationEmail = userSpecifiedEmail || currentUser.email || '97.vineet.8865@gmail.com';
    const topEmail = userSpecifiedEmail || targetCandObj?.email || destinationEmail;

    // 0. Explicit request to send message / email to user or candidate
    if (
      q.includes('send that msg') ||
      q.includes('send that message') ||
      q.includes('send to my email') ||
      q.includes('send this to my email') ||
      q.includes('send to an email of mine') ||
      q.includes('send to a email of mine') ||
      q.includes('send this msg') ||
      q.includes('send this message') ||
      q.includes('send email') ||
      q.includes('forward') ||
      userSpecifiedEmail
    ) {
      const lastAssistantMsg = [...copilotMessages]
        .reverse()
        .find((m) => m.role === 'assistant' && m.text && !m.text.includes('Safety Guarantee'));
      const priorDraft = [...copilotMessages].reverse().find((m) => m.emailAction);
      const stagedSubject =
        priorDraft?.emailAction?.subject ||
        `Interview Invitation & Next Steps: ${domainCtx.roleTitle}`;
      const stagedBody =
        priorDraft?.emailAction?.body ||
        (lastAssistantMsg?.text && lastAssistantMsg.text.length > 40
          ? lastAssistantMsg.text
          : `Hi ${topCand},\n\nThank you for applying for our ${domainCtx.roleTitle} opening. Our hiring team evaluated your background against our role benchmarks and were very impressed by your demonstrated achievements.\n\nWe would love to invite you for a 45-minute ${interviewType} to discuss ${roundFocus}.\n\nTo help us schedule smoothly, please reply with:\n1. Your current notice period and earliest join date.\n2. Your expected compensation / CTC range.\n\nLooking forward to speaking with you!\n\nWarm regards,\nVathmos Recruitment Team`);

      return `I have prepared the email dispatch draft for you, addressed to **${topEmail}**.

🛡️ **Human Approval Required**: As designed, I will **never** dispatch an email without your explicit review and approval. Please inspect the message content, recipient address, and screening questions below. Click **"Approve & Send Email"** when you are ready to send it.

\`\`\`vathmos_email_action
${JSON.stringify(
  {
    type: priorDraft?.emailAction?.type || 'interview_invite',
    candidateName: topCand,
    candidateEmail: topEmail,
    subject: stagedSubject,
    body: stagedBody,
    screeningQuestions: priorDraft?.emailAction?.screeningQuestions || {
      expectedSalary: 'Please share your expected annual salary / CTC range.',
      noticePeriod: 'What is your current notice period / earliest join date?',
      availability: `What times work best for a 45-minute ${interviewType} next week?`,
    },
  },
  null,
  2
)}
\`\`\``;
    }

    // 1. "Who should I hire?" / Human Recruiter Advisor Recommendation
    if (
      q.includes('who should i hire') ||
      q.includes('what i shall hire') ||
      q.includes('who to hire') ||
      q.includes('who is best') ||
      q.includes('recommend') ||
      q.includes('who won') ||
      q.includes('winner')
    ) {
      if (sortedCandidates && sortedCandidates.length > 0) {
        const c1 = sortedCandidates[0];
        const c2 = sortedCandidates.length > 1 ? sortedCandidates[1] : null;

        let advice = `Based on your evaluation criteria and 100-point rubric benchmarks, here is my honest hiring counsel:\n\n`;
        advice += `🥇 **Primary Recommendation: ${c1.name} (${c1.score}/100 — ${c1.recommendation || 'Strong Match'})**\n`;
        if (c1.pros && c1.pros.length > 0) {
          advice += `• **Core Strengths:** ${c1.pros.slice(0, 2).join('; ')}.\n`;
        }
        if (c1.matched_skills && c1.matched_skills.length > 0) {
          advice += `• **Demonstrated Skills:** ${c1.matched_skills.slice(0, 4).join(', ')}.\n`;
        }
        if (c1.cons && c1.cons.length > 0) {
          advice += `• **Interview Probing Areas:** ${c1.cons.slice(0, 2).join('; ')}.\n`;
        }

        if (c2) {
          advice += `\n🥈 **Alternative Runner-Up: ${c2.name} (${c2.score}/100)**\n`;
          advice += `• Good baseline qualification, but scored slightly lower on verifiable outcomes or specific ${domainCtx.domainLabel.toLowerCase()} depth.\n`;
        }

        advice += `\n💡 **My Recruiter Advice:** If you need immediate impact, **${c1.name}** is your strongest candidate. Before finalizing an offer, I recommend asking these two quick questions:\n`;
        advice += `1. Current notice period and earliest start date.\n`;
        advice += `2. Expected CTC / salary package.\n\n`;
        advice += `Would you like me to prepare an **Interview Invitation Email** for **${c1.name}** with these questions included?`;

        return advice;
      }

      return `I'm ready to evaluate your pool! Once you upload and evaluate candidate resumes against your Job Description, I will analyze their scores, highlight who has verifiable achievements vs buzzwords, and give you clear, human hiring counsel.`;
    }

    // 2. Candidate comparison
    if (q.includes('compare') || q.includes('difference') || q.includes('versus') || q.includes('vs')) {
      if (sortedCandidates && sortedCandidates.length > 1) {
        const c1 = sortedCandidates[0];
        const c2 = sortedCandidates[1];
        return `Candidate Comparison for **${domainCtx.roleTitle}**: **${c1.name}** vs **${c2.name}**\n\n• **${c1.name} (Score: ${c1.score ?? 85}/100)**: Leads in verifiable metrics and role depth. Matched competencies: ${(c1.matched_skills || ['Core Requirements']).slice(0, 3).join(', ')}.\n• **${c2.name} (Score: ${c2.score ?? 70}/100)**: Competent baseline, with requirement gaps: ${(c2.missing_skills || ['Target Depth']).slice(0, 2).join(', ')}.\n\n**Hiring Recommendation:** Advance **${c1.name}** as primary candidate and validate real-world ownership of their top achievements in the interview.`;
      } else if (sortedCandidates && sortedCandidates.length === 1) {
        const c1 = sortedCandidates[0];
        return `You have evaluated **${c1.name}** with an overall score of **${c1.score ?? 85}/100** (${c1.recommendation || 'Qualified'}). They showed strong alignment with ${(c1.matched_skills || ['Core Requirements']).slice(0, 3).join(', ')}. Add a second candidate to see a side-by-side comparative breakdown.`;
      }
    }

    // 3. Interview invitation / scheduling with human-in-the-loop action
    if (q.includes('invite') || q.includes('interview') || q.includes('schedule') || (q.includes('email') && !q.includes('reject'))) {
      return `I have prepared a tailored, professional interview invitation for **${topCand}** (${topScore}/100).

🛡️ **Safety Guarantee**: I will never send this email automatically. Please review the details below and click **"Approve & Send"** when you are ready.

\`\`\`vathmos_email_action
${JSON.stringify(
  {
    type: 'interview_invite',
    candidateName: topCand,
    candidateEmail: topEmail,
    subject: `Interview Invitation: Next Steps for ${domainCtx.roleTitle}`,
    body: `Hi ${topCand},\n\nThank you for applying for our ${domainCtx.roleTitle} opening. Our hiring team evaluated your background against our role benchmarks, and we were very impressed by your proven achievements.\n\nWe would love to invite you for a 45-minute ${interviewType} to discuss ${roundFocus}.\n\nTo help us schedule smoothly, please reply with:\n1. Your earliest available start date / notice period.\n2. Your expected compensation / CTC range.\n\nLooking forward to speaking with you!\n\nWarm regards,\nVathmos Recruitment Team`,
    screeningQuestions: {
      expectedSalary: 'Please share your expected annual salary / CTC range.',
      noticePeriod: 'What is your current notice period / earliest join date?',
      availability: `What times work best for a 45-minute ${interviewType} next week?`,
    },
  },
  null,
  2
)}
\`\`\``;
    }

    // 4. Rejection letter with human-in-the-loop action
    if (q.includes('reject') || q.includes('declined') || q.includes('pass') || q.includes('not selected')) {
      const rejectCand = sortedCandidates.length > 1 ? sortedCandidates[sortedCandidates.length - 1].name : topCand;
      const rejectEmail = `${rejectCand.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`;

      return `I have prepared a polite, constructive candidate update for **${rejectCand}**.

🛡️ **Safety Guarantee**: This email is staged in your approval queue and will only be sent after you click **"Approve & Send"**.

\`\`\`vathmos_email_action
${JSON.stringify(
  {
    type: 'rejection',
    candidateName: rejectCand,
    candidateEmail: rejectEmail,
    subject: `Update regarding your application for ${domainCtx.roleTitle}`,
    body: `Hi ${rejectCand},\n\nThank you for taking the time to share your background and apply for our ${domainCtx.roleTitle} opening. We genuinely appreciate the effort you put into your application.\n\nWhile your accomplishments are commendable, we have decided to advance candidates whose experience aligns more directly with our immediate requirements for this hiring cycle.\n\nWe appreciate your interest in our team and wish you every success in your career pursuits.\n\nWarm regards,\nVathmos Recruitment Team`,
    screeningQuestions: {
      feedbackOffered: 'Candidate pool archived for future openings matching skill profile.',
    },
  },
  null,
  2
)}
\`\`\``;
    }

    // 5. Rubric explanation
    if (q.includes('rubric') || q.includes('score') || q.includes('how') || q.includes('formula') || q.includes('points')) {
      return `Vathmos scores candidates on a 100-Point Calibrated Rubric (for both Technical & Non-Technical roles):

1. **Hard Requirements (0-40 Pts):** Strict verification of demanded skills, tools, certifications, and years of experience.
2. **Domain Depth (0-30 Pts):** Seniority level, real-world scope complexity, and role relevance.
3. **Verifiable Evidence (0-30 Pts):** Concrete quantitative outcomes (revenue, quota, conversion, retention, latency, scale) versus unproven buzzwords.

• **85–100:** Strong Fit  
• **70–84:** Qualified  
• **50–69:** Marginal / Borderline  
• **<50:** Unqualified`;
    }

    // Default intelligent assistant response
    if (candidates && candidates.length > 0) {
      const list = candidates
        .slice(0, 3)
        .map((c, i) => `${i + 1}. **${c.name}** — ${c.score ?? 'N/A'}/100 (${c.recommendation || 'Evaluated'})`)
        .join('\n');
      return `I am your Vathmos Recruiter Co-Pilot.

Here is your current leaderboard summary:
${list}

I can help you:
• **Ask "Who should I hire?"** for personal, strategic advice on who to advance
• **Draft interview invitations or polite rejection notes** (with human review before sending)
• **Compare candidates side-by-side**
• **Suggest targeted interview questions**

What decision would you like to review?`;
    }

    return `I am your Vathmos Recruiter Co-Pilot. I can help you:
• **Hiring Advice:** Ask *"Who should I hire for this role?"* for human, insightful recommendations
• **Draft Outreach:** Interview invitations and polite rejection letters with salary/notice period screening
• **Safety First:** I will never send an email without your explicit review and click
• **Candidate Analysis:** Compare candidate strengths and identify skill gaps

How can I assist your hiring decision right now?`;
  };

  const handleApproveAndSendEmail = async (msgIndex: number, draft: any) => {
    setCopilotMessages((prev) =>
      prev.map((m, idx) =>
        idx === msgIndex ? { ...m, dispatchStatus: 'sending', dispatchNote: undefined } : m
      )
    );

    let refId = 'DISP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    let delivered = false;
    let note = '';

    try {
      const payload = JSON.stringify({
        candidateName: draft.candidateName,
        candidateEmail: draft.candidateEmail,
        subject: draft.subject,
        body: draft.body,
        emailType: draft.type,
        screeningQuestions: draft.screeningQuestions,
      });

      let res = await fetch('/api/copilot/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: payload,
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        res = await fetch('/api/copilot-send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
      }

      const fallbackType = res.headers.get('content-type') || '';
      if (res.ok && fallbackType.includes('application/json')) {
        const data = await res.json();
        if (data?.dispatchId) refId = data.dispatchId;
        delivered = Boolean(data?.delivered);
        note = data?.resendError || data?.message || '';
      } else {
        note = 'Email dispatch API unavailable on static host.';
      }
    } catch (err: any) {
      note = err?.message || 'Network error while dispatching email.';
    }

    setCopilotMessages((prev) =>
      prev.map((m, idx) =>
        idx === msgIndex
          ? {
              ...m,
              dispatchStatus: delivered ? 'sent' : 'error',
              dispatchRef: refId,
              dispatchNote: note || (delivered ? `Delivered via Resend (${refId})` : 'Could not deliver email.'),
            }
          : m
      )
    );
  };

  const handleDismissEmailAction = (msgIndex: number) => {
    setCopilotMessages((prev) =>
      prev.map((m, idx) => (idx === msgIndex ? { ...m, emailAction: null } : m))
    );
  };

  const handleUpdateDraft = (msgIndex: number, field: string, value: string) => {
    setCopilotMessages((prev) =>
      prev.map((m, idx) => {
        if (idx !== msgIndex || !m.emailAction) return m;
        return {
          ...m,
          dispatchStatus: m.dispatchStatus === 'error' ? 'pending' : m.dispatchStatus,
          dispatchNote: undefined,
          emailAction: {
            ...m.emailAction,
            [field]: value,
          },
        };
      })
    );
  };

  const handleSendCopilot = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = copilotQuery.trim();
    if (!q || copilotLoading) return;

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const historySnapshot = copilotMessages.slice(-6).map((m) => ({
      role: m.role,
      text: m.text,
    }));

    setCopilotMessages((prev) => [...prev, { role: 'user', text: q, timestamp: timeNow }]);
    setCopilotQuery('');
    setCopilotLoading(true);

    const candidatesSummary = completedCandidates.map((c) => ({
      name: c.name,
      score: c.result?.score,
      recommendation: c.result?.recommendation,
      matched_skills: c.result?.matched_skills,
      missing_skills: c.result?.missing_skills,
      pros: c.result?.pros,
      cons: c.result?.cons,
      rank_reasoning: c.result?.rank_reasoning,
    }));

    try {
      let replyText = '';
      try {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 7000);
        const res = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ac.signal,
          body: JSON.stringify({
            message: q,
            jobDescription,
            candidatesSummary,
            history: historySnapshot,
            recruiterEmail: currentUser?.email,
          }),
        });
        clearTimeout(timer);

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data && data.reply) {
            replyText = data.reply;
          }
        }
      } catch (networkErr) {
        // Backend route not reachable or timed out; seamlessly fallback to local engine
      }

      if (!replyText) {
        replyText = generateLocalCopilotReply(q, candidatesSummary, jobDescription);
      }

      const { cleanText, emailAction } = extractEmailAction(replyText);

      setCopilotMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: cleanText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emailAction,
          dispatchStatus: emailAction ? 'pending' : undefined,
        },
      ]);
    } catch {
      const fallback = generateLocalCopilotReply(q, candidatesSummary, jobDescription);
      const { cleanText, emailAction } = extractEmailAction(fallback);
      setCopilotMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: cleanText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emailAction,
          dispatchStatus: emailAction ? 'pending' : undefined,
        },
      ]);
    } finally {
      setCopilotLoading(false);
    }
  };

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim() || feedbackLoading) return;

    setFeedbackLoading(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: feedbackType,
          description: feedbackText.trim(),
          email: currentUser.email,
          name: currentUser.name,
          telemetry: {
            userAgent: navigator.userAgent,
            evaluatedCandidatesCount: totalEvaluated,
            activeRole: currentUser.role,
          },
        }),
      });
      const data = await res.json();
      setLastRefId(data.referenceId || `FB-${Date.now().toString(36).toUpperCase()}`);
      setFeedbackSubmitted(true);
      setFeedbackText('');
      if (isAdmin) {
        loadReports();
      }
    } catch (err) {
      console.log('Feedback error:', err);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleUpdateStatus = async (
    id: string,
    status: 'new' | 'investigating' | 'resolved'
  ) => {
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setAdminReports((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status } : item))
        );
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDeleteReport = async (id: string) => {
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });
      if (res.ok) {
        setAdminReports((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  };

  const handleSaveWebhook = async () => {
    setWebhookSaving(true);
    setWebhookStatusNotice(null);
    try {
      const res = await fetch('/api/feedback/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ webhookUrl: webhookUrlInput.trim() }),
      });
      if (res.ok) {
        setHasWebhook(Boolean(webhookUrlInput.trim()));
        setWebhookStatusNotice('Webhook destination saved successfully!');
      } else {
        setWebhookStatusNotice('Failed to save webhook URL.');
      }
    } catch {
      setWebhookStatusNotice('Network error saving webhook.');
    } finally {
      setWebhookSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    setWebhookStatusNotice('Sending test alert to webhook...');
    try {
      const res = await fetch('/api/feedback/test-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ webhookUrl: webhookUrlInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setWebhookStatusNotice('Test notification received successfully on webhook!');
      } else {
        setWebhookStatusNotice(`Test alert failed: ${data.error || 'Check webhook URL'}`);
      }
    } catch {
      setWebhookStatusNotice('Network error dispatching test.');
    }
  };

  const getInitials = (n: string) => {
    return n
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredAdminReports = adminReports.filter((r) => {
    if (adminFilter === 'all') return true;
    return r.type === adminFilter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        id="user-profile-modal-card"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#12151E]/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl p-6 sm:p-7 text-zinc-100"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={closeProfileModal}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
          aria-label="Close profile modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Card Header */}
        <div className="flex items-start gap-4 mb-6 pb-6 border-b border-white/[0.06]">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-md border border-white/10 shrink-0"
            style={{ backgroundColor: isEditing ? selectedColor : currentUser.avatarColor }}
          >
            {getInitials(isEditing ? name : currentUser.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-white truncate">
                {currentUser.name}
              </h2>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 shrink-0">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Platform Admin</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Verified</span>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 truncate">{currentUser.email}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-zinc-300">{currentUser.companyName}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-zinc-300">{currentUser.role}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Recruiter Active Tier & Remaining Quotas Card */}
        {(() => {
          const evalLimit = currentUser.evaluationsLimit ?? 5;
          const evalUsed = currentUser.evaluationsUsed ?? 0;
          const evalRemaining = Math.max(0, evalLimit - evalUsed);
          const evalPercent = Math.min(100, Math.round((evalRemaining / evalLimit) * 100));

          const guidesLimit = currentUser.interviewQuestionsLimit ?? 5;
          const guidesUsed = currentUser.interviewQuestionsUsed ?? 0;
          const guidesRemaining = Math.max(0, guidesLimit - guidesUsed);
          const guidesPercent = Math.min(100, Math.round((guidesRemaining / guidesLimit) * 100));

          const tierKey = currentUser.tier || 'free';
          const tierTitle =
            tierKey === 'agency'
              ? 'Agency & Enterprise'
              : tierKey === 'pro'
              ? 'Pro Recruiter'
              : tierKey === 'starter'
              ? 'Starter Pass'
              : 'Free Screening Tier';

          return (
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-b from-[#181C28] to-[#10131E] border border-cyan-500/20 shadow-lg space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white tracking-wide">
                        {tierTitle}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                          tierKey === 'agency'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                            : tierKey === 'pro'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                            : tierKey === 'starter'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {tierKey.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {currentUser.razorpayPaymentId ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-mono">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Paid Ref: {currentUser.razorpayPaymentId.slice(0, 14)}...</span>
                        </span>
                      ) : (
                        'Trial Bundle • No credit card required'
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowUpgradePlans((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{showUpgradePlans ? 'Close Plans' : 'Upgrade Plan'}</span>
                </button>
              </div>

              {upgradeNotification && (
                <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                  <span>{upgradeNotification}</span>
                  <button
                    type="button"
                    onClick={() => setUpgradeNotification(null)}
                    className="text-emerald-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Progress 1: Candidate Evaluations */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">Candidate Evaluations</span>
                  <span className="font-mono text-cyan-300 font-bold">
                    {evalRemaining} / {evalLimit} left{' '}
                    <span className="text-zinc-500 font-normal">({evalUsed} used)</span>
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-800/80 overflow-hidden border border-white/[0.05]">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-300"
                    style={{ width: `${evalPercent}%` }}
                  />
                </div>
              </div>

              {/* Progress 2: AI Interview Question Guides */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">AI Role-Calibrated Interview Guides</span>
                  <span className="font-mono text-emerald-300 font-bold">
                    {guidesRemaining} / {guidesLimit} left{' '}
                    <span className="text-zinc-500 font-normal">({guidesUsed} used)</span>
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-800/80 overflow-hidden border border-white/[0.05]">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                    style={{ width: `${guidesPercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-400">
                  Each guide generates 3 tailored interview questions (1 Pro Verification + 2 Gap Probes with sample answers).
                </p>
              </div>

              {/* White-Label Quick Access for Agency & Platform Admin */}
              <div className="pt-2.5 border-t border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-indigo-950/20 p-2.5 rounded-xl border border-indigo-500/20">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-white block">White-Label PDF Reporting</span>
                    <span className="text-[10px] text-zinc-400">
                      {currentUser?.tier === 'agency' || isAdmin
                        ? currentUser.whiteLabel?.enabled
                          ? `Active: ${currentUser.whiteLabel.companyName || 'Custom Branding'}`
                          : 'Available: Upload your agency logo & set company name'
                        : 'Agency ($119 / ₹11,305) exclusive: Replace Vathmos with your brand'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('whitelabel');
                    const tabElem = document.getElementById('profile-tabs-section');
                    if (tabElem) tabElem.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white text-[11px] font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>{currentUser?.tier === 'agency' || isAdmin ? 'Configure Brand & Logo' : 'View White-Label'}</span>
                </button>
              </div>

              {/* Interactive Upgrade Tier Drawer */}
              {showUpgradePlans && (
                <div className="pt-3 border-t border-white/[0.08] space-y-2 animate-in fade-in duration-150">
                  <p className="text-[11px] font-bold text-white">Choose a quota bundle (Instant Activation):</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Starter */}
                    <div className="p-2.5 rounded-lg bg-[#0D1017] border border-emerald-500/30 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-white">Starter</span>
                          <span className="text-xs font-bold text-emerald-400">$39 / ₹3,705</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5">150 Evals • 80 Guides</p>
                        <p className="text-[9px] text-amber-400/90 mt-0.5 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Standard Mode Only</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpgradeFromProfile('starter')}
                        className="mt-2 w-full py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition cursor-pointer"
                      >
                        Select Starter
                      </button>
                    </div>

                    {/* Pro */}
                    <div className="p-2.5 rounded-lg bg-[#0D1017] border border-sky-500/40 flex flex-col justify-between ring-1 ring-sky-500/20">
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-white">Pro</span>
                          <span className="text-xs font-bold text-sky-400">$79 / ₹7,505</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5">400 Evals • 250 Guides</p>
                        <p className="text-[9px] text-sky-300 mt-0.5">✓ 3 Calibration Modes</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpgradeFromProfile('pro')}
                        className="mt-2 w-full py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold transition cursor-pointer"
                      >
                        Select Pro
                      </button>
                    </div>

                    {/* Agency */}
                    <div className="p-2.5 rounded-lg bg-[#0D1017] border border-indigo-500/30 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-white">Agency</span>
                          <span className="text-xs font-bold text-indigo-400">$119 / ₹11,305</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5">1k Evals • 750 Guides</p>
                        <p className="text-[9px] text-indigo-300 mt-0.5 font-medium">✓ White-Label PDF Branding</p>
                        <p className="text-[9px] text-indigo-300/80">✓ Dedicated Support</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpgradeFromProfile('agency')}
                        className="mt-2 w-full py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold transition cursor-pointer"
                      >
                        Select Agency
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Recruiter Workspace Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 bg-[#0E1018]/80 border border-white/[0.06] rounded-xl text-center">
            <p className="text-[11px] font-medium text-zinc-400">Evaluations</p>
            <p className="text-lg font-bold text-white mt-0.5 font-mono">{totalEvaluated}</p>
          </div>
          <div className="p-3 bg-[#0E1018]/80 border border-white/[0.06] rounded-xl text-center">
            <p className="text-[11px] font-medium text-zinc-400">Top Matches</p>
            <p className="text-lg font-bold text-emerald-400 mt-0.5 font-mono">{topMatches}</p>
          </div>
          <div className="p-3 bg-[#0E1018]/80 border border-white/[0.06] rounded-xl text-center">
            <p className="text-[11px] font-medium text-zinc-400">Avg Score</p>
            <p className="text-lg font-bold text-sky-400 mt-0.5 font-mono">
              {averageScore !== null ? `${averageScore}/100` : '—'}
            </p>
          </div>
        </div>

        {/* Profile Info / Edit Section */}
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-3.5 mb-6">
            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-[#121214] border border-[#27272A] focus:border-[#6366F1] rounded-lg text-sm text-[#FAFAFA] focus:outline-hidden transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121214] border border-[#27272A] focus:border-[#6366F1] rounded-lg text-sm text-[#FAFAFA] focus:outline-hidden transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1">
                  Recruiter Role
                </label>
                <input
                  type="text"
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121214] border border-[#27272A] focus:border-[#6366F1] rounded-lg text-sm text-[#FAFAFA] focus:outline-hidden transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                Avatar Accent Color
              </label>
              <div className="flex items-center gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-7 h-7 rounded-lg transition-transform cursor-pointer flex items-center justify-center ${
                      selectedColor === color ? 'scale-110 ring-2 ring-white' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {selectedColor === color && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#27272A] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 mb-6 bg-[#121214] border border-[#27272A] rounded-xl p-4 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-[#27272A]/60">
              <span className="text-[#71717A]">Member Since</span>
              <span className="text-[#D4D4D8] font-medium inline-flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#A1A1AA]" />
                <span>{currentUser.joinedAt}</span>
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#27272A]/60">
              <span className="text-[#71717A]">Active Role</span>
              <span className="text-[#D4D4D8] font-medium">{currentUser.role}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#27272A]/60">
              <span className="text-[#71717A]">Organization</span>
              <span className="text-[#D4D4D8] font-medium">{currentUser.companyName}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#27272A]/60">
              <span className="text-[#71717A]">Rubric System</span>
              <span className="text-[#818CF8] font-medium inline-flex items-center gap-1">
                <Award className="w-3 h-3" />
                <span>100-Point Standard</span>
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-[#71717A]">Cloud Storage</span>
              <span
                className={`font-medium inline-flex items-center gap-1 text-[11px] ${
                  supabaseServerConnected
                    ? 'text-emerald-400'
                    : isSupabaseConfigured()
                    ? 'text-sky-400'
                    : 'text-zinc-400'
                }`}
              >
                <Database className="w-3 h-3" />
                <span>
                  {supabaseServerConnected
                    ? 'Supabase Connected (Cloud Sync Active)'
                    : isSupabaseConfigured()
                    ? 'Supabase Project Linked (Add Secret Key in Vercel)'
                    : 'Supabase Ready (Schema in /supabase)'}
                </span>
              </span>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SCROLL DOWN SECTION: RECRUITER CO-PILOT & SUPPORT DESK         */}
        {/* ============================================================== */}
        <div id="profile-tabs-section" className="bg-[#121214] border border-[#27272A] rounded-xl p-4 space-y-3 mb-6">
          {/* Tab selector */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#27272A] pb-3">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('copilot')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  activeTab === 'copilot'
                    ? 'bg-[#6366F1] text-white shadow-xs'
                    : 'text-[#A1A1AA] hover:text-[#FAFAFA] bg-[#18181B]'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>AI Co-Pilot</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('whitelabel')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  activeTab === 'whitelabel'
                    ? 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow-xs'
                    : 'text-[#A1A1AA] hover:text-[#FAFAFA] bg-[#18181B]'
                }`}
              >
                <Palette className="w-3.5 h-3.5 text-indigo-400" />
                <span>White-Label Branding</span>
                {currentUser?.tier !== 'agency' && !isAdmin && (
                  <Lock className="w-3 h-3 text-amber-400/90 ml-0.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('feedback')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  activeTab === 'feedback'
                    ? 'bg-[#27272A] text-[#FAFAFA] border border-[#3F3F46]'
                    : 'text-[#A1A1AA] hover:text-[#FAFAFA] bg-[#18181B]'
                }`}
              >
                <Bug className="w-3.5 h-3.5 text-amber-400" />
                <span>Report Issue / Idea</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('admin');
                    loadReports();
                  }}
                  className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    activeTab === 'admin'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'text-[#A1A1AA] hover:text-[#FAFAFA] bg-[#18181B]'
                  }`}
                >
                  <Inbox className="w-3.5 h-3.5 text-rose-400" />
                  <span>Admin Inbox</span>
                  {newReportsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                      {newReportsCount}
                    </span>
                  )}
                </button>
              )}
            </div>
            <span className="text-[10px] text-[#71717A] font-mono">
              {activeTab === 'copilot'
                ? 'Live Workspace AI'
                : activeTab === 'whitelabel'
                ? 'Agency PDF Branding'
                : activeTab === 'feedback'
                ? 'Direct Feedback'
                : 'Dev Center'}
            </span>
          </div>

          {/* TAB 1: CO-PILOT CHAT */}
          {activeTab === 'copilot' && (
            <div className="space-y-3">
              <div className="max-h-80 sm:max-h-96 overflow-y-auto space-y-3 p-3 rounded-xl bg-[#18181B] border border-[#27272A]/70 text-xs">
                {copilotMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#6366F1]/20 text-[#FAFAFA] ml-6 border border-[#6366F1]/30'
                        : 'bg-[#202024] text-[#D4D4D8] mr-2 border border-[#27272A]'
                    }`}
                  >
                    <div className="text-[10px] font-mono text-[#A1A1AA] mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {msg.role === 'user' ? (
                          <span className="font-semibold text-indigo-300">You (Recruiter)</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
                            <Bot className="w-3 h-3 text-emerald-400" />
                            <span>Vathmos Co-Pilot</span>
                            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                              Talent Advisor
                            </span>
                          </span>
                        )}
                      </div>
                      {msg.timestamp && (
                        <span className="text-zinc-500 text-[10px]">{msg.timestamp}</span>
                      )}
                    </div>

                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>

                    {/* HUMAN-IN-THE-LOOP CANDIDATE EMAIL ACTION CARD */}
                    {msg.emailAction && (
                      <div className="mt-3 pt-3 border-t border-[#27272A] bg-[#141416] rounded-xl p-3.5 space-y-3 border border-indigo-500/30 shadow-md">
                        <div className="flex items-center justify-between pb-2 border-b border-[#27272A]">
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded bg-amber-500/20 text-amber-400">
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
                                <span>Human Review Required</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#27272A] text-zinc-300">
                                  {msg.emailAction.type === 'interview_invite'
                                    ? 'Interview Invite'
                                    : msg.emailAction.type === 'rejection'
                                    ? 'Polite Rejection'
                                    : 'Candidate Outreach'}
                                </span>
                              </div>
                              <div className="text-[10px] text-zinc-400">
                                Candidate email will NOT be sent until you review and click Approve.
                              </div>
                            </div>
                          </div>
                          {msg.dispatchStatus !== 'sent' && (
                            <button
                              type="button"
                              onClick={() => handleDismissEmailAction(i)}
                              className="text-zinc-500 hover:text-zinc-300 text-[10px] p-1 rounded hover:bg-[#27272A] transition-colors cursor-pointer"
                              title="Dismiss draft"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Recipient & Candidate Name */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <label className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider block mb-0.5">
                              Candidate Email
                            </label>
                            <input
                              type="email"
                              disabled={msg.dispatchStatus === 'sent' || msg.dispatchStatus === 'sending'}
                              value={msg.emailAction.candidateEmail || ''}
                              onChange={(e) => handleUpdateDraft(i, 'candidateEmail', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-[#18181B] border border-[#27272A] text-white text-xs focus:border-indigo-500 focus:outline-hidden"
                              placeholder="candidate@example.com"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider block mb-0.5">
                              Candidate Name
                            </label>
                            <input
                              type="text"
                              disabled={msg.dispatchStatus === 'sent' || msg.dispatchStatus === 'sending'}
                              value={msg.emailAction.candidateName || ''}
                              onChange={(e) => handleUpdateDraft(i, 'candidateName', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-[#18181B] border border-[#27272A] text-white text-xs focus:border-indigo-500 focus:outline-hidden"
                            />
                          </div>
                        </div>

                        {/* Subject Line */}
                        <div>
                          <label className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider block mb-0.5">
                            Subject Line
                          </label>
                          <input
                            type="text"
                            disabled={msg.dispatchStatus === 'sent' || msg.dispatchStatus === 'sending'}
                            value={msg.emailAction.subject || ''}
                            onChange={(e) => handleUpdateDraft(i, 'subject', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#18181B] border border-[#27272A] text-white text-xs focus:border-indigo-500 focus:outline-hidden"
                          />
                        </div>

                        {/* Screening Questions Preview */}
                        {msg.emailAction.screeningQuestions && (
                          <div className="bg-[#18181B] p-2.5 rounded-lg border border-[#27272A] space-y-1.5">
                            <div className="text-[10px] font-mono text-indigo-400 uppercase tracking-wide flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              <span>Screening Questions Included</span>
                            </div>
                            {msg.emailAction.screeningQuestions.expectedSalary && (
                              <div className="text-[11px] text-zinc-300 flex items-start gap-1.5">
                                <span className="text-zinc-500">•</span>
                                <span>
                                  <strong className="text-white">Expected CTC / Salary:</strong>{' '}
                                  {msg.emailAction.screeningQuestions.expectedSalary}
                                </span>
                              </div>
                            )}
                            {msg.emailAction.screeningQuestions.noticePeriod && (
                              <div className="text-[11px] text-zinc-300 flex items-start gap-1.5">
                                <span className="text-zinc-500">•</span>
                                <span>
                                  <strong className="text-white">Notice Period:</strong>{' '}
                                  {msg.emailAction.screeningQuestions.noticePeriod}
                                </span>
                              </div>
                            )}
                            {msg.emailAction.screeningQuestions.availability && (
                              <div className="text-[11px] text-zinc-300 flex items-start gap-1.5">
                                <span className="text-zinc-500">•</span>
                                <span>
                                  <strong className="text-white">Availability:</strong>{' '}
                                  {msg.emailAction.screeningQuestions.availability}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Email Body */}
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">
                              Email Body (Editable)
                            </label>
                            <span className="text-[10px] text-zinc-500">Recruiter can modify wording</span>
                          </div>
                          <textarea
                            rows={5}
                            disabled={msg.dispatchStatus === 'sent' || msg.dispatchStatus === 'sending'}
                            value={msg.emailAction.body || ''}
                            onChange={(e) => handleUpdateDraft(i, 'body', e.target.value)}
                            className="w-full px-2.5 py-2 rounded-lg bg-[#18181B] border border-[#27272A] text-zinc-200 text-xs font-sans leading-relaxed focus:border-indigo-500 focus:outline-hidden resize-y"
                          />
                        </div>

                        {/* Privacy Footer & Action Buttons */}
                        <div className="pt-2 border-t border-[#27272A] space-y-2">
                          {msg.dispatchStatus === 'error' && msg.dispatchNote && (
                            <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[11px] flex items-start gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <span>{msg.dispatchNote}</span>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono">
                              <ShieldCheck className="w-3 h-3 text-emerald-400" />
                              <span>Zero PII to disk • Real Resend delivery</span>
                            </div>

                            <div>
                              {msg.dispatchStatus === 'sent' ? (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Delivered via Resend ({msg.dispatchRef || 'DISP-OK'})</span>
                                </div>
                              ) : msg.dispatchStatus === 'sending' ? (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-medium">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Dispatching via Resend...</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleDismissEmailAction(i)}
                                    className="px-2.5 py-1.5 rounded-lg bg-[#18181B] hover:bg-[#27272A] text-zinc-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveAndSendEmail(i, msg.emailAction)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                    <span>
                                      {msg.dispatchStatus === 'error' ? 'Retry Send Email' : 'Approve & Send Email'}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {copilotLoading && (
                  <div className="flex items-center gap-2 p-2 text-xs text-[#818CF8]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Thinking with current candidates...</span>
                  </div>
                )}
                <div ref={copilotEndRef} />
              </div>

              {/* Quick Prompts */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setCopilotQuery('Who should I hire for this role? Give me human recruiter advice');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#27272A] hover:bg-[#3F3F46] text-indigo-300 hover:text-white shrink-0 cursor-pointer transition-colors border border-indigo-500/30 flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span>Who should I hire?</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCopilotQuery('Compare top candidates side-by-side');
                  }}
                  className="px-2 py-1 rounded bg-[#27272A] hover:bg-[#3F3F46] text-[#A1A1AA] hover:text-white shrink-0 cursor-pointer transition-colors"
                >
                  Compare candidates
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCopilotQuery('Draft interview invite email with salary and notice period questions');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#27272A] hover:bg-[#3F3F46] text-emerald-300 hover:text-white shrink-0 cursor-pointer transition-colors border border-emerald-500/30 flex items-center gap-1"
                >
                  <Mail className="w-3 h-3 text-emerald-400" />
                  <span>Draft interview invite</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCopilotQuery('Draft polite rejection letter for candidates not selected');
                  }}
                  className="px-2 py-1 rounded bg-[#27272A] hover:bg-[#3F3F46] text-[#A1A1AA] hover:text-white shrink-0 cursor-pointer transition-colors"
                >
                  Draft polite rejection
                </button>
              </div>

              {/* Query Input */}
              <form onSubmit={handleSendCopilot} className="flex items-center gap-2">
                <input
                  type="text"
                  value={copilotQuery}
                  onChange={(e) => setCopilotQuery(e.target.value)}
                  placeholder="Ask co-pilot (e.g. who should I hire, compare candidates, or draft invite)..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#18181B] border border-[#27272A] text-xs text-white focus:outline-hidden focus:border-[#6366F1]"
                />
                <button
                  type="submit"
                  disabled={!copilotQuery.trim() || copilotLoading}
                  className="p-2 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white cursor-pointer transition-colors"
                  aria-label="Send query"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: BUG REPORT & FEEDBACK SUBMISSION */}
          {activeTab === 'feedback' && (
            <form onSubmit={handleSendFeedback} className="space-y-3 text-xs">
              {feedbackSubmitted ? (
                <div className="p-3.5 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-[#34D399] space-y-2">
                  <div className="flex items-center gap-2 justify-center font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Report Logged Successfully!</span>
                  </div>
                  <p className="text-[11px] text-[#D4D4D8] text-center">
                    Saved to persistent developer inbox under reference{' '}
                    <span className="font-mono font-bold text-white bg-[#18181B] px-1.5 py-0.5 rounded border border-[#27272A]">
                      #{lastRefId || 'FB-LOG'}
                    </span>
                  </p>
                  <p className="text-[10px] text-[#A1A1AA] text-center">
                    Our founding team reviews diagnostics and PDF parsing telemetry continuously.
                  </p>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                    <a
                      href={`mailto:vathmossupport@gmail.com?subject=Vathmos%20Report%20%5B${
                        lastRefId || 'FEEDBACK'
                      }%5D&body=Hello%20Vathmos%20Team%2C%0A%0AI%20submitted%20a%20report%20via%20Vathmos%20(Ref%3A%20${
                        lastRefId || 'FB'
                      }).%0A%0AUser%3A%20${encodeURIComponent(
                        currentUser.name
                      )}%20(${encodeURIComponent(currentUser.email)})%0A`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold cursor-pointer transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Email Support Desk</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setFeedbackSubmitted(false)}
                      className="text-xs text-[#A1A1AA] hover:text-white underline cursor-pointer"
                    >
                      Submit another note
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-[#A1A1AA] text-[11px]">Category:</label>
                      <select
                        value={feedbackType}
                        onChange={(e) => setFeedbackType(e.target.value as any)}
                        className="px-2 py-1 rounded bg-[#18181B] border border-[#27272A] text-xs text-white"
                      >
                        <option value="bug">🐛 Bug / PDF Parsing Snag</option>
                        <option value="feature">💡 Feature Request</option>
                        <option value="general">💬 General Feedback</option>
                      </select>
                    </div>
                    <span className="text-[10px] text-[#71717A]">
                      Logged to developer database
                    </span>
                  </div>

                  <textarea
                    rows={3}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Describe what happened, the candidate file format, or feature you would love to see..."
                    className="w-full p-2.5 rounded-lg bg-[#18181B] border border-[#27272A] text-xs text-white focus:outline-hidden focus:border-[#6366F1] resize-none"
                    required
                  />

                  <div className="flex items-center justify-between text-[11px] text-[#71717A]">
                    <span>Includes browser & session telemetry</span>
                    <button
                      type="submit"
                      disabled={!feedbackText.trim() || feedbackLoading}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white font-semibold cursor-pointer transition-colors"
                    >
                      {feedbackLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Submit Report</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          {/* TAB 3: ADMIN INBOX (Only visible to vathmossupport@gmail.com) */}
          {activeTab === 'admin' && isAdmin && (
            <div className="space-y-3 text-xs">
              {/* Header and Refresh */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-white">User Reports Feed</span>
                  <span className="text-[#71717A]">({adminReports.length} total)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowWebhookConfig(!showWebhookConfig)}
                    className="inline-flex items-center gap-1 text-[11px] text-[#A1A1AA] hover:text-[#FAFAFA] cursor-pointer"
                  >
                    <Settings className="w-3 h-3" />
                    <span>Webhook</span>
                  </button>
                  <button
                    type="button"
                    onClick={loadReports}
                    disabled={adminLoading}
                    className="p-1 rounded text-[#A1A1AA] hover:text-white hover:bg-[#27272A] cursor-pointer"
                    title="Refresh reports"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${adminLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Webhook Configuration Drawer */}
              {showWebhookConfig && (
                <div className="p-3 bg-[#18181B] border border-[#27272A] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white text-[11px]">
                      🔔 Instant Webhook Notifications (Discord / Telegram / Slack)
                    </p>
                    {hasWebhook && (
                      <span className="text-[10px] text-emerald-400 font-medium">● Connected</span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#A1A1AA]">
                    Paste your Discord, Slack, or Telegram bot URL here. Whenever any recruiter submits a contact request, bug, or idea, your channel gets pinged immediately!
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={webhookUrlInput}
                      onChange={(e) => setWebhookUrlInput(e.target.value)}
                      placeholder="Discord, Slack, or https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<ID>"
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#121214] border border-[#27272A] text-xs text-white focus:outline-hidden focus:border-[#6366F1]"
                    />
                    <button
                      type="button"
                      onClick={handleSaveWebhook}
                      disabled={webhookSaving}
                      className="px-3 py-1.5 rounded-lg bg-[#27272A] hover:bg-[#3F3F46] text-white text-xs font-medium cursor-pointer"
                    >
                      {webhookSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={handleTestWebhook}
                      className="px-3 py-1.5 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold cursor-pointer"
                    >
                      Test
                    </button>
                  </div>
                  {webhookStatusNotice && (
                    <p className="text-[11px] text-[#818CF8]">{webhookStatusNotice}</p>
                  )}
                </div>
              )}

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                {(['all', 'bug', 'feature', 'general'] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => setAdminFilter(filterKey)}
                    className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors capitalize ${
                      adminFilter === filterKey
                        ? 'bg-[#6366F1] text-white font-semibold'
                        : 'bg-[#18181B] text-[#A1A1AA] hover:text-white'
                    }`}
                  >
                    {filterKey === 'all'
                      ? `All (${adminReports.length})`
                      : filterKey === 'bug'
                      ? `🐛 Bugs (${adminReports.filter((r) => r.type === 'bug').length})`
                      : filterKey === 'feature'
                      ? `💡 Ideas (${adminReports.filter((r) => r.type === 'feature').length})`
                      : `💬 Notes (${adminReports.filter((r) => r.type === 'general').length})`}
                  </button>
                ))}
              </div>

              {/* Reports List */}
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {adminLoading ? (
                  <div className="flex items-center justify-center p-6 text-[#A1A1AA]">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span>Loading reports...</span>
                  </div>
                ) : filteredAdminReports.length === 0 ? (
                  <div className="p-6 text-center text-[#71717A] bg-[#18181B] rounded-xl border border-[#27272A]">
                    <Inbox className="w-6 h-6 mx-auto mb-1 text-[#3F3F46]" />
                    <p>No user reports in this category yet.</p>
                  </div>
                ) : (
                  filteredAdminReports.map((report) => (
                    <div
                      key={report.id}
                      className="p-3 rounded-xl bg-[#18181B] border border-[#27272A] space-y-2 text-xs"
                    >
                      {/* Top Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              report.type === 'bug'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : report.type === 'feature'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            }`}
                          >
                            {report.type === 'bug'
                              ? '🐛 Bug'
                              : report.type === 'feature'
                              ? '💡 Feature'
                              : '💬 Note'}
                          </span>
                          <span className="font-mono text-[10px] text-[#A1A1AA]">
                            #{report.id}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${
                              report.status === 'resolved'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : report.status === 'investigating'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {report.status}
                          </span>
                          <span className="text-[10px] text-[#71717A]">
                            {new Date(report.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-[#FAFAFA] whitespace-pre-wrap leading-relaxed bg-[#121214] p-2 rounded-lg border border-[#27272A]/60">
                        {report.description}
                      </p>

                      {/* User & Telemetry details */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#71717A]">
                        <div>
                          <span className="text-[#D4D4D8] font-medium">
                            {report.userName}
                          </span>{' '}
                          ({report.userEmail})
                          {report.telemetry?.evaluatedCandidatesCount !== undefined && (
                            <span className="ml-2 text-[#818CF8]">
                              • {report.telemetry.evaluatedCandidatesCount} resumes tested
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5">
                          <select
                            value={report.status}
                            onChange={(e) =>
                              handleUpdateStatus(report.id, e.target.value as any)
                            }
                            className="bg-[#121214] border border-[#27272A] rounded px-1.5 py-0.5 text-[10px] text-white cursor-pointer"
                          >
                            <option value="new">New</option>
                            <option value="investigating">Investigating</option>
                            <option value="resolved">Resolved</option>
                          </select>

                          {report.userEmail && report.userEmail !== 'Anonymous' && (
                            <a
                              href={`mailto:${report.userEmail}?subject=Vathmos%20Update%20on%20%5B${report.id}%5D&body=Hi%20${encodeURIComponent(
                                report.userName
                              )}%2C%0A%0AThank%20you%20for%20your%20report%20regarding%3A%0A%22${encodeURIComponent(
                                report.description.slice(0, 100)
                              )}%22...%0A`}
                              className="p-1 rounded text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#27272A]"
                              title="Reply via Email"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteReport(report.id)}
                            className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                            title="Delete record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: WHITE-LABEL BRANDING (Agency $119 / ₹11,305 / Admin Exclusive) */}
          {activeTab === 'whitelabel' && (
            <div className="space-y-4 text-xs animate-in fade-in duration-150">
              {currentUser.tier === 'agency' || isAdmin ? (
                <form onSubmit={handleSaveWhiteLabel} className="space-y-4">
                  {/* Status Banner */}
                  {wlStatus && (
                    <div
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                        wlStatus.startsWith('✅')
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <span>{wlStatus}</span>
                      <button
                        type="button"
                        onClick={() => setWlStatus(null)}
                        className="text-zinc-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Enable Switch */}
                  <div className="p-3 rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white text-xs">Enable White-Label PDF Branding</p>
                      <p className="text-[11px] text-zinc-400">
                        Replace Vathmos branding with your agency logo and company name on all exported PDF Scorecards and Leaderboards.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                      <input
                        type="checkbox"
                        checked={wlEnabled}
                        onChange={(e) => setWlEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {/* Logo Upload Section */}
                  <div className="p-3.5 rounded-xl bg-[#18181B] border border-[#27272A] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-bold text-white">Agency Logo</label>
                        <p className="text-[11px] text-zinc-400">
                          PNG or JPG with transparent or light background (max 1.5MB).
                        </p>
                      </div>
                      {wlLogoDataUrl && (
                        <button
                          type="button"
                          onClick={() => setWlLogoDataUrl(undefined)}
                          className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {wlLogoDataUrl ? (
                        <div className="h-12 w-28 px-2 py-1 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden">
                          <img
                            src={wlLogoDataUrl}
                            alt="Agency Logo Preview"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="h-12 w-28 rounded-lg bg-zinc-800/80 border border-dashed border-zinc-700 flex items-center justify-center text-zinc-500">
                          <Image className="w-5 h-5 opacity-60" />
                        </div>
                      )}

                      <label className="px-3 py-1.5 rounded-lg bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] text-white text-xs font-semibold cursor-pointer transition flex items-center gap-1.5">
                        <Image className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{wlLogoDataUrl ? 'Change Logo Image' : 'Upload Agency Logo'}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Brand Information Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Agency / Company Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={wlCompanyName}
                        onChange={(e) => setWlCompanyName(e.target.value)}
                        placeholder="e.g. Apex Talent Advisory"
                        className="w-full px-3 py-2 bg-[#18181B] border border-[#27272A] focus:border-indigo-500 rounded-lg text-xs text-white focus:outline-hidden transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Custom Tagline / Header Subtitle
                      </label>
                      <input
                        type="text"
                        value={wlTagline}
                        onChange={(e) => setWlTagline(e.target.value)}
                        placeholder="e.g. Executive & Talent Search"
                        className="w-full px-3 py-2 bg-[#18181B] border border-[#27272A] focus:border-indigo-500 rounded-lg text-xs text-white focus:outline-hidden transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Contact / Report Email
                      </label>
                      <input
                        type="email"
                        value={wlContactEmail}
                        onChange={(e) => setWlContactEmail(e.target.value)}
                        placeholder="e.g. assessments@apex-talent.com"
                        className="w-full px-3 py-2 bg-[#18181B] border border-[#27272A] focus:border-indigo-500 rounded-lg text-xs text-white focus:outline-hidden transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Agency Website
                      </label>
                      <input
                        type="text"
                        value={wlWebsite}
                        onChange={(e) => setWlWebsite(e.target.value)}
                        placeholder="e.g. https://apex-talent.com"
                        className="w-full px-3 py-2 bg-[#18181B] border border-[#27272A] focus:border-indigo-500 rounded-lg text-xs text-white focus:outline-hidden transition"
                      />
                    </div>
                  </div>

                  {/* Live PDF Header Simulation Box */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-b from-[#181D2A] to-[#121520] border border-indigo-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Live PDF Header Preview</span>
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {wlEnabled ? '🟢 Active in Exports' : '⚪ Disabled (Vathmos default)'}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {wlLogoDataUrl ? (
                          <img
                            src={wlLogoDataUrl}
                            alt="Logo"
                            className="h-8 max-w-[80px] object-contain rounded"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center font-bold text-white text-xs">
                            {(wlCompanyName || 'A').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-xs uppercase tracking-wide text-white">
                            {(wlCompanyName || 'YOUR AGENCY NAME').toUpperCase()} CANDIDATE ASSESSMENT
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {wlTagline || 'CONFIDENTIAL CANDIDATE EVALUATION REPORT'} • {wlContactEmail || currentUser.email}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-mono text-emerald-400">100-PT RUBRIC</span>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={wlSaving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white shadow-md shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50"
                    >
                      {wlSaving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving Settings...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save White-Label Branding</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Non-Agency Gate: Locked Promotion Card */
                <div className="p-5 rounded-2xl bg-gradient-to-b from-[#17142A] to-[#101018] border-2 border-indigo-500/40 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                      <Lock className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        White-Label PDF Reporting is Exclusive to Agency & Scale ($119 / ₹11,305)
                      </h4>
                      <p className="text-xs text-zinc-400">
                        Deliver client-ready assessment reports with 100% your own agency branding.
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-2 text-xs text-zinc-300 pt-1">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span><strong>Upload Custom Agency Logo:</strong> Render your high-res logo at the top of candidate evaluation scorecards.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span><strong>Custom Company Name & Header:</strong> Replace Vathmos branding across Candidate Scorecard & Leaderboard PDFs.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span><strong>Recruitment Tagline & Contact Footers:</strong> Embed your custom agency email, website, and executive search tagline.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span><strong>Full 3-Mode Scoring Calibration:</strong> Standard, Strict (Auditor discipline), and Lenient rubric calibration modes.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span><strong>Dedicated Support:</strong> Priority bug handling, dedicated email (<code className="text-cyan-300">vathmossupport@gmail.com</code>), &lt;24h critical response, and direct batch-processing help.</span>
                    </li>
                  </ul>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleUpgradeFromProfile('agency')}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-bold text-xs transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Upgrade to Agency & Scale ($119 / ₹11,305) to Unlock White-Label</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-[#27272A]">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#FAFAFA] bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-[#A1A1AA]" />
              <span>Edit Profile</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
