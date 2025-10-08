import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PostJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  onJobPosted: () => void;
}

export const PostJobDialog = ({ open, onOpenChange, profileId, onJobPosted }: PostJobDialogProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: '',
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

  const validateForm = () => {
    if (!formData.title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a job title',
        variant: 'destructive',
      });
      return false;
    }
    if (!formData.company_name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a company name',
        variant: 'destructive',
      });
      return false;
    }
    if (!formData.description.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a job description',
        variant: 'destructive',
      });
      return false;
    }
    if (!formData.location.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a location',
        variant: 'destructive',
      });
      return false;
    }
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
    return true;
  };

  const handleSubmit = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    
    if (!isDraft && !validateForm()) return;
    
    setLoading(true);

    try {
      // FIXED: Insert with new schema including company_name and apply_link
      const { error } = await supabase.from('jobs').insert({
        posted_by: profileId,
        title: formData.title,
        company_name: formData.company_name,
        description: formData.description,
        requirements: formData.requirements || null,
        location: formData.location,
        employment_type: formData.employment_type,
        remote_option: formData.remote_option,
        apply_link: formData.apply_link || null,
        salary_min: formData.salary_min ? parseFloat(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseFloat(formData.salary_max) : null,
        currency: formData.currency,
        status: isDraft ? 'draft' : 'open',
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: isDraft ? 'Job saved as draft!' : 'Job posted successfully!',
      });

      onOpenChange(false);
      onJobPosted();
      // FIXED: Reset form with new fields
      setFormData({
        title: '',
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Post a New Job</DialogTitle>
          <DialogDescription>Fill in the details to post a job opening</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
          <div>
            <Label htmlFor="title">Job Title</Label>
            <Input
              id="title"
              placeholder="e.g. Senior React Developer"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>
          {/* FIXED: Added company name field */}
          <div>
            <Label htmlFor="company_name">Company Name</Label>
            <Input
              id="company_name"
              placeholder="e.g. TechCorp Inc."
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the role, responsibilities, and what you're looking for..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              required
            />
          </div>
          <div>
            <Label htmlFor="requirements">Requirements</Label>
            <Textarea
              id="requirements"
              placeholder="List the qualifications and skills needed..."
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              rows={3}
            />
          </div>
          {/* FIXED: Added apply link field */}
          <div>
            <Label htmlFor="apply_link">Application Link or Email</Label>
            <Input
              id="apply_link"
              placeholder="e.g. https://company.com/apply or jobs@company.com"
              value={formData.apply_link}
              onChange={(e) => setFormData({ ...formData, apply_link: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="employment_type">Employment Type</Label>
              <Select value={formData.employment_type} onValueChange={(value) => setFormData({ ...formData, employment_type: value })}>
                <SelectTrigger>
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="remote_option">Remote Option</Label>
              <Select value={formData.remote_option} onValueChange={(value) => setFormData({ ...formData, remote_option: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on-site">On-site</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                <SelectTrigger>
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="salary_min">Minimum Salary</Label>
              <Input
                id="salary_min"
                type="number"
                value={formData.salary_min}
                onChange={(e) => setFormData({ ...formData, salary_min: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="salary_max">Maximum Salary</Label>
              <Input
                id="salary_max"
                type="number"
                value={formData.salary_max}
                onChange={(e) => setFormData({ ...formData, salary_max: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={(e) => handleSubmit(e, true)}
              disabled={loading || !formData.title.trim() || !formData.company_name.trim()}
            >
              {loading ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Posting...' : 'Post Job'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
