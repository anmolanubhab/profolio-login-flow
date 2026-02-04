import { useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface PreferenceRowProps {
  label: string;
  rightValue?: string;
  onClick?: () => void;
  hasArrow?: boolean;
}

const PreferenceRow = ({ label, rightValue, onClick, hasArrow = true }: PreferenceRowProps) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between px-4 py-4 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 last:border-0"
  >
    <span className="text-base font-normal text-gray-900 text-left flex-1">{label}</span>
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

const SectionTitle = ({ title }: { title: string }) => (
  <div className="px-4 py-4 bg-white">
    <h2 className="text-lg font-bold text-gray-900 leading-tight">{title}</h2>
  </div>
);

// This separator acts as the "Section divider with light grey background before section"
// In the AccountPreferences, we used a thin line, but here the requirement says "Section divider with light grey background"
// Looking at the screenshot provided (although I can't see it, I have the text description), 
// usually these apps have a thick grey bar between sections.
// "Light divider line between rows" -> Handled in PreferenceRow border-b
// "Section divider with light grey background before section" -> This component
const SectionDivider = () => (
  <div className="h-2 bg-[#F3F2EF] w-full border-t border-b border-gray-200/50" />
);

const SignInSecurity = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-2 h-[52px]">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" strokeWidth={1.5} />
          </button>
          <h1 className="text-[17px] font-semibold text-gray-900 flex-1 text-left ml-2">
            Sign in & security
          </h1>
          <button
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="h-6 w-6 text-gray-600 fill-gray-600" strokeWidth={0} />
          </button>
        </div>
      </header>

      <div className="flex flex-col pb-8">
        {/* SECTION: Account access */}
        <SectionTitle title="Account access" />
        
        <PreferenceRow 
          label="Email addresses" 
          rightValue={user?.email || "user@email.com"} 
        />
        <PreferenceRow label="Phone numbers" />
        <PreferenceRow label="Change password" />
        <PreferenceRow label="Passkeys" />
        <PreferenceRow label="Where you're signed in" />
        <PreferenceRow label="Devices that remember your password" />
        <PreferenceRow 
          label="Two-factor authentication" 
          rightValue="Off" 
        />
        <PreferenceRow label="App lock" />
      </div>
    </div>
  );
};

export default SignInSecurity;
