package com.profolio.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ── WebView HTTP cache policy ────────────────────────────────────────
        // This shell loads the LIVE production web app over HTTPS, so the
        // WebView's HTTP cache must respect the server's Cache-Control headers
        // and never pin an old build:
        //
        //   * index.html / navigations  -> Vercel serves these effectively
        //     no-store (and the production service worker is network-first for
        //     navigations), so every launch re-fetches the current HTML and
        //     therefore the current hashed asset URLs.
        //   * /assets/*.js|.css         -> content-hashed + immutable; a new
        //     deploy produces new filenames, so a cache hit is only ever the
        //     exact same bytes and a new deploy is always a cache miss ->
        //     network.
        //
        // LOAD_DEFAULT = "use cached resources only while they are still fresh
        // per HTTP headers, otherwise hit the network". This is the correct,
        // network-aware behaviour. We set it explicitly so no plugin or future
        // change can silently fall back to LOAD_CACHE_ELSE_NETWORK (which would
        // serve stale bundles) and so the intent is documented in code.
        WebSettings settings = this.getBridge().getWebView().getSettings();
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Native edge-to-edge: let the WebView draw behind the status bar and
        // navigation bar instead of Android reserving fixed space for them.
        // @capacitor/android's built-in SystemBars core plugin (always
        // registered, see Bridge.registerAllPlugins()) already listens for
        // WindowInsets and injects the real measured insets as
        // --safe-area-inset-* CSS variables -- so the app's existing
        // env(safe-area-inset-*) CSS (Layout.tsx, NavBar.tsx,
        // BottomNavigation.tsx) picks up actual native values instead of a
        // guessed constant, once this call lets those insets be non-zero.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Android applies a default translucent scrim behind the 3-button
        // navigation bar (and status bar) for icon-contrast/legibility. A
        // native Activity can opt out and let its own background/content
        // show straight through instead -- this is the exact mechanism a
        // native app (e.g. LinkedIn) uses, and has no equivalent in the
        // Chrome-hosted installed-PWA/WebAPK path, which is why it was
        // unreachable from the web build alone.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
            getWindow().setStatusBarContrastEnforced(false);
        }
    }
}
