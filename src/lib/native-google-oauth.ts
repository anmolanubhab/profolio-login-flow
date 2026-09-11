import { Capacitor } from '@capacitor/core';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import type { NavigateFunction } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Google blocks its OAuth consent screen from rendering inside an embedded
// WebView (the Capacitor Android shell's WebView is one). So on native
// Android, Google sign-in must run in the system browser / a Custom Tab
// instead, and return to the app via this explicit custom-scheme URL --
// never via the production HTTPS origin, which is what the embedded WebView
// already loads and would just reopen the web app rather than return to it.
const NATIVE_OAUTH_REDIRECT = 'com.profolio.app://auth/callback';

export const isNativeAndroidOAuth = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

/**
 * Starts Google sign-in from the native Android shell: gets the Google
 * authorization URL from Supabase without letting the embedded WebView
 * navigate to it (`skipBrowserRedirect`), then opens that URL in the system
 * browser/Custom Tab. The redirect back to `NATIVE_OAUTH_REDIRECT` is picked
 * up by `registerNativeOAuthCallbackListener` below.
 */
export const startNativeGoogleOAuth = async (): Promise<{ error?: string }> => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: NATIVE_OAUTH_REDIRECT,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    return { error: error?.message ?? 'No authorization URL returned.' };
  }

  try {
    await Browser.open({ url: data.url });
  } catch (openError) {
    console.error('[NativeOAuth] Browser.open failed:', openError);
    return { error: 'Could not open the sign-in page. Please try again.' };
  }

  return {};
};

let exchanging = false;

/**
 * Registers the single, app-wide listener for the custom-scheme redirect
 * Android hands back to MainActivity (via the intent-filter added to
 * AndroidManifest.xml). Only ever exchanges a code that arrives through this
 * explicit, allowlisted `com.profolio.app://auth/callback` URL -- nothing
 * else is accepted, so this can't be used as an arbitrary open-redirect.
 *
 * Call once for the app's lifetime; safe to call unconditionally since it
 * no-ops outside the native Android shell.
 */
export const registerNativeOAuthCallbackListener = async (navigate: NavigateFunction) => {
  if (!isNativeAndroidOAuth()) return null;

  const handler = async (event: URLOpenListenerEvent) => {
    if (!event.url.startsWith(NATIVE_OAUTH_REDIRECT)) return;
    if (exchanging) return; // guard against a duplicate appUrlOpen firing
    exchanging = true;

    // Best-effort: return focus to the app's own WebView. The callback is
    // what matters, so a failure here is never fatal.
    Browser.close().catch(() => {});

    try {
      const url = new URL(event.url);
      const errorCode = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');
      const code = url.searchParams.get('code');

      if (errorCode) {
        console.error('[NativeOAuth] provider error:', errorCode, errorDescription);
        navigate(`/auth/callback?error=${encodeURIComponent(errorCode)}&error_description=${encodeURIComponent(errorDescription ?? '')}`, { replace: true });
        return;
      }

      if (!code) {
        console.error('[NativeOAuth] callback missing authorization code');
        navigate('/auth/callback?error=missing_code', { replace: true });
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        console.error('[NativeOAuth] exchangeCodeForSession failed:', exchangeError);
        navigate(`/auth/callback?error=exchange_failed&error_description=${encodeURIComponent(exchangeError.message)}`, { replace: true });
        return;
      }

      navigate('/', { replace: true });
    } catch (unexpectedError) {
      // exchangeCodeForSession() (or, in principle, URL parsing above it)
      // can throw rather than resolve with { error } -- e.g. a network
      // failure mid-exchange re-throws instead of returning an AuthError.
      // Without this catch that would be an unhandled rejection, leaving
      // the caller's "Signing in..." state stuck forever. Route it through
      // the same friendly error screen as every other failure here; log
      // only the error message, never the authorization code itself.
      console.error(
        '[NativeOAuth] unexpected error during callback handling:',
        unexpectedError instanceof Error ? unexpectedError.message : 'unknown error',
      );
      navigate('/auth/callback?error=exchange_failed', { replace: true });
    } finally {
      exchanging = false;
    }
  };

  return App.addListener('appUrlOpen', handler);
};
