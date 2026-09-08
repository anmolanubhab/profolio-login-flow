import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BUILD_INFO } from "@/lib/build-info";

/**
 * Lightweight build / environment diagnostic screen.
 *
 * Public (no auth) so it can be checked immediately on first APK launch,
 * before signing in. Proves *which* production deployment the WebView loaded:
 * if a Vercel redeploy is live, reopening the existing APK should show the new
 * commit SHA here with no APK rebuild.
 *
 * Exposes NO secrets -- git SHA, branch, environment and timestamps only.
 */
export default function Diagnostics() {
  const [swController, setSwController] = useState<string>("checking…");
  const [origin, setOrigin] = useState<string>("");
  const [standalone, setStandalone] = useState<boolean>(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setStandalone(
      window.matchMedia?.("(display-mode: standalone)").matches ||
        // iOS Safari legacy
        (navigator as unknown as { standalone?: boolean }).standalone === true,
    );

    if (!("serviceWorker" in navigator)) {
      setSwController("unsupported");
      return;
    }
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return setSwController("not registered");
      const state = navigator.serviceWorker.controller ? "active (controlling)" : "registered (not yet controlling)";
      setSwController(reg.waiting ? `${state} — update waiting` : state);
    });
  }, []);

  const rows: Array<[string, string]> = [
    ["Frontend", BUILD_INFO.env === "production" ? "Production" : BUILD_INFO.env],
    ["Origin", origin],
    ["Build (commit)", BUILD_INFO.shortSha],
    ["Commit (full)", BUILD_INFO.sha],
    ["Branch", BUILD_INFO.ref || "—"],
    ["Built", BUILD_INFO.builtAt ? new Date(BUILD_INFO.builtAt).toLocaleString() : "—"],
    ["Display mode", standalone ? "standalone (installed / native shell)" : "browser tab"],
    ["Service worker", swController],
    ["User agent", navigator.userAgent],
  ];

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 py-6">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/dashboard">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Diagnostics</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[9rem_1fr] gap-3 py-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-all font-mono text-xs sm:text-sm">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        The native Android app is a thin shell that loads this site over HTTPS.
        A new production deploy changes “Build (commit)” above without any APK
        update.
      </p>
    </div>
  );
}
