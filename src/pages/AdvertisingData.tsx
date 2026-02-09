import { useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
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
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const { toast } = useToast();

  const handleBack = () => {
    navigate(-1);
  };

  const handleNotImplemented = (feature: string) => {
    toast({
      title: "Coming Soon",
      description: `${feature} will be available soon.`,
    });
  };

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="bg-background min-h-screen">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4 border-b border-border">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 hover:bg-muted/50 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>
          <h1 className="text-2xl font-semibold text-foreground">
            Advertising data
          </h1>
          <div className="flex-1" />
          <button
            className="p-2 -mr-2 hover:bg-muted/50 rounded-full transition-colors"
            aria-label="Help"
            onClick={() => handleNotImplemented("Help Center")}
          >
            <HelpCircle className="h-6 w-6 text-foreground fill-foreground" />
          </button>
        </div>

      <div className="flex flex-col pb-8">
        <div className="px-4 py-4 bg-blue-50 border-b border-blue-100">
          <p className="text-sm text-blue-800">
            These settings are currently for display purposes only. Advertising features are not yet active in this version of Profolio.
          </p>
        </div>

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
    </Layout>
  );
};

export default AdvertisingData;
