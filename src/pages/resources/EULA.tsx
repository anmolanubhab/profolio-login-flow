import { Layout } from "@/components/Layout";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function EULA() {
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
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#1D2226] mb-4 tracking-tight">End User License Agreement</h1>
        <p className="text-[#5E6B7E] text-base md:text-lg font-medium mb-8">
          License terms for using Profolio software and related components.
        </p>
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-bold mb-2">License Grant</h2>
            <p className="text-muted-foreground">You are granted a limited, non-transferable license to use the services.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold mb-2">Restrictions</h2>
            <p className="text-muted-foreground">Do not attempt to reverse engineer or misuse services beyond license scope.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold mb-2">Termination</h2>
            <p className="text-muted-foreground">Violation of terms may result in suspension or termination of access.</p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
