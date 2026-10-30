import { Resend } from 'resend';

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const resend = new Resend(RESEND_KEY);

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
    const { email, code, type } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();
    const isReset = type === 'reset';

    const subject = isReset
      ? `[Vathmos] ${cleanCode} is your Password Reset Code`
      : `[Vathmos] ${cleanCode} is your Account Verification Code`;

    const emailTitle = isReset ? 'Reset Your Password' : 'Verify Your Email';
    const emailSubtitle = isReset
      ? 'A password reset request was requested for your Vathmos recruiter account.'
      : 'Thank you for registering with Vathmos. Enter the 6-digit security code below to complete your setup.';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${emailTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0C11; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F3F4F6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A0C11; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #121622; border-radius: 16px; border: 1px solid #1E293B; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 36px; background: linear-gradient(135deg, #121622 0%, #1A2234 100%); border-bottom: 1px solid #1E293B;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #FFFFFF;">
                      VATHMOS<span style="color: #38BDF8;">.</span>
                    </div>
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #94A3B8; margin-top: 4px;">
                      Recruitment Decision-Support System
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #FFFFFF; margin: 0 0 12px 0;">
                ${emailTitle}
              </h1>
              <p style="font-size: 14px; line-height: 22px; color: #94A3B8; margin: 0 0 28px 0;">
                ${emailSubtitle}
              </p>

              <!-- OTP Box -->
              <div style="background-color: #0B0E17; border: 1px solid #2563EB; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px;">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #60A5FA; margin-bottom: 8px; font-weight: 600;">
                  One-Time Verification Code
                </div>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #38BDF8;">
                  ${cleanCode}
                </div>
                <div style="font-size: 12px; color: #64748B; margin-top: 8px;">
                  Valid for 10 minutes • Do not share this code
                </div>
              </div>

              <p style="font-size: 13px; line-height: 20px; color: #64748B; margin: 0 0 16px 0;">
                If you did not request this verification, someone may have entered your email by mistake. You can safely disregard this email; your account remains secure.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #0E121B; border-top: 1px solid #1E293B; text-align: center;">
              <div style="font-size: 12px; color: #475569; line-height: 18px;">
                © 2026 Vathmos Technologies. All rights reserved.<br>
                Support: <a href="mailto:vathmossupport@gmail.com" style="color: #38BDF8; text-decoration: none;">vathmossupport@gmail.com</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'Vathmos Security <onboarding@resend.dev>',
      to: cleanEmail,
      subject,
      html,
    });

    if (error) {
      console.warn('[Resend API Error]:', error);
      return res.status(200).json({
        success: false,
        delivered: false,
        error: error.message || 'Delivery restricted by email service provider',
        detail: error,
      });
    }

    console.log(`[Resend API Success] Dispatched OTP ${cleanCode} to ${cleanEmail}, ID: ${data?.id}`);
    return res.status(200).json({
      success: true,
      delivered: true,
      message: `OTP delivered to ${cleanEmail}`,
      id: data?.id,
    });
  } catch (err: any) {
    console.error('[API send-otp Exception]:', err);
    return res.status(500).json({
      success: false,
      delivered: false,
      error: err?.message || 'Internal server error while sending email',
    });
  }
}
