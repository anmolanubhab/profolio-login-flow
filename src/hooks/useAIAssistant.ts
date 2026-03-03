import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type AIAction = 'resume_summary' | 'skill_suggestions' | 'cover_letter' | 'improve_text';

export const useAIAssistant = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generate = async (action: AIAction, data: Record<string, any>): Promise<string | null> => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('ai-assistant', {
        body: { action, data },
      });

      if (error) throw error;

      if (result?.error) {
        toast({
          title: "AI Error",
          description: result.error,
          variant: "destructive",
        });
        return null;
      }

      return result?.result || null;
    } catch (error: any) {
      console.error('AI assistant error:', error);
      toast({
        title: "AI Error",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { generate, loading };
};
