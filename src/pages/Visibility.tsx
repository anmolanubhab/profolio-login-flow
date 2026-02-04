import { useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle, ChevronRight } from "lucide-react";

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
    <span className="text-base font-normal text-gray-900 text-left flex-1 pr-4">{label}</span>
    <div className="flex items-center gap-2 shrink-0">
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

const SectionSeparator = () => (
  <div className="h-2 bg-[#F3F2EF] w-full border-t border-b border-gray-200/50" />
);

const Visibility = () => {
  const navigate = useNavigate();

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
            Visibility
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
        {/* SECTION 1: Visibility of your profile & network */}
        <SectionTitle title="Visibility of your profile & network" />
        
        <PreferenceRow 
          label="Profile viewing options" 
          rightValue="Your name and headline" 
        />
        <PreferenceRow 
          label="Page visit visibility" 
          rightValue="On" 
        />
        <PreferenceRow label="Edit your public profile" />
        <PreferenceRow label="Who can see or download your email address" />
        <PreferenceRow 
          label="Who can see your connections" 
          rightValue="On" 
        />
        <PreferenceRow 
          label="Who can see members you follow" 
          rightValue="Anyone on Profolio" 
        />
        <PreferenceRow label="Who can see your last name" />
        <PreferenceRow 
          label="Representing your organizations and interests" 
          rightValue="On" 
        />
        <PreferenceRow 
          label="Page owners exporting your data" 
          rightValue="Off" 
        />
        <PreferenceRow label="Profile discovery and visibility off Profolio" />
        <PreferenceRow 
          label="Profile discovery using email address" 
          rightValue="Anyone" 
        />
        <PreferenceRow 
          label="Profile discovery using phone number" 
          rightValue="Everyone" 
        />
        <PreferenceRow label="Blocked members" />

        <SectionSeparator />

        {/* SECTION 2: Visibility of your activity */}
        <SectionTitle title="Visibility of your activity" />
        
        <PreferenceRow 
          label="Manage active status" 
          rightValue="Your connections" 
        />
        <PreferenceRow 
          label="Share job changes, education changes, and work anniversaries from profile" 
          rightValue="On" 
        />
        <PreferenceRow 
          label="Notify connections when you're in the news" 
          rightValue="On" 
        />
        <PreferenceRow 
          label="Mentioned by others" 
          rightValue="On" 
        />
        <PreferenceRow label="Followers" />
      </div>
    </div>
  );
};

export default Visibility;
