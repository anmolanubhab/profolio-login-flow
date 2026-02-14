import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Eye, ThumbsUp, MessageCircle, TrendingUp, Building2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CompanyInsightsProps {
  companyId: string;
  companyName?: string;
}

interface InsightData {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  recentViews: number;
}

export const CompanyInsights = ({ companyId, companyName }: CompanyInsightsProps) => {
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyId) {
      const controller = new AbortController();
      fetchInsights(controller.signal);
      return () => controller.abort();
    }
  }, [companyId]);

  const fetchInsights = async (signal?: AbortSignal) => {
    try {
      // Get company posts
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('id')
        .eq('company_id', companyId)
        .eq('posted_as', 'company')
        .abortSignal(signal);

      if (postsError) {
        if (postsError.code === 'ABORTED') return;
        throw postsError;
      }

      const postIds = posts?.map(p => p.id) || [];
      const totalPosts = postIds.length;

      let totalLikes = 0;
      let totalComments = 0;

      if (postIds.length > 0) {
        // Get likes count
        const { count: likesCount, error: likesError } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .in('post_id', postIds)
          .abortSignal(signal);
        
        if (likesError) {
          if (likesError.code === 'ABORTED') return;
          throw likesError;
        }
        totalLikes = likesCount || 0;

        // Get comments count
        const { count: commentsCount, error: commentsError } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .in('post_id', postIds)
          .abortSignal(signal);

        if (commentsError) {
          if (commentsError.code === 'ABORTED') return;
          throw commentsError;
        }
        totalComments = commentsCount || 0;
      }

      // Estimate recent views (for demo purposes - you might want to implement actual view tracking)
      const recentViews = totalPosts * 15 + totalLikes * 3 + totalComments * 5;

      setInsights({
        totalPosts,
        totalLikes,
        totalComments,
        recentViews
      });
    } catch (error) {
      console.error('Error fetching company insights:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 bg-white shadow-none sm:shadow-card overflow-hidden">
        <CardHeader className="px-4 py-6 sm:px-8 sm:pt-8 sm:pb-4 border-b border-gray-50">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="px-4 py-6 sm:px-8 sm:pb-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!insights) {
    return null;
  }

  const stats = [
    {
      label: 'Posts',
      value: insights.totalPosts,
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      label: 'Likes',
      value: insights.totalLikes,
      icon: ThumbsUp,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50'
    },
    {
      label: 'Comments',
      value: insights.totalComments,
      icon: MessageCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      label: 'Est. Views',
      value: insights.recentViews,
      icon: Eye,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  return (
    <Card className="rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 bg-white shadow-none sm:shadow-card overflow-hidden">
      <CardHeader className="px-4 py-6 sm:px-8 sm:pt-8 sm:pb-4 border-b border-gray-50">
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <TrendingUp className="w-5 h-5 text-primary" />
          {companyName ? `${companyName} Insights` : 'Company Insights'}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-6 sm:px-8 sm:pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div 
              key={stat.label}
              className="p-5 rounded-2xl border border-gray-100 bg-white hover:border-primary/20 hover:bg-primary/[0.01] transition-all duration-300"
            >
              <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center mb-4`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
              <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
