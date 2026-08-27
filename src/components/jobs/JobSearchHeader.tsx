import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin } from 'lucide-react';

interface JobSearchHeaderProps {
  keyword: string;
  location: string;
  onSearch: (keyword: string, location: string) => void;
}

/** The prominent "what job / where" search bar -- title/skill/company keyword plus a separate location field. */
export function JobSearchHeader({ keyword, location, onSearch }: JobSearchHeaderProps) {
  const [keywordInput, setKeywordInput] = useState(keyword);
  const [locationInput, setLocationInput] = useState(location);

  const submit = () => onSearch(keywordInput.trim(), locationInput.trim());

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit();
  };

  return (
    <div className="rounded-xl border bg-card shadow-card p-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative min-w-0 sm:flex-[3]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="What job do you want?"
            title="Search by title, skill, or company"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9 h-11 w-full"
          />
        </div>
        <div className="relative min-w-0 sm:flex-[2]">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Location"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9 h-11 w-full"
          />
        </div>
        <Button className="h-11 shrink-0 sm:px-8" onClick={submit}>
          Search
        </Button>
      </div>
    </div>
  );
}
