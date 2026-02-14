import { ReactNode, useEffect, useRef, useState } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
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

function LayoutContent({ children, user, onSignOut }: LayoutProps) {
  const { showHeader, showBottomNav } = useScrollDirection(15);
  const isMobile = useIsMobile();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [lockOpen, setLockOpen] = useState(false);
  const [password, setPassword] = useState("");
  const timerRef = useRef<number | null>(null);

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
      {/* Fixed top navbar */}
      <NavBar user={user} onSignOut={onSignOut} visible={showHeader} />

      {/* Sidebar (desktop only) */}
      {!isMobile && (
        <div className="hidden lg:block">
          <AppSidebar />
        </div>
      )}

      {/* Main content */}
      <div className="layout content flex-1 min-w-0 transition-all duration-300 ease-out">
        <main className="feed pb-24 w-full max-w-full">
          {children}
        </main>
      </div>

      {/* Bottom Navigation (mobile only) */}
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
    <SidebarProvider>
      <LayoutContent {...props} />
    </SidebarProvider>
  )
}
