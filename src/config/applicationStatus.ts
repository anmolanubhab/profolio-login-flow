import { Briefcase, MapPin, Calendar, Building2, XCircle, ChevronDown, ChevronUp, CheckCircle, Clock, AlertCircle, LucideIcon } from 'lucide-react';

export type ApplicationStatus = 'applied' | 'shortlisted' | 'interview' | 'offered' | 'rejected' | 'withdrawn';

export const statusConfig: Record<ApplicationStatus, { 
  color: string; 
  label: string; 
  icon: LucideIcon;
  description: string;
}> = {
  applied: { 
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300', 
    label: 'Applied',
    icon: Clock,
    description: 'Your application is being reviewed'
  },
  shortlisted: { 
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300', 
    label: 'Shortlisted',
    icon: CheckCircle,
    description: 'Great! You\'ve been shortlisted'
  },
  interview: { 
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300', 
    label: 'Interview',
    icon: Calendar,
    description: 'Interview scheduled'
  },
  offered: { 
    color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300', 
    label: 'Offered',
    icon: CheckCircle,
    description: 'Congratulations! You received an offer'
  },
  rejected: { 
    color: 'bg-red-100/70 text-red-700 dark:bg-red-900/30 dark:text-red-400', 
    label: 'Not Selected',
    icon: AlertCircle,
    description: 'This position has been filled'
  },
  withdrawn: { 
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400', 
    label: 'Withdrawn',
    icon: XCircle,
    description: 'You withdrew your application'
  },
};
