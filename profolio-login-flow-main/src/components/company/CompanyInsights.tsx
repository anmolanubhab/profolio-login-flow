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
      fetchInsights();
    }
  }, [companyId]);

  const fetchInsights = async () => {
    try {
      // Get company posts
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('id')
        .eq('company_id', companyId)
        .eq('posted_as', 'company');

      if (postsError) throw postsError;

      const postIds = posts?.map(p => p.id) || [];
      const totalPosts = postIds.length;

      let totalLikes = 0;
      let totalComments = 0;

      if (postIds.length > 0) {
        // Get likes count
        const { count: likesCount } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .in('post_id', postIds);
        totalLikes = likesCount || 0;

        // Get comments count
        const { count: commentsCount } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .in('post_id', postIds);
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
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
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
      bgColor: 'bg-blue-100'
    },
    {
      label: 'Likes',
      value: insights.totalLikes,
      icon: ThumbsUp,
      color: 'text-pink-600',
      bgColor: 'bg-pink-100'
    },
    {
      label: 'Comments',
      value: insights.totalComments,
      icon: MessageCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      label: 'Est. Views',
      value: insights.recentViews,
      icon: Eye,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    }
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5 text-primary" />
          {companyName ? `${companyName} Insights` : 'Company Insights'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div 
              key={stat.label}
              className="p-4 rounded-xl border border-border bg-card hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
