import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { SettingsShell } from '@/components/settings/SettingsShell';
import { SETTINGS_CATEGORIES, type SettingsCategoryId } from '@/config/settingsConfig';

const VALID_CATEGORY_IDS = new Set(SETTINGS_CATEGORIES.map((c) => c.id));

function isValidCategory(id: string | undefined): id is SettingsCategoryId {
  return !!id && VALID_CATEGORY_IDS.has(id as SettingsCategoryId);
}

export default function SettingsPage() {
  const { category } = useParams<{ category?: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setUser(user);
      setLoading(false);
    };
    init();
  }, [navigate]);

  useEffect(() => {
    // An unrecognized /settings/:category falls back to the category list
    // rather than 404ing -- keeps the shell forgiving of stale/bad links.
    if (category && !isValidCategory(category)) {
      navigate('/settings', { replace: true });
    }
  }, [category, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <Layout user={user} onSignOut={handleSignOut} fullWidth>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <SettingsShell activeCategory={isValidCategory(category) ? category : undefined} />
    </Layout>
  );
}
