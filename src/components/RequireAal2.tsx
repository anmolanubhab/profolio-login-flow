import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

type GuardStatus = 'checking' | 'ok' | 'needs-mfa' | 'unauthenticated';

/**
 * Wraps every route that requires full authentication. Re-derives access
 * from Supabase's own live AAL report (never a client-side flag) on every
 * path change, so it stays correct across refresh, direct URL navigation,
 * and browser back/forward -- not just the initial mount. A session is let
 * through if Supabase itself reports aal2, or if a backup recovery code was
 * consumed for this exact session (has_active_mfa_recovery_grant), which is
 * a distinct, explicitly-scoped access grant -- never a claim of aal2.
 */
export function RequireAal2() {
  const location = useLocation();
  const [status, setStatus] = useState<GuardStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    setStatus('checking');

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setStatus('unauthenticated');
        return;
      }

      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;

      if (!aalError && aalData && aalData.currentLevel === 'aal1' && aalData.nextLevel === 'aal2') {
        const { data: hasGrant } = await supabase.rpc('has_active_mfa_recovery_grant');
        if (cancelled) return;
        setStatus(hasGrant ? 'ok' : 'needs-mfa');
        return;
      }

      setStatus('ok');
    })();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/" replace />;
  }

  if (status === 'needs-mfa') {
    return <Navigate to="/mfa-challenge" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
