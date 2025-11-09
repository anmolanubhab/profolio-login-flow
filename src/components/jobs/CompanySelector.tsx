import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Plus } from 'lucide-react';
import { CompanyDialog } from './CompanyDialog';

interface CompanySelectorProps {
  profileId: string;
  value: string;
  onChange: (companyId: string, companyName: string) => void;
}

export const CompanySelector = ({ profileId, value, onChange }: CompanySelectorProps) => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompanyDialog, setShowCompanyDialog] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, [profileId]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('owner_id', profileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyCreated = (company: any) => {
    setCompanies([company, ...companies]);
    onChange(company.id, company.name);
  };

  const handleCompanySelect = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    if (company) {
      onChange(companyId, company.name);
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-[#1D2226]">Select Company *</Label>
      
      {companies.length === 0 && !loading ? (
        <div className="border-2 border-dashed border-[#E5E7EB] rounded-lg p-6 text-center">
          <Building2 className="w-12 h-12 text-[#5E6B7E] mx-auto mb-3" />
          <p className="text-sm text-[#5E6B7E] mb-4">
            You haven't created any company profiles yet
          </p>
          <Button
            type="button"
            onClick={() => setShowCompanyDialog(true)}
            className="bg-[#0A66C2] hover:bg-[#084c97] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Company Profile
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Select value={value} onValueChange={handleCompanySelect} disabled={loading}>
            <SelectTrigger className="flex-1 border-[#E5E7EB]">
              <SelectValue placeholder={loading ? "Loading companies..." : "Choose a company"} />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  <div className="flex items-center gap-2">
                    {company.logo_url ? (
                      <img src={company.logo_url} alt={company.name} className="w-5 h-5 rounded object-cover" />
                    ) : (
                      <Building2 className="w-4 h-4 text-[#5E6B7E]" />
                    )}
                    <span>{company.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowCompanyDialog(true)}
            className="border-[#E5E7EB] hover:bg-[#F3F6F9]"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      )}

      <CompanyDialog
        open={showCompanyDialog}
        onOpenChange={setShowCompanyDialog}
        profileId={profileId}
        onCompanyCreated={handleCompanyCreated}
      />
    </div>
  );
};