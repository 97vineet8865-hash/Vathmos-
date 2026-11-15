import { GoogleGenAI, ThinkingLevel } from '@google/genai';

function inferRoleInfo(jobDescription?: string): { roleTitle: string; isTechnical: boolean; domainLabel: string } {
  const safeJD = String(jobDescription || '').trim();
  const isTechnical = /\b(software\s+engineer|developer|backend|frontend|full[\s-]?stack|devops|sre|golang|python|java\b|typescript|react|kubernetes|microservices)\b/i.test(
    safeJD
  );

  let domainLabel = isTechnical ? 'Engineering' : 'Hiring';
  if (!isTechnical) {
    if (/\b(sales|account\s+executive|business\s+development|bdr|sdr|quota|revenue)\b/i.test(safeJD)) domainLabel = 'Sales';
    else if (/\b(marketing|growth|seo|sem|campaign|roas|brand)\b/i.test(safeJD)) domainLabel = 'Marketing & Growth';
    else if (/\b(human\s+resources|hr|talent\s+acquisition|recruiter|payroll|onboarding)\b/i.test(safeJD)) domainLabel = 'People & Talent';
    else if (/\b(accountant|accounting|finance|fp&a|audit|tax|gaap)\b/i.test(safeJD)) domainLabel = 'Finance';
    else if (/\b(operations|supply\s+chain|logistics|procurement|sla|sop)\b/i.test(safeJD)) domainLabel = 'Operations';
  }

  let roleTitle = `${domainLabel} Role`;
  const titleMatch = safeJD.match(/(?:job\s*title|role|position)\s*[:\-–]\s*([^\r\n]{4,65})/i);
  if (titleMatch?.[1]) {
    roleTitle = titleMatch[1].trim();
  } else {
    const firstLine = safeJD.split(/[\r\n]+/).map((l) => l.trim()).find((l) => l.length >= 4 && l.length <= 65);
    if (firstLine && !/^(about\s+us|company|overview|summary|we\s+are\s+looking)/i.test(firstLine)) {
      roleTitle = firstLine.replace(/[.:]+$/, '').trim();
    }
  }

  return { roleTitle, isTechnical, domainLabel };
}

