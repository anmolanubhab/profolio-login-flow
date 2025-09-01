import { Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface NavBarProps {
  user?: {
    email?: string;
    avatar?: string;
  };
  onSignOut?: () => void;
}

const NavBar = ({ user, onSignOut }: NavBarProps) => {
  return (
    <header className="bg-primary text-primary-foreground sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <h1 className="text-xl font-bold">Profolio</h1>
          
          {/* Right side icons */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Search className="h-5 w-5" />
            </Button>
            
            <Avatar 
              className="h-8 w-8 cursor-pointer" 
              onClick={() => window.location.href = '/profile'}
            >
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-primary-foreground text-primary text-sm">
                {user?.email?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
    </header>
  );
};

export default NavBar;