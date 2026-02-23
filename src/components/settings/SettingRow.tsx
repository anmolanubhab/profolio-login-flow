import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface SettingRowProps {
  icon: ReactNode;
  title: string;
  value?: string;
  onClick?: () => void;
}

export default function SettingRow({
  icon,
  title,
  value,
  onClick,
}: SettingRowProps) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between py-4 px-4 hover:bg-white/40 transition-all duration-200 cursor-pointer border-b border-white/30"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 flex items-center justify-center bg-white/50 backdrop-blur-md border border-white/30 rounded-xl shadow-sm">
          {icon}
        </div>
        <span className="font-medium text-gray-800 text-sm sm:text-base">
          {title}
        </span>
      </div>
      <div className="flex items-center gap-3 text-gray-600 text-sm sm:text-base">
        {value && <span className="text-sm">{value}</span>}
        <ChevronRight size={18} />
      </div>
    </div>
  );
}

