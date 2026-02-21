import { useNavigate } from "react-router-dom";
import { HelpCircle, ChevronRight, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

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

  const handleNotImplemented = (feature: string) => {
    toast({
      title: "Coming Soon",
      description: `${feature} will be available soon.`,
    });
  };

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div
        className="min-h-screen"
        style={{ background: "radial-gradient(circle at top left, #c7d2fe, #e9d5ff, #bfdbfe)" }}
      >
        {/* Hero */}
        <div className="relative w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-500 rounded-b-3xl py-16 px-8 backdrop-blur-xl bg-white/10 overflow-hidden">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <Button
                  variant="ghost"
                  className="bg-white rounded-full shadow-md hover:bg-indigo-50 hover:scale-105 transition h-9 px-4"
                  onClick={() => navigate('/settings')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2 text-indigo-600" />
                  Back
                </Button>
                <h1 className="text-white text-3xl md:text-5xl font-extrabold tracking-tight mt-4">
                  Advertising data
                </h1>
              </div>
            </div>
          </div>
        </div>

      <div className="flex flex-col pb-8 max-w-6xl mx-auto px-6">
        <div className="px-6 py-4 bg-white/70 backdrop-blur-md rounded-2xl shadow-lg mb-6">
          <p className="text-sm text-gray-700">
            These settings are currently for display purposes only. Advertising features are not yet active in this version of Profolio.
          </p>
        </div>

        {/* SECTION 1: Profile data */}
        <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden">
          <SectionTitle title="Profile data" />
          <PreferenceRow label="Connections" rightValue="On" />
          <PreferenceRow label="Companies you follow" rightValue="On" />
          <PreferenceRow label="Groups" rightValue="On" />
          <PreferenceRow label="Education and skills" rightValue="Schools & more" />
          <PreferenceRow label="Job information" rightValue="Current job & more" />
          <PreferenceRow label="Employer" rightValue="Current company & more" />
          <PreferenceRow label="Customized display format" rightValue="On" />
          <PreferenceRow label="Profile location" rightValue="On" />
        </div>

        <SectionSeparator />

        {/* SECTION 2: Activity and inferred data */}
        <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden">
          <SectionTitle title="Activity and inferred data" />
          <PreferenceRow label="Inferred city location" rightValue="On" />
          <PreferenceRow label="Interests and traits" />
          <PreferenceRow label="Age range" rightValue="On" />
          <PreferenceRow label="Gender" rightValue="On" />
        </div>

        <SectionSeparator />

        {/* SECTION 3: Off platform data */}
        <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden">
          <SectionTitle title="Off platform data" />
          <PreferenceRow label="Ads off Profolio" rightValue="On" />
        </div>
        <PreferenceRow label="Data from others for ads" rightValue="On" />
        <PreferenceRow label="Measure ad success" rightValue="On" />
        <PreferenceRow label="Share data with affiliates and partners" rightValue="On" />
      </div>
    </div>
    </Layout>
  );
};

export default AdvertisingData;
