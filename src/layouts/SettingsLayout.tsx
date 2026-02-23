import { useState } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { Layout } from "@/components/Layout"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"

export default function SettingsLayout() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    if (isSigningOut) return
    setIsSigningOut(true)
    try {
      await signOut()
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      })
      navigate("/")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to sign out",
        variant: "destructive",
      })
      setIsSigningOut(false)
    }
  }

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div
        className="min-h-screen w-full bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/assets/cosmic-bg.png')",
        }}
      >
        <div className="min-h-screen bg-white/40 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
            <Outlet />
          </div>
        </div>
      </div>
    </Layout>
  )
}