function generateRecruiterAssistantResponse(
  message: string,
  candidatesSummary?: any[],
  jobDescription?: string,
  history?: any[],
  recruiterEmail?: string
): string {
  const msg = String(message || '').trim();
  const msgLower = msg.toLowerCase();
  const { roleTitle, isTechnical, domainLabel } = inferRoleInfo(jobDescription);
  const interviewType = isTechnical ? 'technical conversation' : 'interview conversation';
  const roundFocus = isTechnical
    ? 'your projects and technical decisions'
    : 'your past results, workflow ownership, and role fit';

  const sortedCandidates = [...(candidatesSummary || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
  let targetCandObj = sortedCandidates[0];
  for (const cand of sortedCandidates) {
    if (cand.name && msgLower.includes(String(cand.name).toLowerCase().split(' ')[0])) {
      targetCandObj = cand;
      break;
    }
  }
  const topCand = targetCandObj ? targetCandObj.name : 'Candidate';
  const topScore = targetCandObj?.score ?? 88;

  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const emailMatch = msg.match(emailRegex);
  const specifiedEmail = emailMatch ? emailMatch[1] : null;
  const fallbackAddr = recruiterEmail || 'candidate@example.com';
  const targetEmail = specifiedEmail || targetCandObj?.email || fallbackAddr;

  // 1. Explicit request to send message/email
  if (
    specifiedEmail ||
    msgLower.includes('send that msg') ||
    msgLower.includes('send that message') ||
    msgLower.includes('send to my email') ||
    msgLower.includes('send this to my email') ||
    msgLower.includes('send to an email of mine') ||
    msgLower.includes('send to a email of mine') ||
    msgLower.includes('send this msg') ||
    msgLower.includes('send this message') ||
    msgLower.includes('send email') ||
    msgLower.includes('forward')
  ) {
    const lastAssistantMsg = Array.isArray(history)
      ? [...history].reverse().find((h: any) => h.role === 'assistant' && h.text && !String(h.text).includes('Safety Guarantee'))
      : null;

    const stagedBody =
      lastAssistantMsg?.text && String(lastAssistantMsg.text).length > 40
        ? String(lastAssistantMsg.text)
        : `Hi ${topCand},\n\nThank you for applying for our ${roleTitle} opening. Our ${domainLabel} team reviewed your background against our role benchmarks and were impressed by your experience.\n\nWe would love to invite you for a 45-minute ${interviewType} to discuss ${roundFocus}.\n\nTo help us schedule smoothly, please reply with:\n1. Your current notice period and earliest join date.\n2. Your expected compensation / CTC range.\n\nLooking forward to speaking with you!\n\nWarm regards,\nVathmos Recruitment Team`;

    const action = {
      type: 'interview_invite',
      candidateName: topCand,
      candidateEmail: targetEmail,
      subject: `Interview Invitation & Next Steps: ${roleTitle}`,
      body: stagedBody,
      screeningQuestions: {
        expectedSalary: 'Please share your expected annual salary / CTC range.',
        noticePeriod: 'What is your current notice period / earliest join date?',
        availability: `What times work best for a 45-minute ${interviewType} next week?`,
      },
    };

    return `I have prepared the email dispatch draft for you, addressed to **${targetEmail}**.

🛡️ **Human Approval Required**: I will **never** send this email automatically without your explicit permission. Please review or edit the recipient email and message below, then click **"Approve & Send Email"** to deliver it via Resend.

\`\`\`vathmos_email_action
${JSON.stringify(action, null, 2)}
\`\`\``;
  }

  // 2. "Who should I hire?"
  if (
    msgLower.includes('who should i hire') ||
    msgLower.includes('what i shall hire') ||
    msgLower.includes('who to hire') ||
    msgLower.includes('who is best') ||
    msgLower.includes('recommend') ||
    msgLower.includes('who won') ||
    msgLower.includes('winner')
  ) {
    if (sortedCandidates.length > 0) {
      const c1 = sortedCandidates[0];
      const c2 = sortedCandidates.length > 1 ? sortedCandidates[1] : null;

      let advice = `Based on your ${roleTitle} criteria and 100-point rubric benchmarks, here is my honest hiring counsel:\n\n`;
      advice += `🥇 **Primary Recommendation: ${c1.name} (${c1.score}/100 — ${c1.recommendation || 'Strong Match'})**\n`;
      if (c1.pros && c1.pros.length > 0) {
        advice += `• **Core Strengths:** ${c1.pros.slice(0, 2).join('; ')}\n`;
      }
      if (c1.matched_skills && c1.matched_skills.length > 0) {
        advice += `• **Verified Qualifications:** ${c1.matched_skills.slice(0, 4).join(', ')}\n`;
      }
      if (c1.cons && c1.cons.length > 0) {
        advice += `• **Interview Probing Areas:** ${c1.cons.slice(0, 2).join('; ')}\n`;
      }

      if (c2) {
        advice += `\n🥈 **Runner-Up: ${c2.name} (${c2.score}/100)**\n`;
        advice += `• Solid baseline alignment, though slightly behind ${c1.name} on verifiable outcomes and role-specific proof.\n`;
      }

      advice += `\n💡 **My Recruiter Advice:** Before making an offer, verify:\n`;
      advice += `1. Current notice period / earliest start date.\n`;
      advice += `2. Expected CTC / salary expectations.\n\n`;
      advice += `Would you like me to draft an **Interview Invitation Email** for **${c1.name}** (with your review before sending)?`;

      return advice;
    }

    return `I'm ready to advise you! Once you upload and evaluate candidate resumes against your Job Description, I will analyze their scores, explain trade-offs in plain human terms, and help you draft and approve candidate emails.`;
  }

  // 3. Compare candidates
  if (msgLower.includes('compare') || msgLower.includes('difference') || msgLower.includes('versus') || msgLower.includes('vs')) {
    if (sortedCandidates.length > 1) {
      const c1 = sortedCandidates[0];
      const c2 = sortedCandidates[1];
      return `Candidate Comparison for **${roleTitle}**: **${c1.name}** vs **${c2.name}**\n\n• **${c1.name} (${c1.score ?? 85}/100):** Stronger evidence across ${(c1.matched_skills || ['Core Requirements']).slice(0, 3).join(', ')}.\n• **${c2.name} (${c2.score ?? 70}/100):** Competent baseline, with gaps in ${(c2.missing_skills || ['Target Requirements']).slice(0, 2).join(', ')}.\n\n**My Counsel:** Advance **${c1.name}** first and validate real-world ownership of their top reported outcomes.`;
    }
  }

  // 4. Draft interview invite
  if (
    msgLower.includes('invite') ||
    msgLower.includes('interview') ||
    msgLower.includes('schedule') ||
    msgLower.includes('hiring letter') ||
    (msgLower.includes('email') && !msgLower.includes('reject'))
  ) {
    const action = {
      type: 'interview_invite',
      candidateName: topCand,
      candidateEmail: targetEmail,
      subject: `Interview Invitation: Next Steps for ${roleTitle}`,
      body: `Hi ${topCand},\n\nThank you for your application for our ${roleTitle} opening. Our hiring team evaluated your profile against our role benchmarks (${topScore}/100) and were impressed by your demonstrated work.\n\nWe would love to invite you for a 45-minute ${interviewType} to discuss ${roundFocus}.\n\nTo help us schedule smoothly, please reply with:\n1. Your current notice period / earliest start date.\n2. Your expected compensation / CTC range.\n\nLooking forward to speaking with you!\n\nWarm regards,\nVathmos Recruitment Team`,
      screeningQuestions: {
        expectedSalary: 'Please share your expected annual salary / CTC range.',
        noticePeriod: 'What is your current notice period / earliest join date?',
        availability: `What times work best for a 45-minute ${interviewType} next week?`,
      },
    };

    return `I have prepared a tailored interview invitation for **${topCand}**.

🛡️ **Human Approval Required**: I will never send this email automatically. Review and edit any fields below, then click **"Approve & Send Email"**.

\`\`\`vathmos_email_action
${JSON.stringify(action, null, 2)}
\`\`\``;
  }

  // 5. Draft rejection letter
  if (msgLower.includes('reject') || msgLower.includes('declined') || msgLower.includes('pass') || msgLower.includes('not selected')) {
    const rejectCand = sortedCandidates.length > 1 ? sortedCandidates[sortedCandidates.length - 1].name : topCand;
    const rejectEmail = specifiedEmail || fallbackAddr;
    const action = {
      type: 'rejection',
      candidateName: rejectCand,
      candidateEmail: rejectEmail,
      subject: `Update regarding your application for ${roleTitle}`,
      body: `Hi ${rejectCand},\n\nThank you for taking the time to share your background and apply for the ${roleTitle} position. We genuinely appreciate your interest in our team.\n\nAfter careful evaluation, we have decided to move forward with candidates whose experience aligns more closely with our immediate requirements for this cycle.\n\nWe wish you every success in your next career opportunity.\n\nWarm regards,\nVathmos Recruitment Team`,
      screeningQuestions: {
        feedbackOffered: 'Candidate profile saved for future matching openings.',
      },
    };

    return `I have prepared a polite, respectful rejection update for **${rejectCand}**.

🛡️ **Human Approval Required**: This note will stay staged until you review it and click **"Approve & Send Email"**.

\`\`\`vathmos_email_action
${JSON.stringify(action, null, 2)}
\`\`\``;
  }

  return `I am your Vathmos Recruiter Co-Pilot. You can ask me:
• *"Who should I hire?"* — for clear, human hiring advice based on your rubric scores
• *"Draft an interview invite for [name]"* — creates an editable email card with salary & notice period questions
• *"Send that msg to my email ${fallbackAddr}"* — stages any draft right into your review card for one-click Resend delivery
• *"Draft polite rejection"* — prepares a constructive candidate update for your approval`;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { message, jobDescription, candidatesSummary, history, recruiterEmail } = req.body || {};
  const fallbackReply = generateRecruiterAssistantResponse(
    message || '',
    candidatesSummary,
    jobDescription,
    history,
    recruiterEmail
  );

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_SECURE || '';
    if (apiKey && message && String(message).trim()) {
      const { roleTitle, domainLabel } = inferRoleInfo(jobDescription);
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      let contextBlock = `\nTARGET ROLE: ${roleTitle} (${domainLabel})\n`;
      if (jobDescription) contextBlock += `JOB DESCRIPTION:\n${String(jobDescription).slice(0, 1500)}\n`;
      if (Array.isArray(candidatesSummary) && candidatesSummary.length > 0) {
        contextBlock += `CANDIDATES SUMMARY:\n${JSON.stringify(candidatesSummary.slice(0, 10), null, 2)}\n`;
      }
      if (Array.isArray(history) && history.length > 0) {
        contextBlock += `RECENT HISTORY:\n${history
          .slice(-5)
          .map((h: any) => `${h.role === 'user' ? 'Recruiter' : 'Co-Pilot'}: ${String(h.text || '').slice(0, 500)}`)
          .join('\n')}\n`;
      }
      if (recruiterEmail) contextBlock += `RECRUITER EMAIL: ${recruiterEmail}\n`;

      const systemInstruction = `You are Vathmos Recruiter Co-Pilot — a warm, sharp, plain-spoken Head of Talent supporting both technical AND non-technical hiring (${domainLabel}).
RULES:
- Adapt strictly to the actual role (${roleTitle}). Never say "Engineering Team" or "technical round" unless the JD is engineering/technical.
- Never invent candidate metrics or quotes not in the summary.
- When asked to draft/send an interview invite, rejection, or forward an email, ALWAYS include a \`\`\`vathmos_email_action JSON block with type ("interview_invite"|"rejection"), candidateName, candidateEmail, subject, body, and screeningQuestions, and remind the recruiter that nothing sends without clicking Approve & Send.
${contextBlock}`;

      for (const cfg of [
        { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW, timeoutMs: 5200 },
        { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL, timeoutMs: 3200 },
      ]) {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), cfg.timeoutMs);
        try {
          const response = await ai.models.generateContent({
            model: cfg.model,
            contents: String(message).trim(),
            config: {
              systemInstruction,
              thinkingConfig: { thinkingLevel: cfg.thinkingLevel },
              abortSignal: ac.signal,
            },
          });
          clearTimeout(timer);
          const reply = response.text?.trim();
          if (reply && reply.length > 20) {
            return res.status(200).json({ reply });
          }
        } catch (err: any) {
          clearTimeout(timer);
          console.log(`[api/assistant:${cfg.model}] note:`, String(err?.message || err).slice(0, 100));
        }
      }
    }

    return res.status(200).json({ reply: fallbackReply });
  } catch {
    return res.status(200).json({ reply: fallbackReply });
  }
}
