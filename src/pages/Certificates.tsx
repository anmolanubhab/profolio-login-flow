import CertificateVault from '@/components/CertificateVault';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';

const Certificates = () => {
  const { user, signOut } = useAuth();

  return (
    <Layout user={user} onSignOut={signOut}>
      <div
        className="min-h-screen"
        style={{ background: "radial-gradient(1000px 300px at 0% 0%, #e9d5ff 0%, #fce7f3 40%, #dbeafe 80%)" }}
      >
        <div className="relative w-full bg-gradient-to-r from-indigo-300 via-pink-200 to-blue-200 rounded-b-3xl py-14 px-8 overflow-hidden">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="text-center md:text-left animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <h1 className="text-3xl md:text-5xl font-extrabold text-[#1D2226] mb-2 tracking-tight">
                  Certificate Vault
                </h1>
                <p className="text-gray-700 text-base md:text-lg font-medium max-w-2xl mx-auto md:mx-0">
                  Securely store and manage your professional certifications.
                </p>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -top-20 -right-32 w-[400px] h-[400px] bg-white/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-16 w-[300px] h-[300px] bg-white/20 rounded-full blur-3xl" />
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
