import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  date: z.date({ required_error: "Date is required" }),
  time: z.string().min(1, "Time is required"),
  duration_minutes: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1, "Duration must be at least 1 minute")),
  meeting_link: z.string().optional().or(z.literal('')),
});

interface ScheduleInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicantId: string;
  applicantName: string;
  intervieweeId: string; // The candidate's user ID (auth.uid)
}

export const ScheduleInterviewDialog = ({
  open,
  onOpenChange,
  applicantId, // This might be the application ID
  applicantName,
  intervieweeId,
}: ScheduleInterviewDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: 'Technical Interview',
      description: '',
      duration_minutes: 60,
      meeting_link: '',
      time: '10:00',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to schedule an interview.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const controller = new AbortController();
    try {
      // Combine date and time
      const scheduledAt = new Date(values.date);
      const [hours, minutes] = values.time.split(':').map(Number);
      scheduledAt.setHours(hours, minutes, 0, 0);

      const { error } = await supabase.from('interviews').insert({
        title: values.title,
        description: values.description || null,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: values.duration_minutes,
        meeting_link: values.meeting_link || null,
        interviewer_id: user.id,
        interviewee_id: intervieweeId,
        status: 'scheduled',
      }).abortSignal(controller.signal);

      if (error) {
        if (error.code === 'ABORTED' || error.message?.includes('abort')) return;
        throw error;
      }

      toast({
        title: "Success",
        description: "Interview scheduled successfully.",
      });
      
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('Error scheduling interview:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to schedule interview.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    });
      scheduledAt.setHours(hours, minutes, 0, 0);

      const { error } = await supabase.from('interviews').insert({
        title: values.title,
        description: values.description || null,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: values.duration_minutes,
        meeting_link: values.meeting_link || null,
        interviewer_id: user.id,
        interviewee_id: intervieweeId,
        status: 'scheduled',
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Interview scheduled successfully.",
      });
      
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      console.error('Error scheduling interview:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to schedule interview.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule Interview</DialogTitle>
          <DialogDescription>
            Schedule an interview with {applicantName}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Technical Interview" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="duration_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (minutes)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="meeting_link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meeting Link (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://meet.google.com/..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any details about the interview..." 
                      className="resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Schedule
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
