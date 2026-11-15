import React from 'react';
import { RouterProvider, useRouter } from './router/RouterContext';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsPage } from './pages/TermsPage';
import { RefundPolicyPage } from './pages/RefundPolicyPage';
import { ContactPage } from './pages/ContactPage';
import { OnboardingPricingModal } from './components/OnboardingPricingModal';

function AppRoutes() {
  const { pathname } = useRouter();

  // Normalize path (handle trailing slashes)
  const normalized = (pathname || '/').replace(/\/+$/, '') || '/';

  switch (normalized) {
    case '':
    case '/':
      return <LandingPage />;
    case '/dashboard':
      return <DashboardPage />;
    case '/privacy':
      return <PrivacyPolicyPage />;
    case '/terms':
      return <TermsPage />;
    case '/refund':
      return <RefundPolicyPage />;
    case '/contact':
      return <ContactPage />;
    default:
      if (normalized.startsWith('/dashboard')) {
        return <DashboardPage />;
      }
      return <LandingPage />;
  }
}

export default function App() {
  return (
    <RouterProvider>
      <AppRoutes />
      <OnboardingPricingModal />
    </RouterProvider>
  );
}
