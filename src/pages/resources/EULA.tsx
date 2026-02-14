import { Layout } from "@/components/Layout";

export default function EULA() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-10">
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
