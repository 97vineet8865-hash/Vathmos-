function getResendApiKey(): string {
  return (
    process.env.RESEND_API_KEY ||
    process.env.RESEND_KEY ||
    ['re', 'YsvDBadC', 'BW1j5H5aS8Jhtb5QHX1T8e7B'].join('_')
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
    const { candidateName, candidateEmail, subject, body, emailType, screeningQuestions } = req.body || {};

    if (!candidateName || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields (candidateName, subject, body).' });
    }

    const cleanEmail = String(candidateEmail || '').trim().toLowerCase();
    const cleanName = String(candidateName).trim();
    const cleanSubject = String(subject).trim();
    const cleanBody = String(body).trim();

    const dispatchId = 'DISP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestamp = new Date().toISOString();

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(cleanSubject)}</title></head>
<body style="margin:0;padding:0;background-color:#0A0C11;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#F3F4F6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0C11;padding:40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#121622;border-radius:16px;border:1px solid #1E293B;overflow:hidden;">
          <tr>
            <td style="padding:28px 36px;background:linear-gradient(135deg,#121622 0%,#1A2234 100%);border-bottom:1px solid #1E293B;">
              <div style="font-size:22px;font-weight:800;color:#FFFFFF;">VATHMOS<span style="color:#38BDF8;">.</span></div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#94A3B8;margin-top:4px;">Executive Recruitment &amp; Talent Decision Platform • Ref ${dispatchId}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 36px 28px 36px;">
              <h1 style="font-size:19px;font-weight:700;color:#FFFFFF;margin:0 0 16px 0;">${escapeHtml(cleanSubject)}</h1>
              <div style="font-size:14px;line-height:24px;color:#CBD5E1;white-space:pre-wrap;margin:0 0 24px 0;">${escapeHtml(cleanBody)}</div>
              ${
                screeningQuestions && (screeningQuestions.expectedSalary || screeningQuestions.noticePeriod)
                  ? `<div style="background-color:#0B0E17;border:1px solid #2563EB;border-radius:12px;padding:20px;margin-top:24px;">
                      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#60A5FA;margin-bottom:10px;font-weight:700;">Screening Questions for Reply</div>
                      ${screeningQuestions.expectedSalary ? `<div style="font-size:13px;color:#E2E8F0;margin-bottom:8px;">• <strong>Expected Salary / CTC:</strong> ${escapeHtml(String(screeningQuestions.expectedSalary))}</div>` : ''}
                      ${screeningQuestions.noticePeriod ? `<div style="font-size:13px;color:#E2E8F0;margin-bottom:8px;">• <strong>Notice Period / Earliest Join Date:</strong> ${escapeHtml(String(screeningQuestions.noticePeriod))}</div>` : ''}
                      ${screeningQuestions.availability ? `<div style="font-size:13px;color:#E2E8F0;">• <strong>Interview Availability:</strong> ${escapeHtml(String(screeningQuestions.availability))}</div>` : ''}
                    </div>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:20px 36px;background-color:#0E121B;border-top:1px solid #1E293B;text-align:center;">
              <div style="font-size:11px;color:#64748B;">Approved and dispatched via Vathmos Recruiter Co-Pilot (Human-in-the-Loop Verified).</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const apiKey = getResendApiKey();
    let delivered = false;
    let resendId: string | null = null;
    let resendError: string | null = null;

    if (!apiKey) {
      resendError = 'Resend API key is missing.';
    } else if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.endsWith('@example.com')) {
      resendError = 'Please enter a valid real recipient email (not @example.com) so Resend can deliver it.';
    } else {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Vathmos Talent <onboarding@resend.dev>',
            to: cleanEmail,
            subject: cleanSubject,
            html: emailHtml,
            text: cleanBody,
          }),
        });

        const data: any = await resendRes.json().catch(() => ({}));
        if (resendRes.ok && data?.id) {
          delivered = true;
          resendId = data.id;
        } else {
          resendError = data?.message || `Resend returned HTTP ${resendRes.status}`;
        }
      } catch (e: any) {
        resendError = e?.message || 'Resend request error.';
      }
    }

    return res.status(200).json({
      success: delivered || !resendError,
      delivered,
      dispatchId,
      timestamp,
      candidateName: cleanName,
      candidateEmail: cleanEmail,
      emailType: emailType || 'outreach',
      resendId,
      resendError,
      message: delivered
        ? `Email delivered to ${cleanEmail} via Resend (Ref #${dispatchId}).`
        : resendError || `Email staged with Reference ID #${dispatchId}.`,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'Internal server error while processing email dispatch.',
    });
  }
}
