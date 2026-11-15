import React from 'react';
import '../src/index.css';

export interface Metadata {
  title: string;
  description: string;
}

export const metadata: Metadata = {
  title: 'Vathmos - Objective Candidate Screening for Tech & Business Teams',
  description: 'Screen candidate resumes across Technical and Business roles with zero bias and an evidence-based 100-point rubric. In-RAM ephemeral processing with zero candidate resume storage.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
