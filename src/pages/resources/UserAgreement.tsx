import { Layout } from "@/components/Layout";

export default function UserAgreement() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#1D2226] mb-4 tracking-tight">User Agreement</h1>
        <p className="text-[#5E6B7E] text-base md:text-lg font-medium mb-8">
          The terms that govern your use of Profolio products and services.
        </p>
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-bold mb-2">Acceptance of Terms</h2>
            <p className="text-muted-foreground">By using Profolio, you agree to these terms and applicable policies.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold mb-2">Use of Services</h2>
            <p className="text-muted-foreground">Follow applicable laws and community standards when using the platform.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold mb-2">Changes</h2>
            <p className="text-muted-foreground">We may update terms; continued use constitutes acceptance of changes.</p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
