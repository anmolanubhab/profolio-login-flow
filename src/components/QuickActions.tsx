import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, FileText, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const QuickActions = () => {
  const navigate = useNavigate();

  return (
    <div className="grid gap-4 md:grid-cols-2 mb-6">
      {/* Certificate Vault */}
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <Button 
            variant="ghost" 
            className="w-full justify-between h-auto p-0"
            onClick={() => navigate('/certificates')}
          >
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm">CERTIFICATE VAULT</div>
                <div className="text-xs text-muted-foreground">Manage and share your certificates</div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Button>
        </CardContent>
      </Card>

      {/* Create Resume */}
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <Button 
            variant="ghost" 
            className="w-full justify-between h-auto p-0"
            onClick={() => navigate('/resume')}
          >
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm">CREATE RESUME</div>
                <div className="text-xs text-muted-foreground">Build a professional resume</div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuickActions;