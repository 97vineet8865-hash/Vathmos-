# Feature Specification: Agentic Recruiter Co-Pilot (Interview & Screening Outreach)

## Status: Idea Saved / Backlog (To be implemented post-exams)

### Concept Overview
An autonomous, human-in-the-loop Agentic Co-Pilot that analyzes candidate evaluation scorecards, identifies evaluation gaps/strengths, and drafts personalized outreach emails to candidates.

### Workflow & Human-in-the-Loop Safeguards
1. **Trigger**:
   - From the Scorecard or Leaderboard view, the recruiter clicks **"AI Outreach"** or chats with **AI Co-Pilot**: *"Draft interview invitation for Candidate #1"*.
2. **Dynamic Generation**:
   - The Co-Pilot pulls the candidate's scorecard data (technical score, matched skills, gap probes).
   - Generates a customized email draft containing:
     - Role greeting & interview invitation.
     - Role-specific gap questions or preliminary screening questions (e.g., current CTC, expected salary, notice period, availability for technical rounds).
3. **Interactive Recruiter Review (Never auto-send)**:
   - Renders an in-modal preview card showing the exact recipient, subject, and email body.
   - Recruiter can customize/edit salary expectations, date/time slots, or question text.
   - Prominent confirmation button: **[Approve & Send via Recruiter Email]**.
4. **Dispatch**:
   - Sends candidate email with recruiter's email as `Reply-To` (or via connected Gmail/Resend integration).

---
*Saved on: November 6, 2026 for Vathmos Founder roadmap.*
