import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Search, X, SlidersHorizontal } from 'lucide-react';

interface Company {
  id: string;
  name: string;
}

export interface JobFiltersState {
  search: string;
  companyId: string;
  location: string;
  employmentType: string;
}

interface JobFiltersProps {
  filters: JobFiltersState;
  onFiltersChange: (filters: JobFiltersState) => void;
  locations: string[];
}

const EMPLOYMENT_TYPES = [
  'Full-time',
  'Part-time',
  'Contract',
  'Freelance',
  'Internship',
  'Remote',
];

export const JobFilters = ({ filters, onFiltersChange, locations }: JobFiltersProps) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');
    setCompanies(data || []);
  };

  const handleChange = (key: keyof JobFiltersState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      companyId: '',
      location: '',
      employmentType: '',
    });
  };

  const activeFilterCount = [
    filters.companyId,
    filters.location,
    filters.employmentType,
  ].filter(Boolean).length;

  const uniqueLocations = [...new Set(locations)].filter(Boolean).sort();

  return (
    <div className="space-y-4">
      {/* Search and Filter Toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search jobs by title, company, or keywords..."
            value={filters.search}
            onChange={(e) => handleChange('search', e.target.value)}
            className="pl-10 bg-background/50 border-muted focus:border-primary/50"
          />
        </div>
        <Button
          variant={showFilters || activeFilterCount > 0 ? "default" : "outline"}
          onClick={() => setShowFilters(!showFilters)}
          className="shrink-0"
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2 bg-background/20">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filter Dropdowns */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-muted/30 rounded-lg border">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Company
            </label>
            <Select
              value={filters.companyId}
              onValueChange={(value) => handleChange('companyId', value === 'all' ? '' : value)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="All companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Location
            </label>
            <Select
              value={filters.location}
              onValueChange={(value) => handleChange('location', value === 'all' ? '' : value)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {uniqueLocations.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Employment Type
            </label>
            <Select
              value={filters.employmentType}
              onValueChange={(value) => handleChange('employmentType', value === 'all' ? '' : value)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {EMPLOYMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          
          {filters.companyId && (
            <Badge variant="secondary" className="gap-1">
              {companies.find(c => c.id === filters.companyId)?.name || 'Company'}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => handleChange('companyId', '')}
              />
            </Badge>
          )}
          
          {filters.location && (
            <Badge variant="secondary" className="gap-1">
              {filters.location}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => handleChange('location', '')}
              />
            </Badge>
          )}
          
          {filters.employmentType && (
            <Badge variant="secondary" className="gap-1">
              {filters.employmentType}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => handleChange('employmentType', '')}
              />
            </Badge>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-xs h-6 px-2"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
};
