import { ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export interface PreferenceRowProps {
  label: string;
  subLabel?: string;
  rightValue?: string;
  onClick?: () => void;
  hasArrow?: boolean;
}

export const PreferenceRow = ({ label, subLabel, rightValue, onClick, hasArrow = true }: PreferenceRowProps) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between px-4 py-4 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors"
  >
    <div className="flex flex-col items-start flex-1 mr-4">
      <span className="text-base font-normal text-gray-900 text-left">{label}</span>
      {subLabel && (
        <span className="text-sm text-gray-500 font-normal text-left mt-0.5">{subLabel}</span>
      )}
    </div>
    <div className="flex items-center gap-2">
      {rightValue && (
        <span className="text-sm text-gray-500 font-normal truncate max-w-[150px] sm:max-w-xs">
          {rightValue}
        </span>
      )}
      {hasArrow && <ChevronRight className="h-5 w-5 text-gray-500" strokeWidth={1.5} />}
    </div>
  </button>
);

export interface PreferenceToggleProps {
  label: string;
  subLabel?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const PreferenceToggle = ({ label, subLabel, checked, onCheckedChange, disabled }: PreferenceToggleProps) => (
  <div className="w-full flex items-center justify-between px-4 py-4 bg-white">
    <div className="flex flex-col items-start flex-1 mr-4">
      <span className="text-base font-normal text-gray-900 text-left">{label}</span>
      {subLabel && (
        <span className="text-sm text-gray-500 font-normal text-left mt-0.5">{subLabel}</span>
      )}
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
  </div>
);

export const SectionTitle = ({ title, icon: Icon }: { title: string, icon?: React.ElementType }) => (
  <div className="px-4 py-4 bg-white flex items-center gap-2">
    {Icon && <Icon className="h-5 w-5 text-gray-700" />}
    <h2 className="text-lg font-bold text-gray-900 leading-tight">{title}</h2>
  </div>
);

export const SectionSeparator = () => (
  <div className="h-2 bg-[#F3F2EF] w-full border-t border-b border-gray-200/50" />
);

export interface VisibilitySelectorOption {
  value: string;
  label: string;
  description?: string;
}

export interface VisibilitySelectorProps {
  title: string;
  description?: string;
  value: string;
  options: VisibilitySelectorOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const VisibilitySelector = ({ title, description, value, options, onChange, disabled }: VisibilitySelectorProps) => (
  <div className="bg-white px-4 py-4">
    <div className="mb-4">
      <h3 className="text-base font-medium text-gray-900">{title}</h3>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
    </div>
    <div className="space-y-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => !disabled && onChange(option.value)}
          disabled={disabled}
          className={`w-full text-left p-3 rounded-lg border transition-colors ${
            value === option.value
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-gray-200 hover:bg-gray-50"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium ${value === option.value ? "text-primary" : "text-gray-900"}`}>
                {option.label}
              </p>
              {option.description && (
                <p className="text-sm text-gray-500 mt-0.5">{option.description}</p>
              )}
            </div>
            {value === option.value && (
              <div className="h-4 w-4 rounded-full bg-primary" />
            )}
          </div>
        </button>
      ))}
    </div>
  </div>
);
