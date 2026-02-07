import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, X, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

interface DocumentUploadProps {
  bucket: string;
  onUploadComplete: (result: { url: string; filePath: string; fileName: string; fileSize: number }) => void;
  maxSizeMB?: number;
  acceptedTypes?: string; // e.g., ".pdf,.doc"
  className?: string;
  label?: string;
}

export const DocumentUpload = ({
  bucket,
  onUploadComplete,
  maxSizeMB = 5,
  acceptedTypes = ".pdf",
  className,
  label = "Upload Document"
}: DocumentUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (file: File) => {
    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast({
        title: "File too large",
        description: `Please select a file smaller than ${maxSizeMB}MB.`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Secure upload implementation
      // Since we can't import dynamic secureUpload easily inside the component without proper setup, 
      // we'll implement direct upload with best practices here, or reuse the pattern if it exists.
      // Based on CertificateVault, there is a '@/lib/secure-upload'.
      
      const { secureUpload } = await import('@/lib/secure-upload');
      
      // Simulate progress since Supabase client doesn't provide fine-grained progress for simple uploads
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 200);

      const result = await secureUpload({
        bucket,
        file,
        userId: user.id
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Success
      setTimeout(() => {
        onUploadComplete({
          url: result.url,
          filePath: result.filePath,
          fileName: file.name,
          fileSize: file.size
        });
        setUploading(false);
        setProgress(0);
      }, 500);

    } catch (error) {
      console.error('Upload error:', error);
      setUploading(false);
      setProgress(0);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload document.",
        variant: "destructive",
      });
    }
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
    // Reset value so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "relative flex flex-col items-center justify-center w-full border-2 border-dashed rounded-lg p-6 transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
          uploading ? "opacity-50 pointer-events-none" : "cursor-pointer"
        )}
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes}
          className="hidden"
          onChange={onChange}
        />

        {uploading ? (
          <div className="w-full max-w-xs space-y-4 text-center">
            <div className="flex justify-center">
              <Upload className="h-10 w-10 text-primary animate-bounce" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Uploading...</p>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="p-3 bg-primary/10 rounded-full">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">
                Drag & drop or click to upload
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Max {maxSizeMB}MB ({acceptedTypes.replace(/\./g, ' ').toUpperCase()})
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
