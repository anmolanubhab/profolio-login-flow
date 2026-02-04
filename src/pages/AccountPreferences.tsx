import { useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface PreferenceRowProps {
  label: string;
  rightValue?: string;
  onClick?: () => void;
  hasArrow?: boolean;
}

const PreferenceRow = ({ label, rightValue, onClick, hasArrow = true }: PreferenceRowProps) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between px-4 py-4 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors"
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

const SectionSeparator = () => (
  <div className="h-2 bg-[#F3F2EF] w-full border-t border-b border-gray-200/50" />
);

const AccountPreferences = () => {
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
            Account preferences
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
        {/* SECTION 1: Profile information */}
        <SectionTitle title="Profile information" />
        <PreferenceRow label="Name, location, and industry" />
        <PreferenceRow label="Personal demographic information" />
        <PreferenceRow label="Verifications" />

        <SectionSeparator />

        {/* SECTION 2: Display */}
        <SectionTitle title="Display" />
        <PreferenceRow label="Dark mode" />

        <SectionSeparator />

        {/* SECTION 3: General preferences */}
        <SectionTitle title="General preferences" />
        <PreferenceRow label="Language" />
        <PreferenceRow label="Content language" />
        <PreferenceRow label="Autoplay videos" rightValue="On Mobile Data and Wi-Fi" />
        <PreferenceRow label="Sound effects" rightValue="On" />
        <PreferenceRow label="Showing profile photos" rightValue="All members" />

        <SectionSeparator />

        {/* SECTION 4: Other preferences (no title continuation) */}
        {/* The prompt implies these follow the previous section but without a title, 
            or maybe they are just part of the list but separated. 
            Based on Profolio UI, these usually appear after a divider but without a header if they are loose items.
        */}
        <div className="pt-2"></div> 
        {/* Actually, looking at the screenshots, "People you unfollowed" is just a row. 
           But the prompt says "SECTION 4". I will put a separator before it as requested by "Light grey section separators".
        */}
        <PreferenceRow label="People you unfollowed" />
        <PreferenceRow label="Open web links in app" />

        <SectionSeparator />

        {/* SECTION 5: Syncing options */}
        <SectionTitle title="Syncing options" />
        <PreferenceRow label="Sync contacts" />

        <SectionSeparator />

        {/* SECTION 6: Subscriptions & payments */}
        <SectionTitle title="Subscriptions & payments" />
        <PreferenceRow label="Upgrade for Free" />
        <PreferenceRow label="View purchase history" />

        <SectionSeparator />

        {/* SECTION 7: Partners & services */}
        <SectionTitle title="Partners & services" />
        <PreferenceRow label="ITLam Software Company Pvt. Ltd." />

        <SectionSeparator />

        {/* SECTION 8: Account management */}
        <SectionTitle title="Account management" />
        <PreferenceRow label="Hibernate account" />
        <PreferenceRow label="Close and delete account" />
      </div>
    </div>
  );
};

export default AccountPreferences;
