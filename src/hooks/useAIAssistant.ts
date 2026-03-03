import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type AIType = "summary" | "improve" | "skills" | "cover_letter";

export const useAIAssistant = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generate = async (
    type: AIType,
    userData: Record<string, any>
  ): Promise<string | null> => {
    setLoading(true);
    console.log("AI Assistant: invoking type", type, "with data", userData);

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          type, // 👈 NEW FORMAT
          payload: { userData }, // 👈 REQUIRED STRUCTURE
        },
      });

      if (error) {
        console.error("AI Assistant: invocation error", error);
        throw error;
      }

      console.log("AI response:", data);

      if (!data) {
        toast({
          title: "AI Error",
          description: "AI returned empty response.",
          variant: "destructive",
        });
        return null;
      }

      // Expecting: { success: true, content: "generated text" }
      if (data.error) {
        toast({
          title: "AI Error",
          description: data.error,
          variant: "destructive",
        });
        return null;
      }

      return data.content || null;
    } catch (error: any) {
      console.error("AI assistant error:", error);

      toast({
        title: "AI Error",
        description: "AI generation failed. Please try again.",
        variant: "destructive",
      });

      return null;
    } finally {
      setLoading(false);
    }
  };

  return { generate, loading };
};
