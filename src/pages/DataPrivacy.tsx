import { useNavigate } from "react-router-dom";
import { HelpCircle, ChevronRight, ArrowLeft, ShieldCheck, Bot, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

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
  const [profileVisibility, setProfileVisibility] = useState(true);
  const [promotions, setPromotions] = useState(true);
  const [recruiterCalls, setRecruiterCalls] = useState(false);
  const [focusedInbox, setFocusedInbox] = useState(true);
  const [readReceipts, setReadReceipts] = useState(false);
  const [msgSuggestions, setMsgSuggestions] = useState(true);
  const [harmfulDetection, setHarmfulDetection] = useState(true);
  const [shieldSrc, setShieldSrc] = useState("/security-2.png");
  const announceFallbacks = ["/announce.png", "/megaphone.png", "https://cdn-icons-png.flaticon.com/512/984/984196.png"];
  const [announceIdx, setAnnounceIdx] = useState(0);

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
        <div className="relative w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-500 rounded-b-3xl py-16 px-8 backdrop-blur-xl bg-white/10 overflow-hidden">
          <span className="absolute -top-6 left-10 h-24 w-24 rounded-full bg-white/20 blur-xl animate-pulse" />
          <span className="absolute top-12 right-24 h-16 w-16 rounded-full bg-white/20 blur-lg animate-pulse" />
          <span className="absolute bottom-6 left-1/3 h-12 w-12 rounded-full bg-white/10 blur-md animate-pulse" />
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
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <div className="flex items-start gap-4">
                <img 
                  src={shieldSrc}
                  onError={() => setShieldSrc("https://www.velodigitalhub.com/wp-content/uploads/2025/05/security-2.png")}
                  alt="Security Shield"
                  className="h-32 w-32 object-contain"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h1 className="text-white text-4xl md:text-5xl font-extrabold">Data Privacy</h1>
                  <p className="text-white/80 text-base md:text-lg mt-2">Your Data. Your Control. Secure by Design.</p>
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur-lg rounded-2xl shadow-xl p-6 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold">Privacy Score</span>
                  <span className="text-white font-bold">82% Secure</span>
                </div>
                <div className="mt-4 h-3 w-full rounded-full bg-white/30 overflow-hidden">
                  <div className="h-full w-[82%] rounded-full bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 animate-pulse" />
                  <span className="absolute left-0 top-[72px] h-3 w-12 bg-white/40 blur-sm animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
            <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg hover:shadow-2xl transition p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center shadow-sm ring-1 ring-amber-200/50">
                    <img
                      src={announceFallbacks[announceIdx]}
                      onError={() => setAnnounceIdx(Math.min(announceIdx + 1, announceFallbacks.length - 1))}
                      alt="Announce"
                      className="h-8 w-8 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Profile Visibility</div>
                    <div className="text-sm text-gray-500">Allow promotional content in your feed</div>
                  </div>
                </div>
                <Switch checked={profileVisibility} onCheckedChange={setProfileVisibility} className={profileVisibility ? "data-[state=checked]:bg-green-500" : ""} />
              </div>
            </div>
            <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg hover:shadow-2xl transition p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-pink-100 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-pink-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Promotions</div>
                    <div className="text-sm text-gray-500">Allow promotional content in your feed</div>
                  </div>
                </div>
                <Switch checked={promotions} onCheckedChange={setPromotions} className={promotions ? "data-[state=checked]:bg-green-500" : ""} />
              </div>
            </div>
            <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg hover:shadow-2xl transition p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <HelpCircle className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Recruiter Calls</div>
                    <div className="text-sm text-gray-500">Allow recruiters to call for opportunities</div>
                  </div>
                </div>
                <Switch checked={recruiterCalls} onCheckedChange={setRecruiterCalls} className={recruiterCalls ? "data-[state=checked]:bg-green-500" : ""} />
              </div>
            </div>
            <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg hover:shadow-2xl transition p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Messaging Experience</div>
                    <div className="text-sm text-gray-500">Focused Inbox, typing indicators</div>
                  </div>
                </div>
                <Switch checked={focusedInbox} onCheckedChange={setFocusedInbox} className={focusedInbox ? "data-[state=checked]:bg-green-500" : ""} />
              </div>
            </div>
            <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg hover:shadow-2xl transition p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Messaging suggestions</div>
                    <div className="text-sm text-gray-500">Allow new email interactions</div>
                  </div>
                </div>
                <Switch checked={msgSuggestions} onCheckedChange={setMsgSuggestions} className={msgSuggestions ? "data-[state=checked]:bg-green-500" : ""} />
              </div>
            </div>
            <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg hover:shadow-2xl transition p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Automated detection of harmful content</div>
                    <div className="text-sm text-gray-500">Messaging suggestions, resolutions</div>
                  </div>
                </div>
                <Switch checked={harmfulDetection} onCheckedChange={setHarmfulDetection} className={harmfulDetection ? "data-[state=checked]:bg-green-500" : ""} />
              </div>
            </div>
          </div>
          <div className="mt-10 relative rounded-2xl p-[2px] overflow-hidden"
               style={{ background: "linear-gradient(135deg, #6A11CB, #2575FC, #00C6FF, #00E676)" }}>
            <div className="absolute inset-0 animate-gradient-shift opacity-40" />
            <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg hover:shadow-2xl transition p-6 relative">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">AI Privacy Advisor</div>
                    <div className="text-sm text-gray-500">We recommend turning OFF read receipts to increase engagement by 12%.</div>
                  </div>
                </div>
                <Button className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white rounded-xl shadow-lg hover:scale-105 transition-all px-6 h-10">
                  Apply Suggestion
                </Button>
              </div>
            </div>
          </div>
          <div className="h-16" />
        </div>
      </div>
    </Layout>
  );
};

export default DataPrivacy;
