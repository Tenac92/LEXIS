import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { useMutation } from "@tanstack/react-query";

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

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PasswordChangeFormData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordChangeFormData) => {
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

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Επιτυχής αλλαγή",
        description: "Ο κωδικός σας άλλαξε με επιτυχία",
      });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Σφάλμα",
        description: error.message || "Αποτυχία αλλαγής κωδικού",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: PasswordChangeFormData) => {
    try {
      setIsSubmitting(true);
      changePasswordMutation.mutate(data);
    } catch (error) {
      // Ensure we always reset submission state on error
      setIsSubmitting(false);
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Αποτυχία αλλαγής κωδικού",
        variant: "destructive",
      });
    }
  };

  // Handle dialog close safely
  const handleDialogChange = (open: boolean) => {
    if (!open && !isSubmitting) {
      // Only close if not submitting to prevent UI freeze
      form.reset(); // Reset form on close
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Αλλαγή Κωδικού</DialogTitle>
          <DialogDescription>
            Εισάγετε τον τρέχοντα κωδικό σας και τον νέο κωδικό που επιθυμείτε.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogChange(false)}
                disabled={isSubmitting}
              >
                Ακύρωση
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Αποθήκευση..." : "Αποθήκευση"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
