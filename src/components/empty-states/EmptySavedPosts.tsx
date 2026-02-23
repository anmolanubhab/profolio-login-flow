import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";

const EmptySavedPosts = () => {
  const navigate = useNavigate();

  const handleExplore = () => {
    navigate("/feed");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="max-w-sm w-full mx-auto space-y-6">
        <div className="mx-auto w-full max-w-[220px]">
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-red-500 via-yellow-400 to-purple-600 opacity-20 blur-2xl" />
            <div className="relative rounded-3xl bg-white shadow-lg shadow-purple-200/40 border border-white/60 p-6 animate-float-soft">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-red-500 via-yellow-400 to-purple-600 text-white shadow-lg shadow-purple-200/40">
                <Bookmark className="h-8 w-8" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-2.5 w-3/4 mx-auto rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-purple-600 opacity-70" />
                <div className="h-2 w-1/2 mx-auto rounded-full bg-slate-200/80" />
                <div className="h-2 w-2/3 mx-auto rounded-full bg-slate-100" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-[#1D2226]">
            No saved posts yet
          </h2>
          <p className="text-sm sm:text-base text-[#5E6B7E] max-w-md mx-auto">
            Save posts to revisit important career tips, jobs, and learning resources anytime.
          </p>
        </div>

        <div className="w-full max-w-xs mx-auto space-y-2">
          <Button
            aria-label="Explore feed to find posts to save"
            className="w-full h-11 sm:h-12 rounded-xl bg-gradient-to-r from-red-500 via-yellow-400 to-purple-600 text-white font-semibold shadow-lg shadow-purple-200/40 hover:shadow-xl hover:scale-105 active:scale-95 transition-transform transition-shadow duration-200 border-0"
            onClick={handleExplore}
          >
            Explore Feed
          </Button>
          <p className="text-[11px] sm:text-xs text-[#5E6B7E]">
            Start building your personalized learning library today.
          </p>
        </div>
      </div>
    </div>
  );
};

export default memo(EmptySavedPosts);

