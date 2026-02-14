import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building2, Upload, X } from 'lucide-react';

interface Company {
  id?: string;
  name: string;
  description: string;
  location: string;
  website: string;
  logo_url: string;
  industry: string;
  employee_count: string;
  founded_year: string;
  culture: string;
  values: string[];
}

interface CompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  onCompanyCreated: (company: any) => void;
  editCompany?: Company | null;
}

export const CompanyDialog = ({ open, onOpenChange, profileId, onCompanyCreated, editCompany }: CompanyDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    website: '',
    industry: '',
    employee_count: '',
    founded_year: '',
    culture: '',
    values: '',
  });

  useEffect(() => {
    if (editCompany) {
      setFormData({
        name: editCompany.name,
        description: editCompany.description || '',
        location: editCompany.location || '',
        website: editCompany.website || '',
        industry: editCompany.industry || '',
        employee_count: editCompany.employee_count || '',
        founded_year: editCompany.founded_year || '',
        culture: editCompany.culture || '',
        values: editCompany.values?.join(', ') || '',
      });
      setLogoPreview(editCompany.logo_url || '');
    } else {
      setFormData({
        name: '',
        description: '',
        location: '',
        website: '',
        industry: '',
        employee_count: '',
        founded_year: '',
        culture: '',
        values: '',
      });
      setLogoPreview('');
      setLogoFile(null);
    }
  }, [editCompany, open]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Logo must be less than 2MB',
          variant: 'destructive',
        });
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const uploadLogo = async (userId: string): Promise<string | null> => {
    if (!logoFile) return null; // Return null if no new file, don't return existing URL

    const fileExt = logoFile.name.split('.').pop()?.toLowerCase() || 'png';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 10);
    // Use userId folder to comply with RLS policy: {userId}/{filename}
    const filePath = `${userId}/company-logo-${timestamp}-${randomStr}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, logoFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Logo upload failed:', uploadError);
      throw new Error(`Logo upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a company name',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Get current user for storage path
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const signal = new AbortController().signal;

      // Upload logo first (only if new file selected)
      const newLogoUrl = await uploadLogo(user.id);

      const valuesArray = formData.values
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0);

      let result;
      if (editCompany?.id) {
        // Build dynamic update payload - only include changed fields
        const updateData: Record<string, any> = {};
        
        // Only include fields that have changed
        if (formData.name !== editCompany.name) updateData.name = formData.name;
        if (formData.description !== (editCompany.description || '')) updateData.description = formData.description || null;
        if (formData.location !== (editCompany.location || '')) updateData.location = formData.location || null;
        if (formData.website !== (editCompany.website || '')) updateData.website = formData.website || null;
        if (formData.industry !== (editCompany.industry || '')) updateData.industry = formData.industry || null;
        if (formData.employee_count !== (editCompany.employee_count || '')) updateData.employee_count = formData.employee_count || null;
        if (formData.culture !== (editCompany.culture || '')) updateData.culture = formData.culture || null;
        
        const foundedYear = formData.founded_year ? parseInt(formData.founded_year) : null;
        if (foundedYear !== (editCompany.founded_year ? parseInt(editCompany.founded_year) : null)) {
          updateData.founded_year = foundedYear;
        }
        
        const newValues = valuesArray.length > 0 ? valuesArray : null;
        if (JSON.stringify(newValues) !== JSON.stringify(editCompany.values)) {
          updateData.values = newValues;
        }
        
        // Only add logo_url if a new file was uploaded
        if (newLogoUrl) {
          updateData.logo_url = newLogoUrl;
        }

        // Only update if there are changes
        if (Object.keys(updateData).length === 0) {
          toast({
            title: 'No Changes',
            description: 'No changes were made to the company.',
          });
          onOpenChange(false);
          return;
        }

        result = await supabase
          .from('companies')
          .update(updateData)
          .eq('id', editCompany.id)
          .select()
          .abortSignal(signal)
          .single();
      } else {
        // INSERT - include all fields including owner_id
        const insertData = {
          owner_id: profileId,
          name: formData.name,
          description: formData.description || null,
          location: formData.location || null,
          website: formData.website || null,
          logo_url: newLogoUrl || null,
          industry: formData.industry || null,
          employee_count: formData.employee_count || null,
          founded_year: formData.founded_year ? parseInt(formData.founded_year) : null,
          culture: formData.culture || null,
          values: valuesArray.length > 0 ? valuesArray : null,
        };

        result = await supabase
          .from('companies')
          .insert(insertData)
          .select()
          .abortSignal(signal)
          .single();
      }

      if (result.error) throw result.error;

      toast({
        title: 'Success',
        description: editCompany ? 'Company updated successfully!' : 'Company created successfully!',
      });

      onCompanyCreated(result.data);
      onOpenChange(false);
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) return;
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Building2 className="h-6 w-6 text-[#0A66C2]" />
            {editCompany ? 'Edit Company' : 'Create Company Profile'}
          </DialogTitle>
          <DialogDescription>
            {editCompany ? 'Update your company information' : 'Add your company details to post jobs'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-[#1D2226]">Company Logo</Label>
              <div className="mt-2 flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg bg-[#F3F6F9] flex items-center justify-center overflow-hidden border-2 border-[#E5E7EB]">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-8 h-8 text-[#5E6B7E]" />
                  )}
                </div>
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                    id="logo-upload"
                  />
                  <Label
                    htmlFor="logo-upload"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#E5E7EB] rounded-lg cursor-pointer hover:bg-[#F3F6F9] transition-all text-sm font-medium"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Logo
                  </Label>
                  {logoPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview('');
                      }}
                      className="ml-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  <p className="text-xs text-[#5E6B7E] mt-1">Max 2MB, PNG or JPG</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name" className="text-sm font-medium text-[#1D2226]">Company Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. TechCorp Inc."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1.5 border-[#E5E7EB] focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
                  required
                />
              </div>

              <div>
                <Label htmlFor="industry" className="text-sm font-medium text-[#1D2226]">Industry</Label>
                <Select value={formData.industry} onValueChange={(value) => setFormData({ ...formData, industry: value })}>
                  <SelectTrigger className="mt-1.5 border-[#E5E7EB]">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="employee_count" className="text-sm font-medium text-[#1D2226]">Company Size</Label>
                <Select value={formData.employee_count} onValueChange={(value) => setFormData({ ...formData, employee_count: value })}>
                  <SelectTrigger className="mt-1.5 border-[#E5E7EB]">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-10">1-10 employees</SelectItem>
                    <SelectItem value="11-50">11-50 employees</SelectItem>
                    <SelectItem value="51-200">51-200 employees</SelectItem>
                    <SelectItem value="201-500">201-500 employees</SelectItem>
                    <SelectItem value="501-1000">501-1000 employees</SelectItem>
                    <SelectItem value="1000+">1000+ employees</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="location" className="text-sm font-medium text-[#1D2226]">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g. San Francisco, CA"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="mt-1.5 border-[#E5E7EB] focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
                />
              </div>

              <div>
                <Label htmlFor="founded_year" className="text-sm font-medium text-[#1D2226]">Founded Year</Label>
                <Input
                  id="founded_year"
                  type="number"
                  placeholder="e.g. 2020"
                  value={formData.founded_year}
                  onChange={(e) => setFormData({ ...formData, founded_year: e.target.value })}
                  className="mt-1.5 border-[#E5E7EB] focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
                  min="1800"
                  max={new Date().getFullYear()}
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="website" className="text-sm font-medium text-[#1D2226]">Website</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://www.company.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="mt-1.5 border-[#E5E7EB] focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="description" className="text-sm font-medium text-[#1D2226]">Company Description</Label>
                <Textarea
                  id="description"
                  placeholder="Tell us about your company and mission..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="mt-1.5 border-[#E5E7EB] focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2] resize-none"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="culture" className="text-sm font-medium text-[#1D2226]">Company Culture</Label>
                <Textarea
                  id="culture"
                  placeholder="Describe your company culture, work environment, and what makes it unique..."
                  value={formData.culture}
                  onChange={(e) => setFormData({ ...formData, culture: e.target.value })}
                  rows={3}
                  className="mt-1.5 border-[#E5E7EB] focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2] resize-none"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="values" className="text-sm font-medium text-[#1D2226]">Company Values</Label>
                <Input
                  id="values"
                  placeholder="e.g. Innovation, Integrity, Teamwork, Excellence"
                  value={formData.values}
                  onChange={(e) => setFormData({ ...formData, values: e.target.value })}
                  className="mt-1.5 border-[#E5E7EB] focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
                />
                <p className="text-xs text-[#5E6B7E] mt-1">Separate values with commas</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="border-[#E5E7EB] hover:bg-[#F3F6F9]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#0A66C2] hover:bg-[#084c97] text-white"
            >
              {loading ? 'Saving...' : editCompany ? 'Update Company' : 'Create Company'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};