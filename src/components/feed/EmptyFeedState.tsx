import { FileText, Users, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyFeedStateProps {
  onCreatePost?: () => void;
}

const EmptyFeedState = ({ onCreatePost }: EmptyFeedStateProps) => {
  return (
    <div className="relative bg-white rounded-[2.5rem] border border-[#E8EBEF]/60 shadow-xl p-12 text-center overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700 group">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
      
      <div className="relative mx-auto w-24 h-24 mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-20 blur-2xl rounded-full animate-pulse" />
        <div className="relative w-full h-full bg-white rounded-[2rem] shadow-lg flex items-center justify-center text-[#833AB4] border border-[#E8EBEF]/50 group-hover:scale-110 transition-transform duration-500">
          <FileText className="w-10 h-10" strokeWidth={2.5} />
        </div>
      </div>
      
      <h3 className="text-3xl font-black text-[#1D2226] mb-4 tracking-tight">
        Your feed is waiting for a voice
      </h3>
      
      <p className="text-[#5E6B7E] font-bold text-lg mb-10 max-w-md mx-auto leading-relaxed">
        Be the first to spark a conversation. Share your perspective, celebrate a milestone, or connect with your network.
      </p>
      
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        {onCreatePost && (
          <Button 
            onClick={onCreatePost} 
            className="h-14 px-8 rounded-2xl gap-3 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white font-black text-lg shadow-lg shadow-[#833AB4]/20 hover:shadow-[#833AB4]/40 hover:scale-105 transition-all duration-300 transform active:scale-95"
          >
            <Sparkles className="w-5 h-5" strokeWidth={2.5} />
            Start a Conversation
          </Button>
        )}
        <Button 
          variant="outline" 
          className="h-14 px-8 rounded-2xl gap-3 border-[#E8EBEF] text-[#5E6B7E] font-black text-lg hover:bg-[#F3F6F8] hover:text-[#1D2226] transition-all duration-300"
        >
          <Users className="w-5 h-5" strokeWidth={2.5} />
          Find Connections
        </Button>
      </div>
      
      <div className="mt-12 pt-8 border-t border-[#E8EBEF]/60">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F3F6F8] text-[#5E6B7E] text-sm font-black uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-gradient-to-r from-[#0077B5] to-[#E1306C] animate-pulse" />
          Pro Tip: Follow industry leaders to fill your feed
        </div>
      </div>
    </div>
  );
};

export default EmptyFeedState;
