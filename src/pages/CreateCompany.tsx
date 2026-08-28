import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building2, Upload, X, ArrowLeft, Globe, MapPin, Users } from 'lucide-react';

const INDUSTRIES = [
  'technology',
  'finance',
  'healthcare',
  'education',
  'retail',
  'manufacturing',
  'other',
];

const SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
];

const CreateCompany = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [agree, setAgree] = useState(false);

  const [form, setForm] = useState({
    name: '',
    tagline: '',
    website: '',
    industry: '',
    employee_count: '',
    location: '',
    headquarters: '',
    founded_year: '',
    specialties: '',
    description: '',
  });

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setUser(user);
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (profile) setProfileId(profile.id);
    };
    init();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const pickImage = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPreview: (s: string) => void,
    label: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: `${label} must be less than 2MB`, variant: 'destructive' });
      return;
    }
    setFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const uploadImage = async (
    userId: string,
    file: File | null,
    kind: 'logo' | 'cover'
  ): Promise<string | null> => {
    if (!file) return null;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${userId}/company-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw new Error(`${kind === 'logo' ? 'Logo' : 'Cover'} upload failed: ${error.message}`);
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  };

  const canSubmit = form.name.trim().length > 0 && agree && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profileId) {
      toast({ title: 'Not ready', description: 'Your profile is still loading. Try again in a moment.', variant: 'destructive' });
      return;
    }
    if (!form.name.trim()) {
      toast({ title: 'Name required', description: 'Please enter your company name.', variant: 'destructive' });
      return;
    }
    if (!agree) {
      toast({ title: 'Confirmation required', description: 'Please confirm you are authorised to create this page.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const [logoUrl, coverUrl] = await Promise.all([
        uploadImage(user.id, logoFile, 'logo'),
        uploadImage(user.id, coverFile, 'cover'),
      ]);
      const specialtiesArray = form.specialties
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const { data, error } = await supabase
        .from('companies')
        .insert({
          owner_id: profileId,
          name: form.name.trim(),
          tagline: form.tagline.trim() || null,
          website: form.website.trim() || null,
          industry: form.industry || null,
          employee_count: form.employee_count || null,
          location: form.location.trim() || null,
          headquarters: form.headquarters.trim() || null,
          founded_year: form.founded_year ? parseInt(form.founded_year, 10) : null,
          specialties: specialtiesArray.length > 0 ? specialtiesArray : null,
          description: form.description.trim() || null,
          logo_url: logoUrl,
          cover_image_url: coverUrl,
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Page created', description: `"${data.name}" is live.` });
      navigate(`/company/${data.id}`);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const previewName = form.name.trim() || 'Company name';
  const previewTagline = useMemo(
    () => form.tagline.trim() || form.description.trim().split('\n')[0] || 'Tagline',
    [form.tagline, form.description]
  );

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="max-w-6xl mx-auto py-8 px-4">
        <button
          onClick={() => navigate('/companies')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My Companies
        </button>

        <h1 className="text-3xl font-bold text-foreground mb-1">Create a company page</h1>
        <p className="text-muted-foreground mb-8">
          Give your business a home on Profolio — post jobs, share updates, and grow followers.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="cc-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cc-name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. TechCorp Inc."
                maxLength={120}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cc-tagline">Tagline</Label>
              <Input
                id="cc-tagline"
                value={form.tagline}
                onChange={(e) => set('tagline', e.target.value)}
                placeholder="e.g. Turning product data into decisions"
                maxLength={160}
              />
              <p className="text-xs text-muted-foreground">Short line shown under the company name.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cc-website">Website</Label>
              <Input
                id="cc-website"
                type="url"
                value={form.website}
                onChange={(e) => set('website', e.target.value)}
                placeholder="https://www.company.com"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Industry</Label>
                <Select value={form.industry} onValueChange={(v) => set('industry', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((i) => (
                      <SelectItem key={i} value={i} className="capitalize">
                        {i.charAt(0).toUpperCase() + i.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Company size</Label>
                <Select value={form.employee_count} onValueChange={(v) => set('employee_count', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s} employees
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cc-location">Location</Label>
                <Input
                  id="cc-location"
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                  placeholder="e.g. Bengaluru, India"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cc-hq">Headquarters</Label>
                <Input
                  id="cc-hq"
                  value={form.headquarters}
                  onChange={(e) => set('headquarters', e.target.value)}
                  placeholder="e.g. Bengaluru, Karnataka"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cc-founded">Founded year</Label>
                <Input
                  id="cc-founded"
                  type="number"
                  value={form.founded_year}
                  onChange={(e) => set('founded_year', e.target.value)}
                  placeholder="e.g. 2020"
                  min={1800}
                  max={new Date().getFullYear()}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cc-description">Overview / About</Label>
              <Textarea
                id="cc-description"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Describe what your company does, its mission and what makes it unique."
                rows={4}
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cc-specialties">Specialties</Label>
              <Input
                id="cc-specialties"
                value={form.specialties}
                onChange={(e) => set('specialties', e.target.value)}
                placeholder="e.g. Dashboards, Data pipelines, Forecasting"
              />
              <p className="text-xs text-muted-foreground">Separate with commas. Shown as tags in the About tab.</p>
            </div>

            <div className="space-y-2">
              <Label>Cover image</Label>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="h-24 w-full bg-gradient-to-r from-primary/20 to-accent/20">
                  {coverPreview && (
                    <img src={coverPreview} alt="Cover preview" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex items-center gap-2 p-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => pickImage(e, setCoverFile, setCoverPreview, 'Cover image')}
                    className="hidden"
                    id="cc-cover"
                  />
                  <Label
                    htmlFor="cc-cover"
                    className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg cursor-pointer hover:bg-muted transition-colors text-sm font-medium"
                  >
                    <Upload className="w-4 h-4" /> Upload cover
                  </Label>
                  {coverPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCoverFile(null);
                        setCoverPreview('');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground">Max 2MB. 1128×191 recommended.</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => pickImage(e, setLogoFile, setLogoPreview, 'Logo')}
                    className="hidden"
                    id="cc-logo"
                  />
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="cc-logo"
                      className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg cursor-pointer hover:bg-muted transition-colors text-sm font-medium"
                    >
                      <Upload className="w-4 h-4" /> Upload logo
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
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Max 2MB, PNG or JPG. 300×300 recommended.</p>
                </div>
              </div>
            </div>

            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <Checkbox
                checked={agree}
                onCheckedChange={(v) => setAgree(v === true)}
                className="mt-0.5"
              />
              <span>
                I verify that I am an authorised representative of this organisation and have the right
                to act on its behalf in the creation and management of this page.
              </span>
            </label>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => navigate('/companies')} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {loading ? 'Creating…' : 'Create page'}
              </Button>
            </div>
          </form>

          {/* Live preview */}
          <div className="lg:sticky lg:top-24">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Page preview
            </p>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="h-20 bg-gradient-to-r from-primary/20 to-accent/20">
                {coverPreview && (
                  <img src={coverPreview} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="px-4 pb-4">
                <div className="w-16 h-16 -mt-8 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden">
                  {logoPreview ? (
                    <img src={logoPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-7 h-7 text-muted-foreground" />
                  )}
                </div>
                <h3 className="mt-2 font-semibold text-lg text-foreground break-words">{previewName}</h3>
                <p className="text-sm text-muted-foreground break-words">{previewTagline}</p>
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {form.industry && (
                    <div className="flex items-center gap-2 capitalize">
                      <Building2 className="w-4 h-4" /> {form.industry}
                    </div>
                  )}
                  {(form.headquarters || form.location) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> {form.headquarters || form.location}
                    </div>
                  )}
                  {form.employee_count && (
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" /> {form.employee_count} employees
                    </div>
                  )}
                  {form.website && (
                    <div className="flex items-center gap-2 truncate">
                      <Globe className="w-4 h-4 shrink-0" />
                      <span className="truncate">{form.website.replace(/^https?:\/\//, '')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CreateCompany;
