import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  industry: string | null;
  location: string | null;
  website: string | null;
  employee_count: string | null;
  founded_year: number | null;
  culture: string | null;
  values: string[] | null;
  created_at: string;
  owner_id: string | null;
}

interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: 'super_admin' | 'content_admin';
  created_at: string;
  profile?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    profession: string | null;
  };
}

interface CompanyInvitation {
  id: string;
  company_id: string;
  email: string;
  role: 'super_admin' | 'content_admin';
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  expires_at: string;
  created_at: string;
  company?: Company;
}

export function useCompany(companyId?: string) {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  const fetchCompany = useCallback(async (signal?: AbortSignal) => {
    if (!companyId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch company details
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .abortSignal(signal)
        .single();

      if (companyError) {
        if (companyError.code === 'ABORTED') return;
        throw companyError;
      }
      setCompany(companyData);

      // Get profile ID if logged in
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .abortSignal(signal)
          .maybeSingle();

        if (profileError && profileError.code !== 'ABORTED') {
          console.error('Error fetching profile:', profileError);
        }

        if (profile) {
          setProfileId(profile.id);

          // Check if user is admin of this company
          const { data: membership, error: membershipError } = await supabase
            .from('company_members')
            .select('role')
            .eq('company_id', companyId)
            .eq('user_id', profile.id)
            .abortSignal(signal)
            .maybeSingle();

          if (membershipError && membershipError.code !== 'ABORTED') {
            console.error('Error fetching membership:', membershipError);
          }

          setIsAdmin(!!membership || companyData?.owner_id === profile.id);

          // Check if user is following
          const { data: following, error: followingError } = await supabase
            .from('company_followers')
            .select('id')
            .eq('company_id', companyId)
            .eq('user_id', profile.id)
            .abortSignal(signal)
            .maybeSingle();

          if (followingError && followingError.code !== 'ABORTED') {
            console.error('Error fetching following status:', followingError);
          }

          setIsFollowing(!!following);
        }
      }

      // Fetch follower count
      const { count, error: countError } = await supabase
        .from('company_followers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .abortSignal(signal);

      if (countError && countError.code !== 'ABORTED') {
        console.error('Error fetching follower count:', countError);
      }

      setFollowerCount(count || 0);

    } catch (error: any) {
      if (error.code === 'ABORTED' || error.name === 'AbortError') return;
      console.error('Error fetching company:', error);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, user]);

  const fetchMembers = useCallback(async (signal?: AbortSignal) => {
    if (!companyId || !isAdmin) return;

    try {
      const { data, error } = await supabase
        .from('company_members')
        .select(`
          id,
          company_id,
          user_id,
          role,
          created_at
        `)
        .eq('company_id', companyId)
        .abortSignal(signal);

      if (error) {
        if (error.code === 'ABORTED') return;
        throw error;
      }

      // Fetch profile details for each member
      if (data && data.length > 0) {
        const memberIds = data.map(m => m.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, profession')
          .in('id', memberIds)
          .abortSignal(signal);

        if (profilesError && profilesError.code !== 'ABORTED') {
          console.error('Error fetching member profiles:', profilesError);
        }

        const membersWithProfiles = data.map(member => ({
          ...member,
          profile: profiles?.find(p => p.id === member.user_id)
        }));

        setMembers(membersWithProfiles);
      } else {
        setMembers([]);
      }
    } catch (error: any) {
      if (error.code === 'ABORTED' || error.name === 'AbortError') return;
      console.error('Error fetching members:', error);
    }
  }, [companyId, isAdmin]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCompany(controller.signal);
    return () => controller.abort();
  }, [fetchCompany]);

  useEffect(() => {
    if (isAdmin) {
      const controller = new AbortController();
      fetchMembers(controller.signal);
      return () => controller.abort();
    }
  }, [isAdmin, fetchMembers]);

  const followCompany = async () => {
    if (!profileId || !companyId) return false;

    try {
      const { error } = await supabase
        .from('company_followers')
        .insert({ company_id: companyId, user_id: profileId });

      if (error) throw error;
      
      setIsFollowing(true);
      setFollowerCount(prev => prev + 1);
      return true;
    } catch (error) {
      console.error('Error following company:', error);
      return false;
    }
  };

  const unfollowCompany = async () => {
    if (!profileId || !companyId) return false;

    try {
      const { error } = await supabase
        .from('company_followers')
        .delete()
        .eq('company_id', companyId)
        .eq('user_id', profileId);

      if (error) throw error;
      
      setIsFollowing(false);
      setFollowerCount(prev => Math.max(0, prev - 1));
      return true;
    } catch (error) {
      console.error('Error unfollowing company:', error);
      return false;
    }
  };

  const inviteEmployee = async (email: string, role: 'super_admin' | 'content_admin' = 'content_admin') => {
    if (!profileId || !companyId) return { success: false, error: 'Not authenticated' };

    try {
      const { data: token, error } = await supabase.rpc('create_company_invitation', {
        company_id: companyId,
        email,
        role
      });

      if (error) throw error;
      return { success: true, token }; // Return token to UI
    } catch (error: any) {
      console.error('Error inviting employee:', error);
      return { success: false, error: error.message };
    }
  };

  const removeMember = async (memberId: string) => {
    if (!companyId) return false;

    try {
      const { error } = await supabase
        .from('company_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      
      setMembers(prev => prev.filter(m => m.id !== memberId));
      return true;
    } catch (error) {
      console.error('Error removing member:', error);
      return false;
    }
  };

  const updateMemberRole = async (memberId: string, newRole: 'super_admin' | 'content_admin') => {
    if (!companyId) return false;

    try {
      const { error } = await supabase
        .from('company_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;
      
      setMembers(prev => prev.map(m => 
        m.id === memberId ? { ...m, role: newRole } : m
      ));
      return true;
    } catch (error) {
      console.error('Error updating member role:', error);
      return false;
    }
  };

  return {
    company,
    members,
    isLoading,
    isAdmin,
    isFollowing,
    followerCount,
    profileId,
    followCompany,
    unfollowCompany,
    inviteEmployee,
    removeMember,
    updateMemberRole,
    refetch: fetchCompany,
    refetchMembers: fetchMembers
  };
}

export function useCompanyInvitations() {
  const { user, profile } = useAuth();
  const [invitations, setInvitations] = useState<CompanyInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInvitations = useCallback(async (signal?: AbortSignal) => {
    if (!user?.email) {
      setIsLoading(false);
      setInvitations([]);
      return;
    }

    setIsLoading(true);
    try {
      // Filter by user's email to get their invitations
      const { data, error } = await supabase
        .from('company_invitations')
        .select(`
          id,
          company_id,
          email,
          role,
          status,
          expires_at,
          created_at
        `)
        .eq('email', user.email)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .abortSignal(signal);

      if (error) {
        if (error.code === 'ABORTED') return;
        // Suppress permission denied errors (42501) which happen if RLS is strict or table permissions are missing
        if (error.code !== '42501') {
          console.error('Error fetching invitations:', error);
        }
        setInvitations([]);
        return;
      }

      if (data && data.length > 0) {
        // Fetch company details for each invitation
        const companyIds = [...new Set(data.map(inv => inv.company_id))];
        const { data: companies, error: companiesError } = await supabase
          .from('companies')
          .select('*')
          .in('id', companyIds)
          .abortSignal(signal);

        if (companiesError && companiesError.code !== 'ABORTED') {
          console.error('Error fetching companies for invitations:', companiesError);
        }

        const invitationsWithCompanies: CompanyInvitation[] = data.map(inv => ({
          id: inv.id,
          company_id: inv.company_id,
          email: inv.email,
          role: inv.role as 'super_admin' | 'content_admin',
          status: inv.status as 'pending' | 'accepted' | 'rejected' | 'expired',
          expires_at: inv.expires_at,
          created_at: inv.created_at,
          company: companies?.find(c => c.id === inv.company_id)
        }));

        setInvitations(invitationsWithCompanies);
      } else {
        setInvitations([]);
      }
    } catch (error: any) {
      if (error.code === 'ABORTED' || error.name === 'AbortError') return;
      console.error('Error fetching invitations:', error);
      setInvitations([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    const controller = new AbortController();
    fetchInvitations(controller.signal);
    return () => controller.abort();
  }, [fetchInvitations]);

  const acceptInvitation = async (invitationId: string, token: string) => {
    try {
      const { data, error } = await supabase.rpc('accept_company_invitation_v2', {
        invitation_id: invitationId,
        token_input: token
      });

      if (error) throw error;
      
      // Check for application-level errors returned by RPC
      if (data && !data.success) {
         throw new Error(data.error || 'Failed to accept invitation');
      }

      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      return { success: true };
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      return { success: false, error: error.message };
    }
  };

  const rejectInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('company_invitations')
        .update({ status: 'rejected' })
        .eq('id', invitationId);

      if (error) throw error;
      
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      return { success: true };
    } catch (error: any) {
      console.error('Error rejecting invitation:', error);
      return { success: false, error: error.message };
    }
  };

  return {
    invitations,
    isLoading,
    acceptInvitation,
    rejectInvitation,
    refetch: fetchInvitations
  };
}
