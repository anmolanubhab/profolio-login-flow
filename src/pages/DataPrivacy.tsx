import { useNavigate } from "react-router-dom";
import { HelpCircle, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";

interface PreferenceRowProps {
  label: string;
  rightValue?: string;
  onClick?: () => void;
  hasArrow?: boolean;
  badge?: string;
}

const PreferenceRow = ({ label, rightValue, onClick, hasArrow = true, badge }: PreferenceRowProps) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between px-4 py-4 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 last:border-0"
  >
    <div className="flex items-center gap-2 flex-1 pr-4">
      <span className="text-base font-normal text-gray-900 text-left">{label}</span>
      {badge && (
        <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-[3px] uppercase tracking-wide">
          {badge}
        </span>
      )}
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

const DataPrivacy = () => {
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
      <div className="bg-background min-h-screen pt-4">
        {/* Title */}
        <div className="px-4 pb-4">
          <h1 className="text-2xl font-semibold text-foreground">
            Data privacy
          </h1>
        </div>

      <div className="flex flex-col pb-8">
        <div className="px-4 py-4 bg-blue-50 border-b border-blue-100">
          <p className="text-sm text-blue-800">
            Some privacy features are currently in development. Settings shown below may not yet be fully active.
          </p>
        </div>

        {/* TOP OPTIONS */}
        <PreferenceRow label="Profolio promotions" />
        <PreferenceRow label="Recruiter calls" badge="BETA" />

        <SectionSeparator />

        {/* SECTION 1: Messaging experience */}
        <SectionTitle title="Messaging experience" />
        <PreferenceRow label="Focused Inbox" rightValue="On" />
        <PreferenceRow label="Read receipts and typing indicators" />
        <PreferenceRow label="Messaging suggestions" rightValue="On" />
        <PreferenceRow label="Message nudges" rightValue="On" />
        <PreferenceRow label="Automated detection of harmful content" rightValue="On" />

        <SectionSeparator />

        {/* SECTION 2: Job seeking preferences */}
        <SectionTitle title="Job seeking preferences" />
        <PreferenceRow label="Job application settings" />
        <PreferenceRow 
          label="Share your profile when you click Apply for a job" 
          rightValue="Off" 
        />
        <PreferenceRow 
          label="Signal your interest to recruiters at companies you've created job alerts for" 
          rightValue="Off" 
        />
        <PreferenceRow label="Stored job applicant accounts" />

        <SectionSeparator />

        {/* SECTION 3: Other applications */}
        <SectionTitle title="Other applications" />
        <PreferenceRow label="Permitted services" />
        <PreferenceRow label="Microsoft Word" rightValue="On" />

        <SectionSeparator />

        {/* SECTION 4: How we use your data */}
        <SectionTitle title="How Profolio uses your data" />
        <PreferenceRow label="Manage your data and activity" />
        <PreferenceRow label="Get a copy of your data" />
        <PreferenceRow label="Search history" />
        <PreferenceRow label="Personal demographic information" />
        <PreferenceRow label="Social, economic, and workplace research" rightValue="On" />
        <PreferenceRow label="Data for Generative AI Improvement" rightValue="On" />

        <SectionSeparator />

        {/* SECTION 5: Who can reach you */}
        <SectionTitle title="Who can reach you" />
        <PreferenceRow label="Invitations to connect" />
        <PreferenceRow label="Invitations from your network" />
        <PreferenceRow label="Messages" />
        <PreferenceRow label="Research invites" rightValue="On" />
      </div>
    </div>
    </Layout>
  );
};

export default DataPrivacy;
