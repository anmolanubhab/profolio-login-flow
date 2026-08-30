import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/** Auth glue shared by the Insights pages: the Supabase user for <Layout>
 *  and a sign-out handler. */
export function useLayoutUser() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return { user, onSignOut };
}
