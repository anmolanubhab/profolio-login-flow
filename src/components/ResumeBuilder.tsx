// ResumeBuilder.tsx (AI Corrected Version)

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Download,
  Edit,
  Trash2,
  ArrowLeft,
  Plus,
  Eye,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import { DocumentUpload } from "@/components/DocumentUpload";
import { useAIAssistant } from "@/hooks/useAIAssistant";
import { VisibilitySelector } from "@/components/settings/VisibilitySelector";

const ResumeBuilder = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { generate: aiGenerate, loading: aiLoading } = useAIAssistant();

  const [formData, setFormData] = useState({
    title: "",
    personalInfo: { name: "", email: "", phone: "", location: "" },
    summary: "",
    experience: "",
    education: "",
    skills: "",
    visibility: "recruiters",
  });

  const [aiPreview, setAiPreview] = useState<{
    field: string;
    text: string;
  } | null>(null);

  // ===============================
  // AI BUTTON HANDLERS (CORRECTED)
  // ===============================

  const handleGenerateSummary = async () => {
    const result = await aiGenerate("summary", {
      name: formData.personalInfo.name,
      education: formData.education,
      skills: formData.skills,
      experience: formData.experience,
      goal: formData.title,
    });

    if (result) {
      setAiPreview({ field: "summary", text: result });
    }
  };

  const handleImproveExperience = async () => {
    const result = await aiGenerate("improve", {
      text: formData.experience,
      field: "experience section",
    });

    if (result) {
      setAiPreview({ field: "experience", text: result });
    }
  };

  const handleSuggestSkills = async () => {
    const result = await aiGenerate("skills", {
      education: formData.education,
      experience: formData.experience,
      currentSkills: formData.skills
        ? formData.skills.split(",").map((s) => s.trim())
        : [],
      profession: formData.title,
    });

    if (result) {
      setAiPreview({ field: "skills", text: result });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Professional Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Professional Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={formData.summary}
            onChange={(e) =>
              setFormData({ ...formData, summary: e.target.value })
            }
          />
          <Button
            type="button"
            variant="outline"
            disabled={aiLoading}
            onClick={handleGenerateSummary}
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Summary with AI
          </Button>
        </CardContent>
      </Card>

      {/* Experience */}
      <Card>
        <CardHeader>
          <CardTitle>Experience</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={formData.experience}
            onChange={(e) =>
              setFormData({ ...formData, experience: e.target.value })
            }
          />
          <Button
            type="button"
            variant="outline"
            disabled={aiLoading}
            onClick={handleImproveExperience}
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Improve with AI
          </Button>
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader>
          <CardTitle>Core Skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={formData.skills}
            onChange={(e) =>
              setFormData({ ...formData, skills: e.target.value })
            }
          />
          <Button
            type="button"
            variant="outline"
            disabled={aiLoading}
            onClick={handleSuggestSkills}
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Suggest Skills with AI
          </Button>
        </CardContent>
      </Card>

      {/* AI Preview Modal */}
      {aiPreview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-[600px] space-y-4">
            <h3 className="font-bold text-lg">AI Generated Content</h3>
            <Textarea
              value={aiPreview.text}
              onChange={(e) =>
                setAiPreview({ ...aiPreview, text: e.target.value })
              }
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setAiPreview(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setFormData((prev) => ({
                    ...prev,
                    [aiPreview.field]: aiPreview.text,
                  }));
                  setAiPreview(null);
                }}
              >
                Accept & Use
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeBuilder;
