package com.profolio.app;

import android.os.Build;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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
