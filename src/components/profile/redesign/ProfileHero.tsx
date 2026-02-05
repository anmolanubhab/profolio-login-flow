import { useState } from 'react';
import { 
  Edit3, Share2, Shield, MapPin, CheckCircle, Briefcase, 
  Download, Plus, Mail, Eye, Award, Globe, Building2, UserPlus, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
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
    { label: "Availability", value: availabilityStatus, icon: CheckCircle, color: isAvailable ? "text-green-500" : "text-gray-500" },
  ];

  const coverUrl = profile?.cover_url; // Assuming we might add this later
  const avatarUrl = profile?.avatar_url;
  const displayName = profile?.display_name || 'User Name';
  const profession = profile?.profession || 'Professional Role';
  const location = profile?.location || 'Location';
  const bio = profile?.bio || '';

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
      {/* 1. Smart Cover Section */}
      <div className="relative h-48 md:h-60 w-full group">
        <div className={`absolute inset-0 ${coverUrl ? '' : 'bg-gradient-to-r from-[#0077b5] to-[#00a0dc]'}`}>
          {coverUrl && (
            <img 
              src={coverUrl} 
              alt="Cover" 
              className="w-full h-full object-cover"
            />
          )}
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>

        {/* Floating Quick Actions */}
        <div className="absolute top-4 right-4 flex gap-2">
          {isOwnProfile ? (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-sm" onClick={onEdit}>
                      <Edit3 className="h-4 w-4 text-gray-700" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit Profile</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-sm">
                      <Shield className="h-4 w-4 text-gray-700" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Privacy Settings</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : (
            <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-sm">
              <Share2 className="h-4 w-4 text-gray-700" />
            </Button>
          )}
        </div>
      </div>

      {/* Profile Content Container */}
      <div className="px-6 pb-6 relative">
        {/* Avatar */}
        <div className="relative -mt-16 mb-4 flex justify-between items-end">
          <div className="relative">
            <Avatar className="h-32 w-32 border-4 border-white shadow-lg ring-1 ring-gray-100/50">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600">
                {displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute bottom-2 right-2 bg-green-500 h-4 w-4 rounded-full border-2 border-white shadow-sm" title="Online" />
          </div>
          
          {/* Desktop CTAs */}
          <div className="hidden md:flex gap-3 mb-2">
            {isOwnProfile ? (
               <Button className="rounded-full font-semibold shadow-sm bg-[#0a66c2] hover:bg-[#004182]">
                 Open to Opportunities
               </Button>
            ) : (
              <>
                <Button className="rounded-full font-semibold bg-[#0a66c2] hover:bg-[#004182]">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Connect
                </Button>
                <Button variant="outline" className="rounded-full font-semibold border-gray-300 text-gray-600 hover:bg-gray-50">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Message
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="rounded-full text-gray-500 hover:bg-gray-100">
              <Download className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* 2. Identity Block */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
                {displayName}
              </h1>
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100 gap-1 rounded-md px-2 py-0.5">
                <CheckCircle className="h-3 w-3 fill-blue-500 text-white" />
                <span className="text-[10px] font-bold tracking-wide uppercase">Verified</span>
              </Badge>
            </div>
            
            <p className="text-lg text-gray-700 font-medium mb-2 max-w-2xl">
              {profession}
            </p>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>{location}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-gray-400" />
                <span>Open to remote</span>
              </div>
              <div className="flex items-center gap-1.5 text-blue-600 font-medium cursor-pointer hover:underline">
                <Globe className="h-4 w-4" />
                <span>Contact info</span>
              </div>
            </div>
          </div>

          {/* Mobile CTAs */}
          <div className="flex md:hidden flex-col gap-3 mt-4">
            {isOwnProfile ? (
               <Button className="w-full rounded-full font-semibold shadow-sm bg-[#0a66c2] hover:bg-[#004182]">
                 Open to Opportunities
               </Button>
            ) : (
              <div className="flex gap-3">
                <Button className="flex-1 rounded-full font-semibold bg-[#0a66c2] hover:bg-[#004182]">
                  Connect
                </Button>
                <Button variant="outline" className="flex-1 rounded-full font-semibold">
                  Message
                </Button>
                <Button variant="outline" size="icon" className="rounded-full">
                  <Download className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>

          <Separator className="my-6 bg-gray-100" />

          {/* 3. Professional Snapshot */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map((stat, i) => (
              <div key={i} className="bg-gray-50/80 p-3 rounded-xl border border-gray-100 flex flex-col items-center justify-center text-center transition-colors hover:bg-gray-100 hover:border-gray-200">
                <stat.icon className={`h-5 w-5 mb-1 ${stat.color || 'text-gray-500'}`} />
                <span className="text-sm font-semibold text-gray-900">{stat.value}</span>
                <span className="text-xs text-gray-500 font-medium">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* 4. About (Story-Style) */}
          {bio && (
            <div className="mt-6 bg-white rounded-xl">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">About</h3>
              <div className="relative">
                <p className={`text-gray-600 leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
                  {bio}
                </p>
                {bio.length > 150 && (
                  <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-sm font-semibold text-blue-600 hover:underline mt-1 focus:outline-none"
                  >
                    {isExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper component for icon
const ClockIcon = (props: any) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
