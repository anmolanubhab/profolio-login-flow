import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface UpgradeAlertProps {
  title?: string;
  description?: string;
  className?: string;
  onUpgrade?: () => void;
}

export const UpgradeAlert = ({ 
  title = "Unlock Pro Features", 
  description = "Upgrade to Recruiter Pro to access this feature and more.", 
  className,
  onUpgrade 
}: UpgradeAlertProps) => {
  return (
    <Card className={cn("border-primary/20 bg-primary/5", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button 
          className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
          onClick={onUpgrade}
        >
          Upgrade to Pro
        </Button>
      </CardFooter>
    </Card>
  );
};
