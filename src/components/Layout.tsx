import { ReactNode, useEffect, useRef, useState } from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import NavBar from "./NavBar"
import BottomNavigation from "./BottomNavigation"
import { User } from "@supabase/supabase-js"
import { useScrollDirection } from "@/hooks/use-scroll-direction"
import { useIsMobile } from "@/hooks/use-mobile"
import { useAuth } from "@/contexts/AuthContext"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface LayoutProps {
  children: ReactNode
  user?: User | null
  onSignOut?: () => void
}

interface LayoutContentProps extends LayoutProps {
  showBottomNav: boolean
}

function LayoutContent({ children, user, onSignOut, showBottomNav }: LayoutContentProps) {
  const isMobile = useIsMobile();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [lockOpen, setLockOpen] = useState(false);
  const [password, setPassword] = useState("");
  const timerRef = useRef<number | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const originalFetchRef = useRef<typeof window.fetch | null>(null);
  const lastAttemptRef = useRef<number>(0);
  const backoffMsRef = useRef<number>(15000); // 15s minimum between attempts while offline

  useEffect(() => {
    const mark = () => localStorage.setItem("pf_last_active", Date.now().toString());
    const onActivity = () => mark();
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("visibilitychange", onActivity);
    mark();
    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("visibilitychange", onActivity);
    };
  }, []);

  // Network status + fetch throttle when offline
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      lastAttemptRef.current = 0;
      backoffMsRef.current = 15000;
    };
    const onOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    setIsOnline(navigator.onLine);

    if (!originalFetchRef.current && typeof window !== 'undefined') {
      originalFetchRef.current = window.fetch.bind(window);
      window.fetch = async (...args: Parameters<typeof fetch>) => {
        const now = Date.now();
        if (!navigator.onLine) {
          if (now - lastAttemptRef.current < backoffMsRef.current) {
            return Promise.reject(new Error('Offline (throttled)'));
          }
          lastAttemptRef.current = now;
          // Exponential backoff up to 60s
          backoffMsRef.current = Math.min(backoffMsRef.current * 1.5, 60000);
          return Promise.reject(new Error('Offline'));
        }
        return originalFetchRef.current!(...args);
      };
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (originalFetchRef.current) {
        window.fetch = originalFetchRef.current;
        originalFetchRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!profile?.app_lock_enabled) return;
    const check = () => {
      const last = parseInt(localStorage.getItem("pf_last_active") || "0", 10);
      const idleMs = Date.now() - last;
      if (idleMs > 10 * 60 * 1000) setLockOpen(true);
    };
    check();
    timerRef.current = window.setInterval(check, 30000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [profile?.app_lock_enabled]);

  const reauth = async () => {
    try {
      if (!user?.email) return;
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
      if (error) throw error;
      setLockOpen(false);
      setPassword("");
      localStorage.setItem("pf_last_active", Date.now().toString());
      toast({ title: "Unlocked" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to unlock", variant: "destructive" });
    }
  };

  return (
    <>
      {!isOnline && (
        <div className="w-full bg-amber-500/90 text-white text-sm py-2 px-4 text-center">
          You are offline. Retrying when connection restores…
        </div>
      )}

      <main className="flex flex-col flex-1 w-full pb-24 overflow-x-hidden lg:justify-center">
        <div className="flex flex-col w-full mt-2 px-4 sm:px-6 overflow-x-hidden lg:w-full lg:max-w-5xl lg:px-6 lg:mx-auto">
          {children}
        </div>
      </main>

      {isMobile && <BottomNavigation visible={showBottomNav} />}
      <Dialog open={lockOpen} onOpenChange={(o) => setLockOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-enter password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button onClick={reauth} className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white">Unlock</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function Layout(props: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <LayoutHeader {...props} />
      <LayoutShell {...props} />
    </div>
  )
}

function LayoutHeader({ user, onSignOut }: LayoutProps) {
  const { showHeader } = useScrollDirection(15);
  return (
    <NavBar user={user} onSignOut={onSignOut} visible={showHeader} />
  );
}

function LayoutShell(props: LayoutProps) {
  const { showBottomNav } = useScrollDirection(15);
  return (
    <SidebarProvider>
      <div className="flex flex-1">
        <AppSidebar />
        <SidebarInset>
          <LayoutContent {...props} showBottomNav={showBottomNav} />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
