import { Layout } from "@/components/Layout";

export default function RecommendationTransparency() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#1D2226] mb-4 tracking-tight">Recommendation Transparency</h1>
        <p className="text-[#5E6B7E] text-base md:text-lg font-medium mb-8">
          Learn how recommendations are generated and how to control what you see.
        </p>
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-bold mb-2">Signals</h2>
            <p className="text-muted-foreground">We consider your profile, activity, and interests to surface relevant content.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold mb-2">Controls</h2>
            <p className="text-muted-foreground">Adjust your preferences in Settings to tailor recommendations.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold mb-2">Feedback</h2>
            <p className="text-muted-foreground">Use in-product feedback to refine what appears in your feed.</p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
