import { UserApplicationsCard as UserApplications } from '@/components/jobs/UserApplicationsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase } from 'lucide-react';

export const MyApplications = () => {
  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Briefcase className="h-6 w-6 text-primary" />
            My Applications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UserApplications />
        </CardContent>
      </Card>
    </div>
  );
};
