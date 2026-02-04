import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Building2, Plus } from 'lucide-react';
import { useCompanyAdmin } from '@/hooks/use-company-admin';
import { CompanyPostDialog } from './CompanyPostDialog';

interface CreateCompanyPostButtonProps {
  onPostCreated?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const CreateCompanyPostButton = ({
  onPostCreated,
  variant = 'outline',
  size = 'default',
  className
}: CreateCompanyPostButtonProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { companies, hasCompanies, isLoading } = useCompanyAdmin();

  // Don't render if user has no companies
  if (isLoading || !hasCompanies) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setDialogOpen(true)}
        className={className}
      >
        <Building2 className="w-4 h-4 mr-2" />
        <span className="hidden sm:inline">Post as Company</span>
        <span className="sm:hidden">Company Post</span>
      </Button>

      <CompanyPostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        companies={companies}
        onPostCreated={onPostCreated}
      />
    </>
  );
};
