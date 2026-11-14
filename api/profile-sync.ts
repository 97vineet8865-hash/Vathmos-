function getSupabaseConfig() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://vzekrvpgxyjjnmkfwgot.supabase.co'
  ).replace(/\/+$/, '');
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';
  return { url, secretKey };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url, secretKey } = getSupabaseConfig();
  const configured = Boolean(url && secretKey && url.startsWith('https://'));

  if (req.method === 'GET') {
    if (req.query?.status === '1') {
      return res.status(200).json({
        configured,
        projectUrl: url,
      });
    }

    const email = String(req.query?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email query parameter is required.' });
    }

    if (!configured) {
      return res.status(200).json({ configured: false, profile: null });
    }

    try {
      const resp = await fetch(
        `${url}/rest/v1/vathmos_workspaces?email=eq.${encodeURIComponent(email)}&select=*`,
        {
          headers: {
            apikey: secretKey,
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!resp.ok) {
        const text = await resp.text();
        return res.status(200).json({ configured: true, profile: null, warning: text.slice(0, 200) });
      }

      const rows = (await resp.json()) as any[];
      return res.status(200).json({
        configured: true,
        profile: Array.isArray(rows) && rows.length > 0 ? rows[0] : null,
      });
    } catch (err: any) {
      return res.status(200).json({ configured: true, profile: null, warning: err?.message });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const cleanEmail = String(body.email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return res.status(400).json({ error: 'User email is required.' });
    }

    if (!configured) {
      return res.status(200).json({
        success: false,
        configured: false,
        message: 'Add SUPABASE_SECRET_KEY in Vercel Environment Variables to enable cloud sync.',
      });
    }

    try {
      const record = {
        email: cleanEmail,
        user_id: body.id || body.userId || null,
        full_name: body.name || '',
        company_name: body.companyName || '',
        role_title: body.role || 'Technical Recruiter',
        avatar_color: body.avatarColor || '#6366F1',
        tier: body.tier || 'free',
        evaluations_limit: typeof body.evaluationsLimit === 'number' ? body.evaluationsLimit : 5,
        evaluations_used: typeof body.evaluationsUsed === 'number' ? body.evaluationsUsed : 0,
        interview_questions_limit:
          typeof body.interviewQuestionsLimit === 'number' ? body.interviewQuestionsLimit : 5,
        interview_questions_used:
          typeof body.interviewQuestionsUsed === 'number' ? body.interviewQuestionsUsed : 0,
        white_label: body.whiteLabel || null,
        updated_at: new Date().toISOString(),
      };

      const resp = await fetch(`${url}/rest/v1/vathmos_workspaces?on_conflict=email`, {
        method: 'POST',
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(record),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return res.status(200).json({
          success: false,
          configured: true,
          error: `Supabase write notice: ${errText.slice(0, 200)}`,
        });
      }

      const saved = await resp.json();
      return res.status(200).json({
        success: true,
        configured: true,
        data: Array.isArray(saved) ? saved[0] : saved,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        configured: true,
        error: err?.message || 'Supabase sync error',
      });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
