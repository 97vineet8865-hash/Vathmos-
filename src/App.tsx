import React, { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { RouterProvider, useRouter } from './router/RouterContext';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsPage } from './pages/TermsPage';
import { RefundPolicyPage } from './pages/RefundPolicyPage';
import { ContactPage } from './pages/ContactPage';
import { OnboardingPricingModal } from './components/OnboardingPricingModal';
import { useAuth } from './context/AuthContext';
import { trackEvent } from './utils/analytics';

function AppRoutes() {
  const { pathname } = useRouter();
  const { currentUser } = useAuth();

  // Normalize path (handle trailing slashes)
  const normalized = (pathname || '/').replace(/\/+$/, '') || '/';

  useEffect(() => {
    trackEvent('page_view', { source: normalized }, currentUser?.tier || 'guest', currentUser?.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized]);

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
      <Analytics />
    </RouterProvider>
  );
}
