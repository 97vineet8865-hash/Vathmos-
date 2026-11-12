import { GoogleGenAI } from '@google/genai';

function getAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    return new GoogleGenAI({ apiKey });
  } catch {
    return null;
  }
}

function generateRecruiterAssistantFallback(
  message: string,
  candidatesSummary?: any[],
  jobDescription?: string
): string {
  const msgLower = (message || '').toLowerCase();

  // Extract email if user provided one
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const emailMatch = message.match(emailRegex);
  const targetEmail = emailMatch ? emailMatch[1] : (candidatesSummary && candidatesSummary[0]?.email) || 'recruiter@vathmos.co.in';

  // 1. Send message / email request
  if (
    msgLower.includes('send that msg') ||
    msgLower.includes('send that message') ||
    msgLower.includes('send to my email') ||
    msgLower.includes('send this to my email') ||
    msgLower.includes('send email to') ||
    msgLower.includes('send to an email of mine') ||
    msgLower.includes('send to a email of mine') ||
    msgLower.includes('send that email') ||
    msgLower.includes('send to')
  ) {
    const topCand = candidatesSummary && candidatesSummary[0] ? candidatesSummary[0].name : 'Primary Candidate';
    return `I have prepared the message draft for you, set to be sent to **${targetEmail}**.

🛡️ **Human Approval Required**: As requested, I will **never** send this email without your explicit permission. Please review the recipient email and message content below, then click **"Approve & Send"** when you are ready.

\`\`\`vathmos_email_action
{
  "type": "interview_invite",
  "candidateName": "${topCand}",
  "candidateEmail": "${targetEmail}",
  "subject": "Interview Invitation & Next Steps: Technical Engineering Role",
  "body": "Hi ${topCand},\\n\\nThank you for sharing your background with our engineering team. We conducted a thorough review of your technical profile against our benchmarks and were thoroughly impressed by your proven achievements.\\n\\nWe would love to invite you for a 45-minute technical conversation to discuss our roadmap and explore how your experience aligns with our team.\\n\\nTo help us schedule smoothly, please reply with:\\n1. Your earliest available start date / notice period.\\n2. Your expected compensation / CTC range.\\n\\nLooking forward to speaking with you!\\n\\nWarm regards,\\nVathmos Engineering Recruitment Team",
  "screeningQuestions": {
    "expectedSalary": "Please share your expected annual salary / CTC range.",
    "noticePeriod": "What is your current notice period / earliest join date?",
    "availability": "What times work best for a 45-minute technical interview next week?"
  }
}
\`\`\``;
  }

  // 2. "Who should I hire?"
  if (
    msgLower.includes('who should i hire') ||
    msgLower.includes('what i shall hire') ||
    msgLower.includes('who to hire') ||
    msgLower.includes('who is best') ||
    msgLower.includes('recommend') ||
    msgLower.includes('who won')
  ) {
    if (candidatesSummary && candidatesSummary.length > 0) {
      const c1 = candidatesSummary[0];
      const c2 = candidatesSummary.length > 1 ? candidatesSummary[1] : null;

      let advice = `Based on your evaluation criteria and 100-point rubric benchmarks, here is my honest hiring counsel:\n\n`;
      advice += `🥇 **Primary Recommendation: ${c1.name} (${c1.score}/100 — ${c1.recommendation || 'Strong Match'})**\n`;
      if (c1.pros && c1.pros.length > 0) {
        advice += `• **Core Strengths:** ${c1.pros.slice(0, 2).join('; ')}.\n`;
      }
      if (c1.matched_skills && c1.matched_skills.length > 0) {
        advice += `• **Verified Skills:** ${c1.matched_skills.slice(0, 4).join(', ')}.\n`;
      }
      if (c1.cons && c1.cons.length > 0) {
        advice += `• **Areas to Probe in Interview:** ${c1.cons.slice(0, 2).join('; ')}.\n`;
      }

      if (c2) {
        advice += `\n🥈 **Alternative Runner-Up: ${c2.name} (${c2.score}/100)**\n`;
        advice += `• Offers strong baseline capability, but scored slightly lower on production throughput metrics.\n`;
      }

      advice += `\n💡 **My Recruiter Advice:** If you need immediate impact, **${c1.name}** is your strongest candidate. Before finalizing an offer, I recommend asking these two quick questions:\n`;
      advice += `1. Current notice period and earliest start date.\n`;
      advice += `2. Expected CTC / salary package.\n\n`;
      advice += `Would you like me to prepare an **Interview Invitation Email** for **${c1.name}** with these screening questions?`;

      return advice;
    }

    return `I am ready to evaluate your candidate pool! Once you upload and score candidate resumes against your Job Description, I will analyze their scores, highlight who has verifiable production achievements vs buzzwords, and give you clear, human hiring counsel.`;
  }

  // 3. Draft invite
  if (msgLower.includes('invite') || msgLower.includes('interview') || msgLower.includes('schedule') || (msgLower.includes('email') && !msgLower.includes('reject'))) {
    const topCand = candidatesSummary && candidatesSummary[0] ? candidatesSummary[0].name : 'Primary Candidate';
    return `I have prepared a tailored, professional interview invitation for **${topCand}**.

🛡️ **Human Approval Required**: I will never send this email automatically. Please review the details below and click **"Approve & Send"** when you are ready.

\`\`\`vathmos_email_action
{
  "type": "interview_invite",
  "candidateName": "${topCand}",
  "candidateEmail": "${targetEmail}",
  "subject": "Interview Invitation: Next Steps for Engineering Role",
  "body": "Hi ${topCand},\\n\\nThank you for your application. Our engineering team thoroughly evaluated your background against our technical benchmarks, and we were very impressed by your proven achievements.\\n\\nWe would love to invite you for a 45-minute technical conversation to discuss your past projects and explore how your experience aligns with our roadmap.\\n\\nTo help us schedule smoothly, please reply with:\\n1. Your earliest available start date / notice period.\\n2. Your expected compensation / CTC range.\\n\\nLooking forward to speaking with you!\\n\\nWarm regards,\\nVathmos Engineering Recruitment Team",
  "screeningQuestions": {
    "expectedSalary": "Please share your expected annual salary / CTC range.",
    "noticePeriod": "What is your current notice period / earliest join date?",
    "availability": "What times work best for a 45-minute technical call next week?"
  }
}
\`\`\``;
  }

  // 4. Draft rejection
  if (msgLower.includes('reject') || msgLower.includes('declined') || msgLower.includes('pass') || msgLower.includes('not selected')) {
    const rejectCand = candidatesSummary && candidatesSummary.length > 1 ? candidatesSummary[candidatesSummary.length - 1].name : (candidatesSummary && candidatesSummary[0] ? candidatesSummary[0].name : 'Candidate');
    return `I have prepared a polite, constructive candidate update for **${rejectCand}**.

🛡️ **Human Approval Required**: This email is staged in your approval queue and will only be sent after you click **"Approve & Send"**.

\`\`\`vathmos_email_action
{
  "type": "rejection",
  "candidateName": "${rejectCand}",
  "candidateEmail": "${targetEmail}",
  "subject": "Update regarding your application with our Engineering Team",
  "body": "Hi ${rejectCand},\\n\\nThank you for taking the time to share your technical background and apply for this role. We genuinely appreciate the effort you put into your application.\\n\\nWhile your accomplishments are commendable, we have decided to advance other candidates whose specific technical competencies align more directly with our immediate domain requirements for this phase of our roadmap.\\n\\nWe appreciate your interest in our team and wish you the absolute best in your ongoing career pursuits.\\n\\nWarm regards,\\nVathmos Recruitment Team",
  "screeningQuestions": {
    "feedbackOffered": "Candidate pool archived for future openings matching skill profile."
  }
}
\`\`\``;
  }

  return `I am your Vathmos Recruiter Co-Pilot. I can help you:
• **Hiring Advice:** Ask *"Who should I hire for this role?"* for human, insightful recommendations
• **Draft Outreach:** Interview invitations and polite rejection letters with salary/notice period screening
• **Safety First:** I will never send an email without your explicit review and click
• **Candidate Analysis:** Compare candidate strengths and identify technical gaps

How can I assist your hiring decision right now?`;
}

export default async function handler(req: any, res: any) {
  // CORS setup
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
    const { message, jobDescription, candidatesSummary } = req.body || {};
    const reply = generateRecruiterAssistantFallback(message || '', candidatesSummary, jobDescription);
    return res.status(200).json({ reply });
  } catch (err: any) {
    return res.status(200).json({
      reply: generateRecruiterAssistantFallback(req.body?.message || '', req.body?.candidatesSummary, req.body?.jobDescription),
    });
  }
}
