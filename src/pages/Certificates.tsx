import CertificateVault from '@/components/CertificateVault';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';

const Certificates = () => {
  const { user, signOut } = useAuth();

  return (
    <Layout user={user} onSignOut={signOut}>
      <div className="min-h-screen bg-white">
        {/* Universal Page Hero Section */}
        <div className="relative w-full overflow-hidden border-b border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-5 animate-gradient-shift" />
          <div className="max-w-4xl mx-auto py-12 px-6 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-extrabold text-[#1D2226] mb-3 tracking-tight">
                  Certificate Vault
                </h1>
                <p className="text-[#5E6B7E] text-base md:text-xl font-medium max-w-2xl mx-auto md:mx-0">
                  Securely store and manage your professional certifications.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto py-8 px-4">
          <CertificateVault />
        </div>
      </div>
    </Layout>
  );
};

export default Certificates;