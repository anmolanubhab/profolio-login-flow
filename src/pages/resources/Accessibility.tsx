import { Layout } from "@/components/Layout";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Accessibility() {
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
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#1D2226] mb-4 tracking-tight">Accessibility</h1>
        <p className="text-[#5E6B7E] text-base md:text-lg font-medium mb-8">
          Our commitment is to make Profolio usable and inclusive for everyone.
        </p>
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-bold mb-2">Standards</h2>
            <p className="text-muted-foreground">We aim to align with WCAG guidelines in design and development.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold mb-2">Keyboard & Screen Readers</h2>
            <p className="text-muted-foreground">We prioritize keyboard navigation and ARIA labeling for assistive tech.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold mb-2">Feedback</h2>
            <p className="text-muted-foreground">If you encounter barriers, please report them so we can improve.</p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
