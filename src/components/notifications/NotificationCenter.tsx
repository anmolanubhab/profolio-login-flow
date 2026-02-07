
import { Bell, Check, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { useJobAlerts } from "@/hooks/useJobAlerts";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

export const NotificationCenter = () => {
  // Trigger background job alert check
  useJobAlerts();
  
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full p-0 text-[10px]"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-2">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-auto py-1 px-2" 
              onClick={() => markAllAsRead()}
            >
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading...
            </div>
          ) : notifications?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
              <Bell className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-1 p-1">
              {notifications?.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`relative flex flex-col gap-1 p-3 rounded-md transition-colors ${
                    notification.read ? 'bg-background hover:bg-muted/50' : 'bg-muted/30 hover:bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium leading-none">
                      {notification.link ? (
                        <Link 
                          to={notification.link} 
                          className="hover:underline decoration-primary"
                          onClick={() => !notification.read && markAsRead(notification.id)}
                        >
                          {notification.title}
                        </Link>
                      ) : (
                        notification.title
                      )}
                    </h4>
                    {!notification.read && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                  <span className="text-[10px] text-muted-foreground/70">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </span>
                  
                  {!notification.read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute bottom-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => markAsRead(notification.id)}
                    >
                      <Check className="h-3 w-3" />
                      <span className="sr-only">Mark as read</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
