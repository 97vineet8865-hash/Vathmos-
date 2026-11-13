function generateRecruiterAssistantResponse(
  message: string,
  candidatesSummary?: any[],
  jobDescription?: string,
  history?: any[],
  recruiterEmail?: string
): string {
  const msg = String(message || '').trim();
  const msgLower = msg.toLowerCase();

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
  const fallbackAddr = recruiterEmail || '97.vineet.8865@gmail.com';
  const targetEmail = specifiedEmail || targetCandObj?.email || fallbackAddr;

  // 1. Explicit request to send message/email to user or candidate
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
        : `Hi ${topCand},\n\nThank you for your application. Our engineering team evaluated your profile against our technical benchmarks and we were very impressed by your demonstrated achievements.\n\nWe would love to invite you for a 45-minute technical conversation to discuss our roadmap and explore how your experience aligns with our team.\n\nTo help us schedule smoothly, please reply with:\n1. Your current notice period and earliest join date.\n2. Your expected compensation / CTC range.\n\nLooking forward to speaking with you!\n\nWarm regards,\nVathmos Engineering Recruitment Team`;

    const action = {
      type: 'interview_invite',
      candidateName: topCand,
      candidateEmail: targetEmail,
      subject: 'Interview Invitation & Next Steps: Technical Engineering Role',
      body: stagedBody,
      screeningQuestions: {
        expectedSalary: 'Please share your expected annual salary / CTC range.',
        noticePeriod: 'What is your current notice period / earliest join date?',
        availability: 'What times work best for a 45-minute technical call next week?',
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

      let advice = `Based on your evaluation criteria and 100-point rubric benchmarks, here is my honest hiring counsel:\n\n`;
      advice += `🥇 **Primary Recommendation: ${c1.name} (${c1.score}/100 — ${c1.recommendation || 'Strong Match'})**\n`;
      if (c1.pros && c1.pros.length > 0) {
        advice += `• **Core Strengths:** ${c1.pros.slice(0, 2).join('; ')}.\n`;
      }
      if (c1.matched_skills && c1.matched_skills.length > 0) {
        advice += `• **Verified Skills:** ${c1.matched_skills.slice(0, 4).join(', ')}.\n`;
      }
      if (c1.cons && c1.cons.length > 0) {
        advice += `• **Interview Probing Areas:** ${c1.cons.slice(0, 2).join('; ')}.\n`;
      }

      if (c2) {
        advice += `\n🥈 **Runner-Up: ${c2.name} (${c2.score}/100)**\n`;
        advice += `• Good baseline capability, though slightly behind ${c1.name} on verifiable production depth.\n`;
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
      return `Candidate Comparison: **${c1.name}** vs **${c2.name}**\n\n• **${c1.name} (${c1.score ?? 85}/100):** Stronger evidence across ${(c1.matched_skills || ['Core Requirements']).slice(0, 3).join(', ')}.\n• **${c2.name} (${c2.score ?? 70}/100):** Competent baseline, with gaps in ${(c2.missing_skills || ['Specialized Depth']).slice(0, 2).join(', ')}.\n\n**My Counsel:** Advance **${c1.name}** first and validate system scalability decisions in the technical round.`;
    }
  }

  // 4. Draft interview invite
  if (msgLower.includes('invite') || msgLower.includes('interview') || msgLower.includes('schedule') || msgLower.includes('hiring letter') || (msgLower.includes('email') && !msgLower.includes('reject'))) {
    const action = {
      type: 'interview_invite',
      candidateName: topCand,
      candidateEmail: targetEmail,
      subject: 'Interview Invitation: Next Steps for Engineering Role',
      body: `Hi ${topCand},\n\nThank you for your application. Our engineering team evaluated your background against our technical benchmarks (${topScore}/100) and were impressed by your demonstrated work.\n\nWe would love to invite you for a 45-minute technical interview to discuss your projects and how you might fit into our team.\n\nTo help us schedule smoothly, please reply with:\n1. Your current notice period / earliest start date.\n2. Your expected compensation / CTC range.\n\nLooking forward to speaking with you!\n\nWarm regards,\nVathmos Recruitment Team`,
      screeningQuestions: {
        expectedSalary: 'Please share your expected annual salary / CTC range.',
        noticePeriod: 'What is your current notice period / earliest join date?',
        availability: 'What times work best for a 45-minute technical call next week?',
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
      subject: 'Update regarding your application with our Engineering Team',
      body: `Hi ${rejectCand},\n\nThank you for taking the time to share your background and apply for this role. We genuinely appreciate your interest in our team.\n\nAfter careful evaluation, we have decided to move forward with candidates whose experience aligns more closely with our immediate domain requirements for this cycle.\n\nWe wish you every success in your next engineering role.\n\nWarm regards,\nVathmos Recruitment Team`,
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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { message, jobDescription, candidatesSummary, history, recruiterEmail } = req.body || {};
    const reply = generateRecruiterAssistantResponse(
      message || '',
      candidatesSummary,
      jobDescription,
      history,
      recruiterEmail
    );
    return res.status(200).json({ reply });
  } catch (err: any) {
    return res.status(200).json({
      reply: generateRecruiterAssistantResponse(req.body?.message || '', req.body?.candidatesSummary, req.body?.jobDescription),
    });
  }
}
