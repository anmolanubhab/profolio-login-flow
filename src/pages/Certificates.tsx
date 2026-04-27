import CertificateVault from '@/components/CertificateVault';
import BottomNavigation from '@/components/BottomNavigation';

const Certificates = () => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-primary text-primary-foreground sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <h1 className="text-xl font-bold">Certificate Vault</h1>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <CertificateVault />
      </div>
      
      <BottomNavigation />
    </div>
  );
};

export default Certificates;