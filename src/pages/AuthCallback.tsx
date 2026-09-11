import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ProfolioLogo } from '@/components/ProfolioLogo';

// Landing point for Google/Microsoft OAuth redirects. supabase-js (PKCE flow,
// detectSessionInUrl: true) exchanges the ?code=... in this URL for a session
// automatically before/while this component mounts; we just wait for that to
// land (or for Supabase's own ?error=... on cancellation/failure) and then
// hand off to Index.tsx's existing session-aware redirect -- no duplicate
// dashboard-routing logic here.
const OAUTH_TIMEOUT_MS = 10000;

const describeOAuthError = (code: string | null, description: string | null) => {
  if (code === 'access_denied') return 'Sign-in was cancelled.';
  if (description) return description.replace(/\+/g, ' ');
  return 'We could not complete sign-in with that provider.';
};

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const errorCode = params.get('error') || hashParams.get('error');
    const errorDescription = params.get('error_description') || hashParams.get('error_description');

    if (errorCode) {
      console.error('[AuthCallback] OAuth provider error:', errorCode, errorDescription);
      setError(describeOAuthError(errorCode, errorDescription));
      return;
    }

    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      navigate('/', { replace: true });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) finish();
    });

    // In case the session was already established (or the tab was
    // backgrounded during the redirect) before the listener attached.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish();
    });

    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      subscription.unsubscribe();
      setError('Sign-in is taking longer than expected. Please try again.');
    }, OAUTH_TIMEOUT_MS);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen w-full max-w-full overflow-hidden flex flex-col items-center justify-center p-4 relative">
      <div className="fixed inset-0 bg-gradient-to-br from-[hsl(200,90%,55%)] via-[hsl(280,80%,60%)] to-[hsl(330,85%,65%)]" />

      <div className="relative z-10 text-center mb-8">
        <ProfolioLogo boxed className="h-10 sm:h-12" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white/95 backdrop-blur-2xl border border-white/40 shadow-2xl p-8 text-center space-y-4">
        {error ? (
          <>
            <p className="text-gray-800 font-medium">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="text-sm text-[hsl(211,100%,45%)] hover:text-[hsl(211,100%,35%)] font-semibold"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[hsl(211,100%,45%)] border-t-transparent" />
            <p className="text-gray-600 text-sm">Signing you in&hellip;</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
