import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
}

interface CompanyMembership {
  company_id: string;
  role: 'super_admin' | 'content_admin';
  company: Company;
}

export function useCompanyAdmin() {
  const [isLoading, setIsLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyMembership[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanyMemberships();
  }, []);

  const fetchCompanyMemberships = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Get profile ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        setIsLoading(false);
        return;
      }

      setProfileId(profile.id);

      // Get companies where user is owner
      const { data: ownedCompanies } = await supabase
        .from('companies')
        .select('id, name, logo_url, description')
        .eq('owner_id', profile.id);

      // Get companies where user is a member
      const { data: memberships } = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', profile.id);

      // Get company details for memberships
      const memberCompanyIds = memberships?.map(m => m.company_id).filter(id => 
        !ownedCompanies?.some(c => c.id === id)
      ) || [];

      let memberCompanies: Company[] = [];
      if (memberCompanyIds.length > 0) {
        const { data } = await supabase
          .from('companies')
          .select('id, name, logo_url, description')
          .in('id', memberCompanyIds);
        memberCompanies = data || [];
      }

      // Combine owned and member companies
      const allCompanies: CompanyMembership[] = [
        ...(ownedCompanies?.map(c => ({
          company_id: c.id,
          role: 'super_admin' as const,
          company: c as Company
        })) || []),
        ...(memberCompanies.map(c => {
          const membership = memberships?.find(m => m.company_id === c.id);
          return {
            company_id: c.id,
            role: (membership?.role || 'content_admin') as 'super_admin' | 'content_admin',
            company: c
          };
        }))
      ];

      setCompanies(allCompanies);
    } catch (error) {
      console.error('Error fetching company memberships:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isCompanyAdmin = (companyId: string): boolean => {
    return companies.some(c => c.company_id === companyId);
  };

  const getCompanyRole = (companyId: string): 'super_admin' | 'content_admin' | null => {
    const membership = companies.find(c => c.company_id === companyId);
    return membership?.role || null;
  };

  const refetch = () => {
    setIsLoading(true);
    fetchCompanyMemberships();
  };

  return {
    isLoading,
    companies,
    profileId,
    isCompanyAdmin,
    getCompanyRole,
    hasCompanies: companies.length > 0,
    refetch
  };
}
