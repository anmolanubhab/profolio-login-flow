import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GraduationCap, Briefcase, Building2, Users, Lightbulb } from 'lucide-react';

export type SignupRole = 'student' | 'employer' | 'company_admin' | 'company_employee' | 'mentor';

interface RoleSelectorProps {
  value: SignupRole;
  onChange: (value: SignupRole) => void;
}

const roles: { value: SignupRole; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'student',
    label: 'Student',
    description: 'Looking for opportunities & learning',
    icon: <GraduationCap className="h-5 w-5" />,
  },
  {
    value: 'employer',
    label: 'Employer',
    description: 'Hiring talent for your team',
    icon: <Briefcase className="h-5 w-5" />,
  },
  {
    value: 'company_admin',
    label: 'Company Admin',
    description: 'Managing a company page',
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    value: 'company_employee',
    label: 'Company Employee',
    description: 'Part of a company team',
    icon: <Users className="h-5 w-5" />,
  },
  {
    value: 'mentor',
    label: 'Mentor',
    description: 'Guiding others in their career',
    icon: <Lightbulb className="h-5 w-5" />,
  },
];

const RoleSelector = ({ value, onChange }: RoleSelectorProps) => {
  return (
    <div className="space-y-3">
      <Label className="text-gray-700 text-sm font-medium">Select Your Role</Label>
      <RadioGroup
        value={value}
        onValueChange={(val) => onChange(val as SignupRole)}
        className="grid grid-cols-1 gap-2"
      >
        {roles.map((role) => (
          <div key={role.value} className="relative">
            <RadioGroupItem
              value={role.value}
              id={role.value}
              className="peer sr-only"
            />
            <Label
              htmlFor={role.value}
              className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200
                border-gray-200 bg-white hover:border-[hsl(211,100%,50%)] hover:bg-[hsl(211,100%,50%,0.05)]
                peer-data-[state=checked]:border-[hsl(211,100%,50%)] peer-data-[state=checked]:bg-[hsl(211,100%,50%,0.08)]
                peer-data-[state=checked]:shadow-sm"
            >
              <div className="flex-shrink-0 text-gray-500 peer-data-[state=checked]:text-[hsl(211,100%,45%)]">
                {role.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{role.label}</p>
                <p className="text-xs text-gray-500 truncate">{role.description}</p>
              </div>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};

export default RoleSelector;
