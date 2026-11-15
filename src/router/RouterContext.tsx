import React, { createContext, useContext, useState, useEffect, ReactNode, MouseEvent } from 'react';

export type RoutePath = '/' | '/dashboard' | '/privacy' | '/terms' | '/refund' | '/contact';

interface RouterContextType {
  pathname: string;
  navigate: (path: string) => void;
  goBack: () => void;
}

const RouterContext = createContext<RouterContextType>({
  pathname: '/',
  navigate: () => {},
  goBack: () => {},
});

function normalizePath(rawPath: string): string {
  if (!rawPath || rawPath === '') return '/';
  // Strip trailing slashes except for root
  const cleaned = rawPath.replace(/\/+$/, '');
  return cleaned === '' ? '/' : cleaned;
}

export const RouterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [pathname, setPathname] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return normalizePath(window.location.pathname);
    }
    return '/';
  });

  useEffect(() => {
    const handlePopState = () => {
      setPathname(normalizePath(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    const normalized = normalizePath(path);
    if (typeof window !== 'undefined') {
      // Support hash jumps on same page if needed
      if (path.startsWith('#') || (path.includes('#') && path.split('#')[0] === pathname)) {
        const hash = path.includes('#') ? path.split('#')[1] : path.replace('#', '');
        const elem = document.getElementById(hash);
        if (elem) {
          elem.scrollIntoView({ behavior: 'smooth' });
          return;
        }
      }

      if (window.location.pathname !== normalized) {
        window.history.pushState({}, '', normalized);
        setPathname(normalized);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const goBack = () => {
    if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        navigate('/');
      }
    }
  };

  return (
    <RouterContext.Provider value={{ pathname, navigate, goBack }}>
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = () => useContext(RouterContext);

interface LinkProps {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  title?: string;
}

export const Link: React.FC<LinkProps> = ({ href, className = '', children, onClick, title }) => {
  const { navigate } = useRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick(e);
    }
    // Allow default for external links or if modified click (Ctrl/Cmd)
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || e.metaKey || e.ctrlKey) {
      return;
    }

    e.preventDefault();
    navigate(href);
  };

  return (
    <a href={href} onClick={handleClick} className={className} title={title}>
      {children}
    </a>
  );
};
