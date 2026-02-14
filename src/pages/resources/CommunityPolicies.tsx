import { Layout } from "@/components/Layout";

export default function CommunityPolicies() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#1D2226] mb-4 tracking-tight">Community Policies</h1>
        <p className="text-[#5E6B7E] text-base md:text-lg font-medium mb-8">
          Our standards for respectful, authentic, and professional interactions on Profolio.
        </p>
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-bold mb-2">Be Respectful</h2>
            <p className="text-muted-foreground">Harassment, hate speech, and abuse are not tolerated.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold mb-2">Keep It Professional</h2>
            <p className="text-muted-foreground">Maintain integrity, share truthful information, and respect privacy.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold mb-2">Report Issues</h2>
            <p className="text-muted-foreground">Use built-in reporting tools to flag content or behavior that violates these policies.</p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
