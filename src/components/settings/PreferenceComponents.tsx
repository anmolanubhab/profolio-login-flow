import { ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export interface PreferenceRowProps {
  label: string;
  subLabel?: string;
  rightValue?: string;
  onClick?: () => void;
  hasArrow?: boolean;
  isSaving?: boolean;
}

export const PreferenceRow = ({ label, subLabel, rightValue, onClick, hasArrow = true, isSaving }: PreferenceRowProps) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between px-4 sm:px-8 py-4 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 last:border-0"
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
      {isSaving && (
        <span className="h-4 w-4 inline-block animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
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
  isSaving?: boolean;
}

export const PreferenceToggle = ({ label, subLabel, checked, onCheckedChange, disabled, isSaving }: PreferenceToggleProps) => (
  <div className="w-full flex items-center justify-between px-4 sm:px-8 py-4 bg-white border-b border-gray-100">
    <div className="flex flex-col items-start flex-1 mr-4">
      <span className="text-base font-normal text-gray-900 text-left">{label}</span>
      {subLabel && (
        <span className="text-sm text-gray-500 font-normal text-left mt-0.5">{subLabel}</span>
      )}
    </div>
    <div className="flex items-center gap-2">
      {isSaving && (
        <span className="h-4 w-4 inline-block animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
      )}
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  </div>
);

export const SectionTitle = ({ title, icon: Icon }: { title: string, icon?: React.ElementType }) => (
  <div className="px-4 sm:px-8 py-4 bg-white flex items-center gap-2 border-b border-gray-100">
    {Icon && <Icon className="h-5 w-5 text-gray-700" />}
    <h2 className="text-lg font-bold text-gray-900 leading-tight">{title}</h2>
  </div>
);

export const SectionSeparator = () => (
  <div className="h-2 bg-[#F3F2EF] w-full border-t border-b border-gray-200/50" />
);
