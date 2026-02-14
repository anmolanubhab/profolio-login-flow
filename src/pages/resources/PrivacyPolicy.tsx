import { Layout } from "@/components/Layout";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
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
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#1D2226] mb-4 tracking-tight">Privacy Policy</h1>
        <p className="text-[#5E6B7E] text-base md:text-lg font-medium mb-8">
          Learn how we collect, use, and protect your personal information.
        </p>
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-bold mb-2">Information We Collect</h2>
            <p className="text-muted-foreground">Profile details, account settings, usage data, and communications.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold mb-2">How We Use Information</h2>
            <p className="text-muted-foreground">To provide core features, improve the product, and secure your account.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold mb-2">Your Choices</h2>
            <p className="text-muted-foreground">Manage visibility, notifications, and data preferences in Settings.</p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
