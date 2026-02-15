import { Layout } from "@/components/Layout";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function HelpCenter() {
  const navigate = useNavigate();
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-6">
          <Button variant="outline" className="rounded-full" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/settings"))}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#1D2226] mb-4 tracking-tight">Help Center</h1>
        <p className="text-[#5E6B7E] text-base md:text-lg font-medium mb-8">
          Find answers to common questions and learn how to make the most of Profolio.
        </p>
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-bold mb-2">Getting Started</h2>
            <p className="text-muted-foreground">Set up your profile, connect with professionals, and explore opportunities.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold mb-2">Account & Security</h2>
            <p className="text-muted-foreground">Manage your account, privacy, and notifications.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold mb-2">Jobs & Applications</h2>
            <p className="text-muted-foreground">Search jobs, apply, and track your applications.</p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
