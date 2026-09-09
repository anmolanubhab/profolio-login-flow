import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { VaultShell } from '@/components/vault/VaultShell';

/**
 * Certificate Vault — a Google Drive-style professional document manager for
 * certificates, credentials, licences and proofs. Edge-to-edge (no centred
 * max-width container): the shell owns its own nav rail + toolbar + content.
 */
const Certificates = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate('/');
        return;
      }
      setUser(session.user);
      setLoading(false);
    });
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <VaultShell />
    </Layout>
  );
};

export default Certificates;
