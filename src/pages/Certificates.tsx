import CertificateVault from '@/components/CertificateVault';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';

const Certificates = () => {
  const { user, signOut } = useAuth();

  return (
    <Layout user={user} onSignOut={signOut}>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <h1 className="text-2xl font-semibold text-foreground mb-6">Certificate Vault</h1>
        <CertificateVault />
      </div>
    </Layout>
  );
};

export default Certificates;