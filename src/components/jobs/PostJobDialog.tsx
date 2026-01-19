import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Briefcase, Building2, DollarSign, Eye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompanySelector } from './CompanySelector';
import { jobSchema } from '@/lib/validation-schemas';
import { sanitizeInput, isValidUrl } from '@/lib/input-sanitizer';
interface Job {
  id?: string;
  title: string;
  company_name: string;
  description: string;
  requirements: string;
  location: string;
  employment_type: string;
  remote_option: string;
  apply_link: string;
  salary_min: string | number;
  salary_max: string | number;
  currency: string;
}

interface PostJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  onJobPosted: () => void;
  editJob?: Job | null;
}

export const PostJobDialog = ({ open, onOpenChange, profileId, onJobPosted, editJob }: PostJobDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('form');
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: '',
    company_id: '',
    company_name: '',
    description: '',
    requirements: '',
    location: '',
    employment_type: 'full-time',
    remote_option: 'on-site',
    apply_link: '',
    salary_min: '',
    salary_max: '',
    currency: 'USD',
  });

  useEffect(() => {
    if (editJob) {
      setFormData({
        title: editJob.title,
        company_id: (editJob as any).company_id || '',
        company_name: editJob.company_name,
        description: editJob.description,
        requirements: editJob.requirements || '',
        location: editJob.location,
        employment_type: editJob.employment_type,
        remote_option: editJob.remote_option,
        apply_link: editJob.apply_link || '',
        salary_min: editJob.salary_min?.toString() || '',
        salary_max: editJob.salary_max?.toString() || '',
        currency: editJob.currency || 'USD',
      });
    }
  }, [editJob]);

  const validateForm = () => {
    // Use zod schema for validation
    const result = jobSchema.safeParse(formData);
    
    if (!result.success) {
      const firstError = result.error.errors[0];
      toast({
        title: 'Validation Error',
        description: firstError.message,
        variant: 'destructive',
      });
      return false;
    }

    // Additional cross-field validation
    if (formData.salary_min && formData.salary_max) {
      if (parseFloat(formData.salary_min) > parseFloat(formData.salary_max)) {
        toast({
          title: 'Validation Error',
          description: 'Minimum salary cannot be greater than maximum salary',
          variant: 'destructive',
        });
        return false;
      }
    }

    // Validate apply_link is safe URL if provided
    if (formData.apply_link && !isValidUrl(formData.apply_link)) {
      toast({
        title: 'Validation Error',
        description: 'Application link must be a valid URL (http:// or https://)',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    
    if (!isDraft && !validateForm()) return;
    
    setLoading(true);

    try {
      // Sanitize all text inputs
      const jobData = {
        posted_by: profileId,
        title: sanitizeInput(formData.title),
        company_id: formData.company_id || null,
        company_name: sanitizeInput(formData.company_name),
        description: sanitizeInput(formData.description),
        requirements: formData.requirements ? sanitizeInput(formData.requirements) : null,
        location: sanitizeInput(formData.location),
        employment_type: formData.employment_type,
        remote_option: formData.remote_option,
        apply_link: formData.apply_link && isValidUrl(formData.apply_link) ? formData.apply_link.trim() : null,
        salary_min: formData.salary_min ? parseFloat(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseFloat(formData.salary_max) : null,
        currency: formData.currency,
        status: isDraft ? 'draft' : 'open',
      };

      let error;
      if (editJob?.id) {
        const result = await supabase
          .from('jobs')
          .update(jobData)
          .eq('id', editJob.id);
        error = result.error;
      } else {
        const result = await supabase.from('jobs').insert(jobData);
        error = result.error;
      }

      if (error) throw error;

      toast({
        title: 'Success',
        description: editJob ? 'Job updated successfully!' : isDraft ? 'Job saved as draft!' : 'Job posted successfully!',
      });

      onOpenChange(false);
      onJobPosted();
      setFormData({
        title: '',
        company_id: '',
        company_name: '',
        description: '',
        requirements: '',
        location: '',
        employment_type: 'full-time',
        remote_option: 'on-site',
        apply_link: '',
        salary_min: '',
        salary_max: '',
        currency: 'USD',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatSalary = () => {
    if (!formData.salary_min || !formData.salary_max) return null;
    return `${formData.currency} ${parseFloat(formData.salary_min).toLocaleString()} - ${parseFloat(formData.salary_max).toLocaleString()}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{editJob ? 'Edit Job Post' : 'Post a New Job'}</DialogTitle>
          <DialogDescription>Fill in the details to {editJob ? 'update' : 'post'} a job opening</DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="form" className="text-sm font-medium">Job Details</TabsTrigger>
            <TabsTrigger value="preview" className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="form">
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-[#0A66C2]" />
                    Basic Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title" className="text-sm font-medium text-[#1D2226]">Job Title *</Label>
                      <Input
                        id="title"
                        placeholder="e.g. Senior React Developer"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        maxLength={200}
                        className="mt-1.5 border-[#E5E7EB] focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2] transition-all"
                        required
                      />
                    </div>
                    <CompanySelector
                      profileId={profileId}
                      value={formData.company_id}
                      onChange={(companyId, companyName) => 
                        setFormData({ ...formData, company_id: companyId, company_name: companyName })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Job Description *</h3>
                  <Textarea
                    id="description"
                    placeholder="Describe the role, key responsibilities, and what makes this opportunity exciting..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={5}
                    maxLength={10000}
                    className="border-[#E5E7EB] focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2] transition-all resize-none"
                    required
                  />
                  <p className="text-xs text-muted-foreground">{formData.description.length}/10,000 characters</p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Requirements & Qualifications</h3>
                  <Textarea
                    id="requirements"
                    placeholder="List required skills, experience level, education, certifications..."
                    value={formData.requirements}
                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                    rows={4}
                    maxLength={10000}
                    className="border-[#E5E7EB] focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2] transition-all resize-none"
                  />
                  <p className="text-xs text-muted-foreground">{formData.requirements.length}/10,000 characters</p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Application Method</h3>
                  <div>
                    <Label htmlFor="apply_link" className="text-sm font-medium text-[#1D2226]">Application Link or Email</Label>
                    <Input
                      id="apply_link"
                      placeholder="e.g. https://company.com/apply"
                      value={formData.apply_link}
                      onChange={(e) => setFormData({ ...formData, apply_link: e.target.value })}
                      maxLength={500}
                      type="url"
                      className="mt-1.5 border-[#E5E7EB] focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2] transition-all"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Must be a valid URL (http:// or https://)</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#0A66C2]" />
                    Location & Work Type
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="location" className="text-sm font-medium text-[#1D2226]">Location *</Label>
                      <Input
                        id="location"
                        placeholder="e.g. New York, NY"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        maxLength={200}
                        className="mt-1.5 border-[#E5E7EB] focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2] transition-all"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="employment_type" className="text-sm font-medium text-[#1D2226]">Employment Type *</Label>
                      <Select value={formData.employment_type} onValueChange={(value) => setFormData({ ...formData, employment_type: value })}>
                        <SelectTrigger className="mt-1.5 border-[#E5E7EB]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full-time">Full-time</SelectItem>
                          <SelectItem value="part-time">Part-time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="internship">Internship</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="remote_option" className="text-sm font-medium text-[#1D2226]">Remote Option *</Label>
                      <Select value={formData.remote_option} onValueChange={(value) => setFormData({ ...formData, remote_option: value })}>
                        <SelectTrigger className="mt-1.5 border-[#E5E7EB]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="on-site">On-site</SelectItem>
                          <SelectItem value="remote">Remote</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-[#0A66C2]" />
                    Compensation
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="currency" className="text-sm font-medium text-[#1D2226]">Currency</Label>
                      <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                        <SelectTrigger className="mt-1.5 border-[#E5E7EB]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="INR">INR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="salary_min" className="text-sm font-medium text-[#1D2226]">Minimum Salary</Label>
                      <Input
                        id="salary_min"
                        type="number"
                        placeholder="50000"
                        value={formData.salary_min}
                        onChange={(e) => setFormData({ ...formData, salary_min: e.target.value })}
                        className="mt-1.5 border-[#E5E7EB] focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2] transition-all"
                      />
                    </div>
                    <div>
                      <Label htmlFor="salary_max" className="text-sm font-medium text-[#1D2226]">Maximum Salary</Label>
                      <Input
                        id="salary_max"
                        type="number"
                        placeholder="100000"
                        value={formData.salary_max}
                        onChange={(e) => setFormData({ ...formData, salary_max: e.target.value })}
                        className="mt-1.5 border-[#E5E7EB] focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2] transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)} 
                  disabled={loading}
                  className="border-[#E5E7EB] hover:bg-[#F3F6F9] transition-all"
                >
                  Cancel
                </Button>
                {!editJob && (
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={(e) => handleSubmit(e, true)}
                    disabled={loading || !formData.title.trim() || (!formData.company_id && !formData.company_name.trim())}
                    className="bg-[#F3F6F9] hover:bg-[#E5E7EB] text-[#1D2226] transition-all"
                  >
                    {loading ? 'Saving...' : 'Save Draft'}
                  </Button>
                )}
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="bg-[#0A66C2] hover:bg-[#084c97] text-white transition-all"
                >
                  {loading ? 'Posting...' : editJob ? 'Update Job' : 'Post Job'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <Card className="bg-white shadow-[0_4px_10px_rgba(0,0,0,0.05)] border-[#E5E7EB] hover:shadow-lg transition-all">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-[#F3F6F9] flex items-center justify-center shrink-0">
                      <Building2 className="w-6 h-6 text-[#0A66C2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-xl text-[#1D2226] mb-1">
                        {formData.title || 'Job Title'}
                      </h3>
                      <p className="text-base text-[#5E6B7E]">
                        {formData.company_name || 'Company Name'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="flex items-center gap-1 bg-[#F3F6F9] text-[#1D2226]">
                      <MapPin className="w-3 h-3" />
                      {formData.location || 'Location'}
                    </Badge>
                    <Badge variant="secondary" className="flex items-center gap-1 bg-[#F3F6F9] text-[#1D2226]">
                      <Briefcase className="w-3 h-3" />
                      {formData.employment_type}
                    </Badge>
                    <Badge variant="outline" className="border-[#E5E7EB]">
                      {formData.remote_option}
                    </Badge>
                    {formatSalary() && (
                      <Badge variant="secondary" className="flex items-center gap-1 bg-[#F3F6F9] text-[#0A66C2] font-semibold">
                        <DollarSign className="w-3 h-3" />
                        {formatSalary()}
                      </Badge>
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold text-base text-[#1D2226] mb-2">Job Description</h4>
                    <p className="text-sm text-[#5E6B7E] whitespace-pre-wrap">
                      {formData.description || 'No description provided yet...'}
                    </p>
                  </div>

                  {formData.requirements && (
                    <div>
                      <h4 className="font-semibold text-base text-[#1D2226] mb-2">Requirements</h4>
                      <p className="text-sm text-[#5E6B7E] whitespace-pre-wrap">
                        {formData.requirements}
                      </p>
                    </div>
                  )}

                  {formData.apply_link && (
                    <div>
                      <h4 className="font-semibold text-base text-[#1D2226] mb-2">How to Apply</h4>
                      <p className="text-sm text-[#0A66C2] break-all">
                        {formData.apply_link}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <p className="text-xs text-[#5E6B7E] text-center">
              This is how your job post will appear to candidates
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
