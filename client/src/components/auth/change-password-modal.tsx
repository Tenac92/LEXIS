import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

/**
 * Password change schema with validation
 */
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(6, "Ο τρέχων κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες"),
  newPassword: z.string().min(6, "Ο νέος κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες"),
  confirmPassword: z.string().min(6, "Η επιβεβαίωση κωδικού πρέπει να έχει τουλάχιστον 6 χαρακτήρες"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Οι κωδικοί δεν ταιριάζουν",
  path: ["confirmPassword"],
});

type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>;

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Completely rewritten change password modal component to fix freezing issues
 */
export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Control the dialog state separately from props to avoid freezing
  useEffect(() => {
    if (isOpen && !dialogOpen) {
      setDialogOpen(true);
    }
  }, [isOpen, dialogOpen]);

  // Setup form
  const form = useForm<PasswordChangeFormData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  
  // Reset form when dialog closes
  useEffect(() => {
    if (!dialogOpen) {
      form.reset();
    }
  }, [dialogOpen, form]);

  /**
   * Safely handle dialog close by detaching it from the parent component state
   */
  const handleDialogClose = () => {
    if (isSubmitting) {
      // Don't close while submitting to prevent UI freeze
      return;
    }
    
    // First close our internal state
    setDialogOpen(false);
    
    // Then notify parent with slight delay to prevent freezing
    setTimeout(() => {
      onClose();
    }, 50);
  };

  /**
   * Submit password change
   */
  const onSubmit = async (data: PasswordChangeFormData) => {
    try {
      setIsSubmitting(true);
      
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to change password");
      }

      toast({
        title: "Επιτυχής αλλαγή",
        description: "Ο κωδικός σας άλλαξε με επιτυχία",
      });
      
      // Close dialog first, then reset form (prevents freezing)
      handleDialogClose();
      form.reset();
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Αποτυχία αλλαγής κωδικού",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // Control dialog with our internal state instead of directly with props
    <Dialog open={dialogOpen} onOpenChange={(open) => {
      if (!open) handleDialogClose();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Αλλαγή Κωδικού</DialogTitle>
          <DialogDescription>
            Εισάγετε τον τρέχοντα κωδικό σας και τον νέο κωδικό που επιθυμείτε.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form id="password-change-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Τρέχων Κωδικός</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Εισάγετε τον τρέχοντα κωδικό"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Νέος Κωδικός</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Εισάγετε τον νέο κωδικό"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Επιβεβαίωση Νέου Κωδικού</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Επιβεβαιώστε τον νέο κωδικό"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        
        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleDialogClose}
            disabled={isSubmitting}
          >
            Ακύρωση
          </Button>
          <Button 
            type="submit"
            form="password-change-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Αποθήκευση..." : "Αποθήκευση"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
