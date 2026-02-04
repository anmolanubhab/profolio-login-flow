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
    <div className="flex items-center gap-2 flex-1 pr-4">
      <span className="text-base font-normal text-gray-900 text-left">{label}</span>
    </div>
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

const AdvertisingData = () => {
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
            Advertising data
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
        {/* SECTION 1: Profile data */}
        <SectionTitle title="Profile data" />
        <PreferenceRow label="Connections" rightValue="On" />
        <PreferenceRow label="Companies you follow" rightValue="On" />
        <PreferenceRow label="Groups" rightValue="On" />
        <PreferenceRow label="Education and skills" rightValue="Schools & more" />
        <PreferenceRow label="Job information" rightValue="Current job & more" />
        <PreferenceRow label="Employer" rightValue="Current company & more" />
        <PreferenceRow label="Customized display format" rightValue="On" />
        <PreferenceRow label="Profile location" rightValue="On" />

        <SectionSeparator />

        {/* SECTION 2: Activity and inferred data */}
        <SectionTitle title="Activity and inferred data" />
        <PreferenceRow label="Inferred city location" rightValue="On" />
        <PreferenceRow label="Interests and traits" />
        <PreferenceRow label="Age range" rightValue="On" />
        <PreferenceRow label="Gender" rightValue="On" />

        <SectionSeparator />

        {/* SECTION 3: Off platform data */}
        <SectionTitle title="Off platform data" />
        <PreferenceRow label="Ads off Profolio" rightValue="On" />
        <PreferenceRow label="Data from others for ads" rightValue="On" />
        <PreferenceRow label="Measure ad success" rightValue="On" />
        <PreferenceRow label="Share data with affiliates and partners" rightValue="On" />
      </div>
    </div>
  );
};

export default AdvertisingData;
