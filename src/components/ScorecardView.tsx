import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Copy,
  Check,
  Quote,
  Target,
  Layers,
  ChevronDown,
  ChevronUp,
  Download,
  Share2,
  ExternalLink,
  Shield,
  Sparkles,
  HelpCircle,
  Lightbulb,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { EvaluationResult, InterviewQuestion } from '../types';
import { useAuth } from '../context/AuthContext';
import { buildFallbackInterviewQuestions } from '../utils/clientRubricEvaluator';

interface ScorecardViewProps {
  result: EvaluationResult;
  candidateName: string;
  candidateId?: string;
  candidateResumeText?: string;
  jobDescription?: string;
  onOpenJsonModal: () => void;
  onOpenLegalModal?: () => void;
  onUpdateCandidateResult?: (candidateId: string, updatedResult: EvaluationResult) => void;
}

export const ScorecardView: React.FC<ScorecardViewProps> = ({
  result,
  candidateName,
  candidateId,
  candidateResumeText,
  jobDescription,
  onOpenJsonModal,
  onOpenLegalModal,
  onUpdateCandidateResult,
}) => {
  const { currentUser, recordInterviewQuestionUsed } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showDetailedAudit, setShowDetailedAudit] = useState(true);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [copiedQuestionIndex, setCopiedQuestionIndex] = useState<number | null>(null);
  const [copiedAllQuestions, setCopiedAllQuestions] = useState(false);

  const breakdown = result.score_breakdown || {
    hard_requirements: 0,
    domain_depth: 0,
    verifiable_evidence: 0,
    total: result.score,
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#10B981] bg-[#10B981]/15 border-[#10B981]/30';
    if (score >= 50) return 'text-[#F59E0B] bg-[#F59E0B]/15 border-[#F59E0B]/30';
    return 'text-[#EF4444] bg-[#EF4444]/15 border-[#EF4444]/30';
  };

  const getRecommendationBadge = (rec: string, score: number) => {
    if (score >= 80) {
      return {
        label: 'Strong Fit (Tier 1)',
        style: 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30',
      };
    }
    if (score >= 65) {
      return {
        label: 'Qualified (Advance to Interview)',
        style: 'bg-[#6366F1]/15 text-[#818CF8] border-[#6366F1]/30',
      };
    }
    if (score >= 50) {
      return {
        label: 'Marginal / Phone Screen Required',
        style: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30',
      };
    }
    return {
      label: 'Unqualified / Does Not Meet Bar',
      style: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30',
    };
  };

  const badge = getRecommendationBadge(result.recommendation, result.score);

  const copyStandardJson = () => {
    const standardJson = {
      score: result.score,
      matched_skills: result.matched_skills,
      pros: result.pros,
      cons: result.cons,
      rank_reasoning: result.rank_reasoning,
    };
    navigator.clipboard.writeText(JSON.stringify(standardJson, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate 1 Pro + 2 Cons Interview Questions on demand
  const handleGenerateQuestions = async () => {
    const qLimit = currentUser?.interviewQuestionsLimit ?? 3;
    const qUsed = currentUser?.interviewQuestionsUsed ?? 0;
    const qRemaining = Math.max(0, qLimit - qUsed);

    if (qRemaining <= 0) {
      setQuestionsError(
        `You have used all ${qLimit} interview question generations on your ${
          currentUser?.tier ? currentUser.tier.toUpperCase() : 'FREE'
        } tier. Please upgrade to unlock 25, 150, or 500 generations.`
      );
      return;
    }

    if (!jobDescription) {
      setQuestionsError('Job Description is required to calibrate interview questions.');
      return;
    }

    setIsGeneratingQuestions(true);
    setQuestionsError(null);

    try {
      const response = await fetch('/api/generate-interview-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription,
          candidateName,
          resumeText: candidateResumeText || '',
          pros: result.pros || [],
          cons: result.cons || [],
          matched_skills: result.matched_skills || [],
          missing_skills: result.missing_skills || [],
        }),
      });

      let questionsList: any[] = [];
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          questionsList = data.questions;
        }
      }

      // If server returned non-200 or empty questions, generate calibrated role-aware questions locally
      if (questionsList.length === 0) {
        questionsList = buildFallbackInterviewQuestions({
          jobDescription,
          pros: result.pros,
          cons: result.cons,
          matched_skills: result.matched_skills,
          missing_skills: result.missing_skills,
        });
      }

      const updatedResult: EvaluationResult = {
        ...result,
        interview_questions: questionsList,
      };

      if (candidateId && onUpdateCandidateResult) {
        onUpdateCandidateResult(candidateId, updatedResult);
      }

      recordInterviewQuestionUsed(1);
    } catch (err: any) {
      console.log('Interview questions note:', err?.message || err);
      setQuestionsError(err.message || 'Failed to generate interview questions.');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const copySingleQuestion = (q: InterviewQuestion, index: number) => {
    const text = `[Vathmos Interview Guide - ${candidateName}]\n${q.badge}\nTarget Area: ${q.targetPoint}\n\nQUESTION:\n"${q.question}"\n\nIDEAL ANSWER / WHAT TO LISTEN FOR:\n${q.idealAnswer}\n\nCAUTION / RED FLAG ALERT:\n${q.caution}\n`;
    navigator.clipboard.writeText(text);
    setCopiedQuestionIndex(index);
    setTimeout(() => setCopiedQuestionIndex(null), 2000);
  };

  const copyAllQuestions = () => {
    if (!result.interview_questions) return;
    const text = `# Vathmos 3-Question Interview Guide: ${candidateName}
Role Calibration: 1 Pro Verification + 2 Con/Gap Probes

${result.interview_questions
  .map(
    (q, i) => `### ${q.badge}
**Targeted Point:** ${q.targetPoint}

**Question:**
"${q.question}"

**Ideal Answer Benchmark & Signals:**
${q.idealAnswer}

**Caution / Red Flag Alert:**
⚠️ ${q.caution}
`
  )
  .join('\n---\n\n')}

*Generated by Vathmos - Candidate Decision-Support System*
`;
    navigator.clipboard.writeText(text);
    setCopiedAllQuestions(true);
    setTimeout(() => setCopiedAllQuestions(false), 2000);
  };

  const exportMarkdownReport = () => {
    let md = `# Vathmos Evaluation Report: ${candidateName}
**Score:** ${result.score} / 100
**Recommendation:** ${result.recommendation}

## 100-Point Rubric Breakdown
- **Hard Requirements:** ${breakdown.hard_requirements} / 40 pts
- **Domain Depth:** ${breakdown.domain_depth} / 30 pts
- **Verifiable Evidence:** ${breakdown.verifiable_evidence} / 30 pts

## Executive Reasoning (2 Sentences)
> ${result.rank_reasoning}

## Key Strengths (Pros)
${result.pros.map((p, i) => `${i + 1}. ${p}`).join('\n')}

## Critical Gaps (Cons)
${result.cons.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Matched Skills
${result.matched_skills.map((s) => `- ${s}`).join('\n')}

## Missing / Partial Skills
${result.missing_skills.map((s) => `- ${s}`).join('\n')}
`;

    if (result.interview_questions && result.interview_questions.length > 0) {
      md += `
## Calibrated Interview Guide (1 Pro + 2 Cons)
${result.interview_questions
  .map(
    (q) => `### ${q.badge}
- **Target Area:** ${q.targetPoint}
- **Question:** "${q.question}"
- **Ideal Response:** ${q.idealAnswer}
- **Caution Alert:** ${q.caution}
`
  )
  .join('\n')}
`;
    }

    md += `
---

## Legal, Compliance & Privacy Notice
- **Advisory Decision Support:** This evaluation report is generated as an advisory candidate decision-support benchmark based strictly on objective textual comparison between the submitted resume and job requirements. In compliance with GDPR Article 22, Vathmos never executes automated hiring or adverse employment determinations. Human hiring personnel retain 100% discretion and legal accountability.
- **Anti-Bias & EEO Safeguards:** Evaluation criteria are strictly restricted to job-relevant qualifications, hard technical proficiencies, and verifiable evidence. Inquiry into race, gender, age, religion, disability, or protected personal traits is strictly prohibited under EEOC, Title VII, ADEA, and ADA frameworks.
- **In-RAM Ephemeral Processing Guarantee:** Candidate resume text and PII processed during this evaluation are maintained strictly in transient volatile memory (RAM) and are never persisted to disk storage, databases, or third-party training pipelines (candidate resumes are never stored). Zero candidate data is used to train AI models.
- **Independent Verification Requirement:** Evaluator scores, pros, cons, and interview guide alerts must be independently verified by hiring authorities through portfolio reviews, code assessments, and structured interviews.

*Generated by Vathmos - Objective Recruitment Decision-Support System*
`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Vathmos_${candidateName.replace(/\s+/g, '_')}_Scorecard.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDFReport = () => {
    const isWhiteLabelActive = Boolean(
      (currentUser?.tier === 'agency' || currentUser?.email === 'vathmossupport@gmail.com') &&
      currentUser?.whiteLabel?.enabled
    );
    const wl = currentUser?.whiteLabel;
    const agencyName = (wl?.companyName || currentUser?.companyName || 'Talent Advisory').trim();
    const agencyTagline = (wl?.tagline || 'Technical Executive Search & Candidate Evaluation').trim();
    const agencyContact = (wl?.contactEmail || currentUser?.email || '').trim();
    const agencyWebsite = (wl?.website || '').trim();

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width; // typically 210
    const pageHeight = doc.internal.pageSize.height; // typically 297
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2); // 180
    
    let y = 15;

    const drawPageDecorations = () => {
      // Small grey top border or footer
      doc.setDrawColor(220, 225, 230);
      doc.setLineWidth(0.5);
      doc.line(margin, 10, pageWidth - margin, 10);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      
      doc.setFontSize(8);
      doc.setTextColor(120, 130, 140);
      doc.setFont('helvetica', 'normal');
      const footerTitle = isWhiteLabelActive
        ? `Prepared by ${agencyName} • Confidential Evaluation Report`
        : 'Vathmos - Recruitment Decision Support Summary';
      doc.text(footerTitle, margin, pageHeight - 7);
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth - margin - 40, pageHeight - 7);
    };

    const checkPageOverflow = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - 18) {
        doc.addPage();
        drawPageDecorations();
        y = 20; // Reset to top of new page
      }
    };

    // Draw initial decorations on first page
    drawPageDecorations();

    // 1. Title block on first page
    if (isWhiteLabelActive) {
      doc.setFillColor(24, 30, 48); // Deep indigo slate
      doc.rect(margin, 15, contentWidth, 26, 'F');

      let textLeft = margin + 6;
      if (wl?.logoDataUrl) {
        try {
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(margin + 3, 17, 24, 22, 2, 2, 'F');
          doc.addImage(wl.logoDataUrl, undefined, margin + 4, 18, 22, 20);
          textLeft = margin + 31;
        } catch {
          // Gracefully continue without logo if image data is invalid
          textLeft = margin + 6;
        }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.text(`${agencyName.toUpperCase()} CANDIDATE ASSESSMENT`, textLeft, 23);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(210, 220, 235);
      const subtitle = `${agencyTagline.toUpperCase()}${agencyContact ? ` • ${agencyContact}` : ''}`;
      doc.text(subtitle, textLeft, 29);

      if (agencyWebsite) {
        doc.setFontSize(7.5);
        doc.setTextColor(140, 180, 225);
        doc.text(agencyWebsite, textLeft, 35);
      }

      y = 50;
    } else {
      doc.setFillColor(30, 41, 59); // Dark blue / slate background
      doc.rect(margin, 15, contentWidth, 24, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('VATHMOS CANDIDATE ASSESSMENT REPORT', margin + 6, 24);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('OBJECTIVE RECRUITMENT DECISION-SUPPORT EVALUATION', margin + 6, 30);
      
      y = 48;
    }

    // Candidate details
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(candidateName, margin, y);
    y += 7;

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 110, 120);
    doc.text(`Evaluation Date: ${new Date().toLocaleDateString()}`, margin, y);
    y += 10;

    // Score Dashboard Card
    doc.setFillColor(245, 247, 250);
    doc.rect(margin, y, contentWidth, 18, 'F');
    
    // Draw score text
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('OVERALL RATING:', margin + 6, y + 11);
    
    // Colored score badge
    const score = result.score;
    if (score >= 80) {
      doc.setTextColor(16, 185, 129); // Green
    } else if (score >= 65) {
      doc.setTextColor(99, 102, 241); // Indigo
    } else if (score >= 50) {
      doc.setTextColor(245, 158, 11); // Amber
    } else {
      doc.setTextColor(239, 68, 68); // Red
    }
    doc.setFontSize(13);
    doc.text(`${score} / 100`, margin + 42, y + 11);

    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('RECOMMENDATION:', margin + 78, y + 11);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    
    const recText = badge.label || 'Evaluated';
    doc.text(recText, margin + 118, y + 11);

    y += 26;

    // 2. Rubric Breakdown
    checkPageOverflow(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('100-Point Rubric Breakdown', margin, y);
    
    // Indigo underline
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(1);
    doc.line(margin, y + 2, margin + 50, y + 2);
    y += 8;

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`• Hard Requirements (Skills, tools & prerequisites): ${breakdown.hard_requirements} / 40 pts`, margin + 4, y);
    y += 5.5;
    doc.text(`• Domain Depth (Past role relevance, seniority): ${breakdown.domain_depth} / 30 pts`, margin + 4, y);
    y += 5.5;
    doc.text(`• Verifiable Evidence (Quantifiable metrics, outcomes): ${breakdown.verifiable_evidence} / 30 pts`, margin + 4, y);
    y += 11;

    // 3. Final Assessment
    checkPageOverflow(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Executive Summary & Assessment', margin, y);
    
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(1);
    doc.line(margin, y + 2, margin + 60, y + 2);
    y += 8;

    doc.setFont('helvetica', 'oblique');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    const splitReasoning = doc.splitTextToSize(result.rank_reasoning || 'No analysis available.', contentWidth - 8);
    
    const reasoningHeight = (splitReasoning.length * 4.5) + 6;
    checkPageOverflow(reasoningHeight);
    
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y - 3, contentWidth, reasoningHeight, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.rect(margin, y - 3, contentWidth, reasoningHeight, 'D');
    
    doc.text(splitReasoning, margin + 4, y + 2.5);
    y += reasoningHeight + 10;

    // 4. Strengths (Pros)
    if (result.pros && result.pros.length > 0) {
      checkPageOverflow(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(16, 185, 129); // Emerald
      doc.text('Key Strengths (Pros)', margin, y);
      
      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(1);
      doc.line(margin, y + 2, margin + 35, y + 2);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      
      result.pros.forEach((pro, i) => {
        const splitPro = doc.splitTextToSize(`${i + 1}. ${pro}`, contentWidth - 8);
        checkPageOverflow(splitPro.length * 4.5 + 4);
        doc.text(splitPro, margin + 4, y);
        y += (splitPro.length * 4.5) + 3;
      });
      y += 6;
    }

    // 5. Critical Gaps & Risks (Cons)
    if (result.cons && result.cons.length > 0) {
      checkPageOverflow(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(245, 158, 11); // Amber
      doc.text('Critical Gaps & Risks (Cons)', margin, y);
      
      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(1);
      doc.line(margin, y + 2, margin + 45, y + 2);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);

      result.cons.forEach((con, i) => {
        const splitCon = doc.splitTextToSize(`${i + 1}. ${con}`, contentWidth - 8);
        checkPageOverflow(splitCon.length * 4.5 + 4);
        doc.text(splitCon, margin + 4, y);
        y += (splitCon.length * 4.5) + 3;
      });
      y += 6;
    }

    // 6. Skills matched / missing
    checkPageOverflow(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Requirements Matching Analysis', margin, y);
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(1);
    doc.line(margin, y + 2, margin + 55, y + 2);
    y += 8;

    // Matched skills
    const matchedStr = result.matched_skills && result.matched_skills.length > 0 
      ? result.matched_skills.join(', ') 
      : 'None detected';
    const splitMatched = doc.splitTextToSize(matchedStr, contentWidth - 40);
    checkPageOverflow(splitMatched.length * 4.5 + 4);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(16, 185, 129);
    doc.text('Matched Skills:', margin + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(splitMatched, margin + 35, y);
    y += (splitMatched.length * 4.5) + 4;

    // Missing skills
    const missingStr = result.missing_skills && result.missing_skills.length > 0 
      ? result.missing_skills.join(', ') 
      : 'None (All mandatory requirements satisfied)';
    const splitMissing = doc.splitTextToSize(missingStr, contentWidth - 40);
    checkPageOverflow(splitMissing.length * 4.5 + 4);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(239, 68, 68);
    doc.text('Missing Skills:', margin + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(splitMissing, margin + 35, y);
    y += (splitMissing.length * 4.5) + 8;

    // 7. Calibrated Interview Questions (if generated)
    if (result.interview_questions && result.interview_questions.length > 0) {
      checkPageOverflow(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(99, 102, 241);
      doc.text('Calibrated Interview Guide (1 Pro + 2 Cons)', margin, y);
      doc.setDrawColor(99, 102, 241);
      doc.setLineWidth(1);
      doc.line(margin, y + 2, margin + 75, y + 2);
      y += 8;

      result.interview_questions.forEach((q, idx) => {
        // Calculate dynamic height needed for this specific question card block to avoid splitting mid-card!
        const parsedBadge = q.badge || `Question ${idx + 1}`;
        const headerText = `${parsedBadge} - Target: ${q.targetPoint}`;
        const splitQuestion = doc.splitTextToSize(`"${q.question}"`, contentWidth - 12);
        const splitIdeal = doc.splitTextToSize(`Ideal Answer Guide: ${q.idealAnswer}`, contentWidth - 12);
        const splitCaution = doc.splitTextToSize(`Caution Alert: ${q.caution}`, contentWidth - 12);
        
        const questionBlockHeight = 6 + (splitQuestion.length * 4.5) + 2 + (splitIdeal.length * 4.2) + 2 + (splitCaution.length * 4.2) + 12;
        checkPageOverflow(questionBlockHeight);
        
        // Background card outline
        doc.setFillColor(250, 251, 253);
        doc.rect(margin + 2, y, contentWidth - 4, questionBlockHeight - 6, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.rect(margin + 2, y, contentWidth - 4, questionBlockHeight - 6, 'D');
        
        y += 5;

        // Print header for question
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(99, 102, 241);
        doc.text(headerText, margin + 6, y);
        y += 5.5;

        // Print actual question text
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);
        doc.text(splitQuestion, margin + 6, y);
        y += (splitQuestion.length * 4.5) + 2;

        // Print ideal response
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(splitIdeal, margin + 6, y);
        y += (splitIdeal.length * 4.2) + 2;

        // Print caution
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(180, 83, 9); // Amber
        doc.text(splitCaution, margin + 6, y);
        y += (splitCaution.length * 4.2) + 8;
      });
    }

    // 6. Comprehensive Legal & Compliance Notice
    const legalNoticeHeight = 44;
    checkPageOverflow(legalNoticeHeight + 5);

    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, legalNoticeHeight, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, contentWidth, legalNoticeHeight, 'D');

    // Amber accent marker on the left
    doc.setFillColor(245, 158, 11);
    doc.rect(margin, y, 3, legalNoticeHeight, 'F');

    let legY = y + 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('LEGAL & COMPLIANCE NOTICE • FAIR HIRING & PRIVACY GUARANTEE', margin + 6, legY);
    legY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);

    const leg1 = doc.splitTextToSize('• Advisory Decision Support: Vathmos benchmarks candidate credentials strictly through objective textual comparison. In compliance with GDPR Article 22, employment decisions are never automated. Human hiring personnel retain 100% discretion and legal accountability.', contentWidth - 10);
    doc.text(leg1, margin + 6, legY);
    legY += (leg1.length * 3.5) + 1.5;

    const leg2 = doc.splitTextToSize('• Anti-Bias & EEO Protection: Evaluation rubrics are restricted to job-relevant qualifications and verifiable technical evidence. Protected attributes (race, gender, age, religion, disability) are strictly excluded in accordance with EEOC, Title VII, and ADEA standards.', contentWidth - 10);
    doc.text(leg2, margin + 6, legY);
    legY += (leg2.length * 3.5) + 1.5;

    const leg3 = doc.splitTextToSize('• In-RAM Ephemeral Processing: Candidate resume data is processed exclusively in transient volatile memory (RAM) and is never persisted to disk or databases. Candidate resumes are processed in temporary memory and never stored.', contentWidth - 10);
    doc.text(leg3, margin + 6, legY);

    y += legalNoticeHeight + 6;

    doc.save(
      isWhiteLabelActive
        ? `${candidateName.replace(/\s+/g, '_')}_${agencyName.replace(/\s+/g, '_')}_Assessment.pdf`
        : `${candidateName.replace(/\s+/g, '_')}_Vathmos_Report.pdf`
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Overview Card */}
      <div className="bg-[#12151E]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/[0.06]">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Evaluation Scorecard
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.style}`}
              >
                {badge.label}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {candidateName}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
              Objective calibration against target Job Description using direct evidence and requirements mapping.
            </p>
          </div>

          <div className="flex items-center gap-4 self-start lg:self-center">
            <div className="flex items-center gap-3 bg-[#0E1018]/90 border border-white/[0.06] rounded-2xl p-3 sm:px-5 sm:py-3.5 shadow-2xs">
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                  Total Score
                </span>
                <span className="text-xs font-mono text-zinc-400">out of 100 pts</span>
              </div>
              <div
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center border font-mono text-2xl sm:text-3xl font-extrabold ${getScoreColor(
                  result.score
                )}`}
              >
                {result.score}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                id="copy-strict-json-btn"
                onClick={copyStandardJson}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-200 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Copy standard JSON output (score, matched_skills, pros, cons, rank_reasoning)"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copied JSON!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
              <button
                type="button"
                id="view-full-json-modal-btn"
                onClick={onOpenJsonModal}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/25 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Raw JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Rubric Dimension Score Bars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
          {/* Dimension 1 */}
          <div className="bg-[#0E1018]/80 border border-white/[0.06] rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold text-white">Hard Requirements</span>
              </div>
              <span className="text-xs font-mono font-bold text-sky-400">
                {breakdown.hard_requirements} / 40 pts
              </span>
            </div>
            <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-sky-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (breakdown.hard_requirements / 40) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-400">
              Mandatory skills, required tools, credentials & minimum YOE.
            </p>
          </div>

          {/* Dimension 2 */}
          <div className="bg-[#0E1018]/80 border border-white/[0.06] rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-300" />
                <span className="text-xs font-bold text-white">Domain Depth</span>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-300">
                {breakdown.domain_depth} / 30 pts
              </span>
            </div>
            <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (breakdown.domain_depth / 30) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-400">
              Direct relevance of past roles, project/business scope, and seniority.
            </p>
          </div>

          {/* Dimension 3 */}
          <div className="bg-[#0E1018]/80 border border-white/[0.06] rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">Verifiable Evidence</span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {breakdown.verifiable_evidence} / 30 pts
              </span>
            </div>
            <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (breakdown.verifiable_evidence / 30) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-400">
              Concrete quantifiable outcomes, metrics, and verifiable project impact.
            </p>
          </div>
        </div>

        {/* 2-Sentence Rank Reasoning */}
        <div className="mt-5 p-4 rounded-xl bg-[#0E1018]/90 border border-white/[0.06] text-white flex items-start gap-3 shadow-inner">
          <Quote className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
              Rank Reasoning (Executive Summary)
            </span>
            <p className="text-xs sm:text-sm leading-relaxed text-zinc-100 font-medium">
              {result.rank_reasoning}
            </p>
          </div>
        </div>
      </div>

      {/* Pros (3 Strengths) & Cons (3 Gaps) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Pros (3 Strengths) */}
        <div className="bg-[#12151E]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">3 Key Strengths (Pros)</h3>
            </div>
            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
              High Match
            </span>
          </div>

          <div className="space-y-2.5 flex-1">
            {result.pros.map((pro, index) => (
              <div
                key={index}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs sm:text-sm text-zinc-100 leading-relaxed"
              >
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 font-mono">
                  {index + 1}
                </span>
                <span>{pro}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cons (3 Gaps / Risks) */}
        <div className="bg-[#12151E]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">3 Key Gaps & Risks (Cons)</h3>
            </div>
            <span className="text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
              Attention Required
            </span>
          </div>

          <div className="space-y-2.5 flex-1">
            {result.cons.map((con, index) => (
              <div
                key={index}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs sm:text-sm text-zinc-100 leading-relaxed"
              >
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 font-mono">
                  {index + 1}
                </span>
                <span>{con}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Matched Skills vs Missing Skills */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Matched Skills */}
        <div className="bg-[#12151E]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 shadow-2xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Matched Requirements & Competencies ({result.matched_skills?.length || 0})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {result.matched_skills && result.matched_skills.length > 0 ? (
              result.matched_skills.map((skill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#0E1018]/90 text-zinc-200 border border-white/[0.06]"
                >
                  <Check className="w-3 h-3 text-emerald-400" />
                  {skill}
                </span>
              ))
            ) : (
              <p className="text-xs text-zinc-500 italic">No direct hard requirement matches found.</p>
            )}
          </div>
        </div>

        {/* Missing / Unmet Skills */}
        <div className="bg-[#12151E]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 shadow-2xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            Missing / Unmet Mandatory Requirements ({result.missing_skills?.length || 0})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {result.missing_skills && result.missing_skills.length > 0 ? (
              result.missing_skills.map((skill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20"
                >
                  <span className="text-rose-400 font-bold">✕</span>
                  {skill}
                </span>
              ))
            ) : (
              <p className="text-xs text-emerald-400 font-medium">All mandatory JD requirements satisfied!</p>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Rubric Audit Notes Accordion */}
      {result.rubric_analysis && (
        <div className="bg-[#12151E]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDetailedAudit(!showDetailedAudit)}
            className="w-full p-4 flex items-center justify-between bg-[#0E1018]/80 hover:bg-white/[0.04] transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Audited Rubric Dimension Notes
              </span>
              <span className="text-xs text-zinc-400">
                (Detailed calibration rationale)
              </span>
            </div>
            {showDetailedAudit ? (
              <ChevronUp className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </button>

          {showDetailedAudit && (
            <div className="p-5 space-y-4 border-t border-white/[0.06] text-xs sm:text-sm">
              <div className="space-y-1">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-sky-400" />
                  Hard Requirements Audit ({breakdown.hard_requirements}/40 pts):
                </span>
                <p className="text-zinc-400 leading-relaxed pl-5">
                  {result.rubric_analysis.hard_requirements_notes}
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-300" />
                  Domain Depth Audit ({breakdown.domain_depth}/30 pts):
                </span>
                <p className="text-zinc-400 leading-relaxed pl-5">
                  {result.rubric_analysis.domain_depth_notes}
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Verifiable Evidence Audit ({breakdown.verifiable_evidence}/30 pts):
                </span>
                <p className="text-zinc-400 leading-relaxed pl-5">
                  {result.rubric_analysis.verifiable_evidence_notes}
                </p>
              </div>

              {result.key_quotes && result.key_quotes.length > 0 && (
                <div className="pt-3 border-t border-white/[0.06]">
                  <span className="font-bold text-white block mb-2">
                    Direct Resume Excerpts (Verifiable Evidence):
                  </span>
                  <div className="space-y-1.5 pl-3 border-l-2 border-sky-500">
                    {result.key_quotes.map((q, i) => (
                      <p key={i} className="text-xs text-zinc-400 italic">
                        "{q}"
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ON-DEMAND AI INTERVIEW QUESTION GENERATOR (1 PRO + 2 CONS) */}
      {/* ========================================================================= */}
      <div className="bg-[#12151E]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
        {/* Module Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
              <span className="text-xs font-mono uppercase tracking-wider text-sky-300 font-bold">
                Interviewer Decision Support
              </span>
            </div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-400" />
              AI Interview Question Guide (1 Pro + 2 Cons Formula)
            </h3>
            <p className="text-xs text-zinc-400">
              Generates 3 calibrated questions: 1 to verify claimed strengths and 2 to probe role gaps and real-world risks.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {result.interview_questions && result.interview_questions.length > 0 && (
              <button
                type="button"
                id="copy-all-interview-questions-btn"
                onClick={copyAllQuestions}
                className="px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Copy all 3 interview questions with ideal answers and caution warnings"
              >
                {copiedAllQuestions ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copied Guide!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Copy Guide</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              id="trigger-generate-questions-btn"
              onClick={handleGenerateQuestions}
              disabled={isGeneratingQuestions}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              {isGeneratingQuestions ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Calibrating Questions...</span>
                </>
              ) : result.interview_questions ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate Questions</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate 3-Question Interview Guide</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error message if generation failed */}
        {questionsError && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{questionsError}</span>
            </div>
            <button
              type="button"
              onClick={handleGenerateQuestions}
              className="px-2.5 py-1 rounded-lg bg-rose-900/70 hover:bg-rose-800 border border-rose-700 text-white font-medium text-[11px] shrink-0 cursor-pointer transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BIG COMPLIANCE, LEGAL & ETHICAL PROTECTION DISCLAIMER CARD */}
        {/* ========================================================================= */}
        <div className="bg-[#0E1018]/90 border border-amber-500/25 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Shield className="w-4 h-4" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Advisory & Compliance Notice • Legal Protection & Fair Hiring Framework
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                These AI-generated interview questions, benchmark criteria, and caution alerts are decision-support benchmarks generated strictly by textual comparison between the uploaded resume and job description.
              </p>

              {/* What this disclaimer protects against: */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-[11px] text-zinc-400">
                <div className="p-3 rounded-xl bg-[#12151E]/90 border border-white/[0.06] space-y-1">
                  <span className="font-bold text-white flex items-center gap-1">
                    <span className="text-amber-400">⚖️</span> Anti-Bias & EEO Protection
                  </span>
                  <p className="leading-normal">
                    Questions probe verifiable role claims and stated JD gaps only. Inquiry into age, gender, race, disability, or protected personal traits is strictly prohibited.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#12151E]/90 border border-white/[0.06] space-y-1">
                  <span className="font-bold text-white flex items-center gap-1">
                    <span className="text-sky-300">🛡️</span> Advisory Decision Support
                  </span>
                  <p className="leading-normal">
                    Vathmos never makes automated employment or rejection determinations. The human hiring manager retains 100% discretion and legal accountability.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#12151E]/90 border border-white/[0.06] space-y-1">
                  <span className="font-bold text-white flex items-center gap-1">
                    <span className="text-emerald-400">🔍</span> Verification Requirement
                  </span>
                  <p className="leading-normal">
                    AI benchmarks must not be taken as absolute truth. Interviewers should independently verify portfolios, work history, reported metrics, and references.
                  </p>
                </div>
              </div>

              {onOpenLegalModal && (
                <div className="pt-2.5 flex items-center justify-between flex-wrap gap-2 border-t border-white/[0.06]">
                  <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Zero Disk Persistence • Transient In-RAM Lifecycle • GDPR Art. 17 & 22 Compliant
                  </span>
                  <button
                    type="button"
                    onClick={onOpenLegalModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-300 hover:text-white bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition-all cursor-pointer shadow-2xs"
                  >
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>View Legal & Compliance Charter</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* QUESTIONS DISPLAY AREA */}
        {result.interview_questions && result.interview_questions.length > 0 ? (
          <div className="space-y-5 pt-2">
            {result.interview_questions.map((q, idx) => {
              const isPro = q.type === 'pro_verification' || idx === 0;
              const isGapCon = q.type === 'con_gap_probe' || idx === 1;

              const borderAccent = isPro
                ? 'border-emerald-500/25 bg-emerald-500/5'
                : isGapCon
                ? 'border-amber-500/25 bg-amber-500/5'
                : 'border-indigo-500/25 bg-indigo-500/5';

              const badgeColor = isPro
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : isGapCon
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';

              return (
                <div
                  key={idx}
                  className={`rounded-2xl border ${borderAccent} p-5 space-y-4 transition-all shadow-xs`}
                >
                  {/* Top Bar: Badge & Copy */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${badgeColor}`}
                      >
                        {q.badge || (isPro ? 'Q1 • Verifying Claimed Strength (Pro)' : isGapCon ? 'Q2 • Probing Missing Requirement (Con)' : 'Q3 • Architectural / Risk Probe (Con)')}
                      </span>
                      <span className="text-xs text-zinc-400 font-mono">
                        Target Area: <strong className="text-white font-medium">{q.targetPoint}</strong>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => copySingleQuestion(q, idx)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Copy this specific question, ideal answer, and caution note"
                    >
                      {copiedQuestionIndex === idx ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-zinc-400" />
                          <span>Copy Question</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* The Interview Question */}
                  <div className="p-3.5 rounded-xl bg-[#0E1018]/90 border border-white/[0.06]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block mb-1">
                      Interviewer Prompt to Ask:
                    </span>
                    <p className="text-sm sm:text-base font-semibold text-white leading-relaxed">
                      "{q.question}"
                    </p>
                  </div>

                  {/* Ideal Response & What to Listen For */}
                  <div className="p-3.5 rounded-xl bg-[#0E1018]/80 border border-white/[0.06] space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                      <Lightbulb className="w-4 h-4" />
                      <span>Ideal Response Benchmark & What to Listen For:</span>
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed pl-5">
                      {q.idealAnswer}
                    </p>
                  </div>

                  {/* Specific Red Flag Caution Alert */}
                  <div className="p-3 rounded-xl bg-amber-950/25 border border-amber-800/40 text-xs text-amber-300 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-300">Caution Alert / Red Flags: </span>
                      <span className="text-amber-200/90 leading-relaxed">{q.caution}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty state prompt to click button */
          <div className="p-8 rounded-2xl bg-[#0E1018]/80 border border-white/[0.06] text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-sky-500/15 text-sky-400 mx-auto flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white">No Interview Questions Generated Yet</h4>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              Click the <strong className="text-white">"Generate 3-Question Interview Guide"</strong> button above to synthesize 1 validation question targeting their top resume strength and 2 probing questions targeting their primary gaps.
            </p>
          </div>
        )}
      </div>

      {/* Decision-Support Recommendation Banner / Disclaimer */}
      <div className="bg-[#12151E]/80 backdrop-blur-md border border-white/[0.08] rounded-xl p-3.5 sm:px-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-400 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
            <Quote className="w-3.5 h-3.5" />
          </div>
          <p className="leading-relaxed">
            <span className="text-zinc-200 font-medium">Recruitment Advisory:</span> This is a tool designed to save your priceless time, but we recommend double-checking candidate credentials before proceeding.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 self-start sm:self-auto px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/[0.04] text-zinc-300 border border-white/[0.08] whitespace-nowrap">
          <span>Human-in-the-Loop</span>
        </div>
      </div>

      {/* Export Footer Bar */}
      <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span>Evaluated with Vathmos calibrated 100-point rubric</span>
          {Boolean(
            (currentUser?.tier === 'agency' || currentUser?.email === 'vathmossupport@gmail.com') &&
            currentUser?.whiteLabel?.enabled
          ) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Agency White-Label Active: {currentUser?.whiteLabel?.companyName || currentUser?.companyName}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="export-pdf-report-btn"
            onClick={exportPDFReport}
            className="inline-flex items-center gap-1.5 text-white font-medium px-3.5 py-1.5 rounded-xl bg-blue-600 border border-blue-500 hover:bg-blue-500 shadow-2xs transition-colors cursor-pointer active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>Export PDF Summary</span>
          </button>
          <button
            type="button"
            id="export-markdown-report-btn"
            onClick={exportMarkdownReport}
            className="inline-flex items-center gap-1.5 text-zinc-200 hover:text-white font-medium px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] shadow-2xs transition-colors cursor-pointer active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span>Export Scorecard (.md)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
