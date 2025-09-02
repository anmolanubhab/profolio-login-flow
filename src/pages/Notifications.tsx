import { Card, CardContent } from '@/components/ui/card';
import { Bell, MessageCircle, UserPlus, Award } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';

const Notifications = () => {
  const notifications = [
    {
      id: 1,
      type: 'message',
      icon: MessageCircle,
      title: 'New message from Sarah Johnson',
      description: 'Thanks for connecting! I\'d love to discuss the project opportunity.',
      time: '2 hours ago',
      unread: true
    },
    {
      id: 2,
      type: 'connection',
      icon: UserPlus,
      title: 'John Doe accepted your connection',
      description: 'You are now connected with John Doe',
      time: '5 hours ago',
      unread: true
    },
    {
      id: 3,
      type: 'certificate',
      icon: Award,
      title: 'Certificate verified',
      description: 'Your React Developer Certificate has been verified',
      time: '1 day ago',
      unread: false
    }
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-primary text-primary-foreground sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <h1 className="text-xl font-bold">Notifications</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="space-y-4">
          {notifications.map((notification) => {
            const Icon = notification.icon;
            return (
              <Card key={notification.id} className={`cursor-pointer hover:shadow-md transition-shadow ${notification.unread ? 'bg-primary/5' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{notification.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{notification.description}</p>
                      <p className="text-xs text-muted-foreground mt-2">{notification.time}</p>
                    </div>
                    {notification.unread && (
                      <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default Notifications;