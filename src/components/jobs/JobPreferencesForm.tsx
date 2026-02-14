
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, X, Plus } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface JobPreferences {
  roles: string[];
  locations: string[];
  job_type: string[];
  experience_level: string;
}

const DEFAULT_PREFERENCES: JobPreferences = {
  roles: [],
  locations: [],
  job_type: [],
  experience_level: 'mid',
};

const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Remote'];
const EXPERIENCE_LEVELS = [
  { value: 'entry', label: 'Entry Level (0-2 years)' },
  { value: 'mid', label: 'Mid Level (3-5 years)' },
  { value: 'senior', label: 'Senior Level (5+ years)' },
  { value: 'director', label: 'Director / Executive' },
];

export const JobPreferencesForm = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<JobPreferences>(DEFAULT_PREFERENCES);
  const [roleInput, setRoleInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  
  // Ref for debouncing save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (profile?.preferences) {
      const prefs = (profile.preferences as any).job_preferences || DEFAULT_PREFERENCES;
      setPreferences(prefs);
    }
    setLoading(false);
  }, [profile]);

  const savePreferences = async (newPreferences: JobPreferences) => {
    if (!user) return;
    
    setSaving(true);
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save by 1 second
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const currentPreferences = (profile?.preferences as any) || {};
        const updatedPreferences = {
          ...currentPreferences,
          job_preferences: newPreferences
        };

        const { error } = await supabase
          .from('profiles')
          .update({ preferences: updatedPreferences })
          .eq('user_id', user.id);

        if (error) throw error;
        
        // Optimistic update handled by local state, but we could show a subtle saved indicator
        setSaving(false);
        toast({
          title: "Saved",
          description: "Job preferences updated successfully",
        });
      } catch (error) {
        console.error('Error saving preferences:', error);
        setSaving(false);
        toast({
          title: "Error saving preferences",
          description: "Please check your internet connection.",
          variant: "destructive",
        });
      }
    }, 1000);
  };

  const handleUpdate = (updates: Partial<JobPreferences>) => {
    const newPreferences = { ...preferences, ...updates };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };

  const addRole = () => {
    if (roleInput.trim() && !preferences.roles.includes(roleInput.trim())) {
      const newRoles = [...preferences.roles, roleInput.trim()];
      handleUpdate({ roles: newRoles });
      setRoleInput('');
    }
  };

  const removeRole = (role: string) => {
    const newRoles = preferences.roles.filter(r => r !== role);
    handleUpdate({ roles: newRoles });
  };

  const addLocation = () => {
    if (locationInput.trim() && !preferences.locations.includes(locationInput.trim())) {
      const newLocations = [...preferences.locations, locationInput.trim()];
      handleUpdate({ locations: newLocations });
      setLocationInput('');
    }
  };

  const removeLocation = (location: string) => {
    const newLocations = preferences.locations.filter(l => l !== location);
    handleUpdate({ locations: newLocations });
  };

  const toggleJobType = (type: string) => {
    const newTypes = preferences.job_type.includes(type)
      ? preferences.job_type.filter(t => t !== type)
      : [...preferences.job_type, type];
    handleUpdate({ job_type: newTypes });
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 bg-white shadow-none sm:shadow-card overflow-hidden">
        <CardHeader className="px-4 py-6 sm:px-8 sm:pt-8 sm:pb-4">
          <CardTitle>Job Preferences</CardTitle>
          <CardDescription>
            Customize your job feed and alerts. These settings help us find the right opportunities for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 py-6 sm:px-8 sm:pb-8 space-y-8">
          
          {/* Roles */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Desired Job Titles</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Frontend Developer"
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRole()}
              />
              <Button onClick={addRole} variant="secondary" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[2.5rem]">
              {preferences.roles.length === 0 && (
                <span className="text-sm text-muted-foreground italic self-center">No roles added yet</span>
              )}
              {preferences.roles.map((role) => (
                <Badge key={role} variant="secondary" className="px-3 py-1 text-sm flex items-center gap-2">
                  {role}
                  <button onClick={() => removeRole(role)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Locations */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Preferred Locations</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. New York, Remote"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLocation()}
              />
              <Button onClick={addLocation} variant="secondary" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[2.5rem]">
              {preferences.locations.length === 0 && (
                <span className="text-sm text-muted-foreground italic self-center">No locations added yet</span>
              )}
              {preferences.locations.map((location) => (
                <Badge key={location} variant="secondary" className="px-3 py-1 text-sm flex items-center gap-2">
                  {location}
                  <button onClick={() => removeLocation(location)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Job Type */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Job Type</Label>
            <div className="flex flex-wrap gap-2">
              {JOB_TYPES.map((type) => {
                const isSelected = preferences.job_type.includes(type);
                return (
                  <Button
                    key={type}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleJobType(type)}
                    className="rounded-full"
                  >
                    {type}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Experience Level */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Experience Level</Label>
            <RadioGroup
              value={preferences.experience_level}
              onValueChange={(val) => handleUpdate({ experience_level: val })}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {EXPERIENCE_LEVELS.map((level) => (
                <div key={level.value} className="flex items-center space-x-2 border p-3 rounded-md hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => handleUpdate({ experience_level: level.value })}>
                  <RadioGroupItem value={level.value} id={level.value} />
                  <Label htmlFor={level.value} className="cursor-pointer font-normal">{level.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="pt-4 flex items-center justify-between">
             <span className="text-sm text-muted-foreground">
               {saving ? "Saving..." : "All changes saved automatically"}
             </span>
          </div>

        </CardContent>
      </Card>
    </div>
  );
};
