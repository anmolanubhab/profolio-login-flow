import { useState } from 'react';
import { 
  Edit3, Share2, Shield, MapPin, CheckCircle, Briefcase, 
  Download, UserPlus, MessageSquare, Award, Globe, Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ProfileHeroProps {
  profile: any;
  isOwnProfile: boolean;
  onEdit: () => void;
  skillsCount?: number;
}

export const ProfileHero = ({ profile, isOwnProfile, onEdit, skillsCount = 0 }: ProfileHeroProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate real stats
  const experienceCount = Array.isArray(profile?.experience) ? profile.experience.length : 0;
  
  const formatAvailability = (status: string) => {
    if (!status) return 'Not Set';
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const availabilityStatus = formatAvailability(profile?.availability_status);
  const isAvailable = ['Open To Work', 'Open To Networking', 'Hiring'].includes(availabilityStatus);

  const stats = [
    { label: "Roles", value: experienceCount.toString(), icon: Briefcase },
    { label: "Skills", value: skillsCount.toString(), icon: Award },
    { label: "Availability", value: availabilityStatus, icon: CheckCircle, color: isAvailable ? "text-green-600" : "text-gray-400" },
  ];

  const coverUrl = profile?.cover_url;
  const avatarUrl = profile?.avatar_url;
  const displayName = profile?.display_name || 'User Name';
  const profession = profile?.profession || 'Professional Role';
  const location = profile?.location || 'Location';
  const bio = profile?.bio || '';

  return (
    <div className="w-full bg-white mb-0">
      {/* 1. Edge-to-Edge Cover Section */}
      <div className="relative h-32 md:h-48 w-full group overflow-hidden">
        <div className={`absolute inset-0 ${coverUrl ? '' : 'bg-gradient-to-r from-[#0077b5] to-[#00a0dc]'}`}>
          {coverUrl && (
            <img 
              src={coverUrl} 
              alt="Cover" 
              className="w-full h-full object-cover"
            />
          )}
          {/* Subtle overlay */}
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>

        {/* Floating Quick Actions */}
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          {isOwnProfile ? (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-sm" onClick={onEdit}>
                      <Edit3 className="h-4 w-4 text-gray-700" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit Profile</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-sm">
                      <Shield className="h-4 w-4 text-gray-700" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Privacy Settings</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : (
            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-sm">
              <Share2 className="h-4 w-4 text-gray-700" />
            </Button>
          )}
        </div>
      </div>

      {/* Profile Content */}
      <div className="px-4 md:px-6 pb-6 relative max-w-4xl mx-auto">
        {/* Avatar - Overlapping Cover */}
        <div className="relative -mt-12 mb-3">
          <div className="inline-block relative">
            <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-white shadow-xl bg-white">
              <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" referrerPolicy="no-referrer" />
              <AvatarFallback className="text-2xl md:text-4xl bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 font-bold">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {/* Online Status Indicator */}
            <div className="absolute bottom-1 right-1 md:bottom-2 md:right-2 bg-green-500 h-3.5 w-3.5 md:h-4 md:w-4 rounded-full border-2 border-white" title="Online" />
          </div>
        </div>

        {/* Identity Block */}
        <div className="flex flex-col gap-1 mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
              {displayName}
            </h1>
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-transparent gap-1 rounded-md px-1.5 py-0 h-5">
              <CheckCircle className="h-3 w-3 fill-blue-500 text-white" />
              <span className="text-[10px] font-bold tracking-wide uppercase">Verified</span>
            </Badge>
          </div>
          
          <p className="text-base md:text-lg text-gray-900 font-medium leading-snug">
            {profession}
          </p>
          
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 mt-1">
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-gray-400" />
              <span>{location}</span>
            </div>
            <span className="text-gray-300 hidden md:inline">•</span>
            <div className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-gray-400" />
              <span>Open to remote</span>
            </div>
            <span className="text-gray-300 hidden md:inline">•</span>
            <div className="flex items-center gap-1 text-blue-600 font-medium cursor-pointer hover:underline">
              <Globe className="h-3.5 w-3.5" />
              <span>Contact info</span>
            </div>
          </div>
        </div>

        {/* Primary Action Button (Rainbow Gradient) */}
        <div className="mb-6">
          {isOwnProfile ? (
            <Button 
              className="w-full md:max-w-md h-10 rounded-full font-semibold shadow-sm text-white border-none transition-all hover:opacity-90 active:scale-[0.98] bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]"
            >
              Open to Opportunities
            </Button>
          ) : (
            <div className="flex gap-3 w-full md:max-w-md">
              <Button className="flex-1 rounded-full font-semibold text-white border-none transition-all hover:opacity-90 active:scale-[0.98] bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]">
                <UserPlus className="h-4 w-4 mr-2" />
                Connect
              </Button>
              <Button variant="outline" className="flex-1 rounded-full font-semibold relative p-[1px] overflow-hidden group border-none">
                <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
                <div className="flex items-center justify-center w-full h-full bg-white rounded-full relative z-10 px-4 py-2 text-[#1D2226] group-hover:bg-gray-50 transition-colors">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Message
                </div>
              </Button>
              <Button variant="outline" size="icon" className="rounded-full border-gray-300 text-gray-600 hover:bg-gray-50 shrink-0">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Inline Stats Dashboard */}
        <div className="flex items-center justify-between md:justify-start md:gap-12 py-4 border-t border-b border-gray-100 mb-6">
          {stats.map((stat, i) => (
            <div key={i} className="flex flex-col items-start md:flex-row md:items-center gap-1 md:gap-2">
              <div className="flex items-center gap-1.5">
                <stat.icon className={`h-4 w-4 ${stat.color || 'text-gray-400'}`} />
                <span className="text-sm font-semibold text-gray-900">{stat.value}</span>
              </div>
              <span className="text-xs text-gray-500 font-medium">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* About Section (Clean Text) */}
        {bio && (
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">About</h3>
            <div className="relative">
              <p className={`text-sm text-gray-600 leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
                {bio}
              </p>
              {bio.length > 150 && (
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-sm font-medium text-gray-500 hover:text-gray-900 mt-1 focus:outline-none underline decoration-dotted underline-offset-4"
                >
                  {isExpanded ? 'Show less' : '...more'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
