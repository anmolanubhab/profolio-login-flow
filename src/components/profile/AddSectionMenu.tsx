import { Plus, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { jumpToProfileSection, type ProfileSectionKey } from "@/lib/profileNav";

interface AddSectionMenuProps {
  /** open the Edit-profile dialog (About lives in the header for now) */
  onEditAbout: () => void;
}

const IMPLEMENTED = [
  { key: "experience", label: "Experience" },
  { key: "education", label: "Education" },
  { key: "skills", label: "Skills" },
  { key: "certifications", label: "Licenses & certifications" },
  { key: "projects", label: "Projects" },
  { key: "languages", label: "Languages" },
] as const;

// Not yet built — clearly flagged rather than shown as working.
const COMING_SOON = [
  "Courses",
  "Publications",
  "Honors & awards",
  "Volunteer experience",
  "Organizations",
] as const;

const jumpToSection = (key: string) => jumpToProfileSection(key as ProfileSectionKey);

export const AddSectionMenu = ({ onEditAbout }: AddSectionMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add section
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Add to your profile</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onEditAbout}>About</DropdownMenuItem>
        {IMPLEMENTED.map((s) => (
          <DropdownMenuItem key={s.key} onSelect={() => jumpToSection(s.key)}>
            {s.label}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground">
          Coming in the next phase
        </DropdownMenuLabel>
        {COMING_SOON.map((label) => (
          <DropdownMenuItem
            key={label}
            disabled
            className="flex items-center justify-between"
          >
            <span>{label}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              Soon
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AddSectionMenu;
