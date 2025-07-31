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
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Shield, CheckCircle, XCircle } from "lucide-react";

/**
 * Enhanced password validation with security requirements
 */
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Ο τρέχων κωδικός είναι υποχρεωτικός"),
  newPassword: z.string()
    .min(8, "Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες")
    .regex(/[A-Z]/, "Ο νέος κωδικός πρέπει να περιέχει τουλάχιστον ένα κεφαλαίο γράμμα")
    .regex(/[a-z]/, "Ο νέος κωδικός πρέπει να περιέχει τουλάχιστον ένα μικρό γράμμα")
    .regex(/[0-9]/, "Ο νέος κωδικός πρέπει να περιέχει τουλάχιστον έναν αριθμό")
    .regex(/[^A-Za-z0-9]/, "Ο νέος κωδικός πρέπει να περιέχει τουλάχιστον ένα ειδικό σύμβολο"),
  confirmPassword: z.string().min(1, "Η επιβεβαίωση κωδικού είναι υποχρεωτική"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Οι κωδικοί δεν ταιριάζουν",
  path: ["confirmPassword"],
});

/**
 * Calculate password strength score (0-100)
 */
const calculatePasswordStrength = (password: string): number => {
  let score = 0;
  
  // Length scoring
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 15;
  if (password.length >= 16) score += 10;
  
  // Character variety scoring
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;
  
  // Additional complexity
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 5;
  
  return Math.min(score, 100);
};

/**
 * Get password strength label and color
 */
const getPasswordStrengthInfo = (score: number) => {
  if (score < 30) return { label: "Πολύ Αδύναμος", color: "bg-red-500", textColor: "text-red-600" };
  if (score < 60) return { label: "Αδύναμος", color: "bg-orange-500", textColor: "text-orange-600" };
  if (score < 80) return { label: "Μέτριος", color: "bg-yellow-500", textColor: "text-yellow-600" };
  return { label: "Ισχυρός", color: "bg-green-500", textColor: "text-green-600" };
};

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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  // Control the dialog state separately from props to avoid freezing
  useEffect(() => {
    if (isOpen && !dialogOpen) {
      setDialogOpen(true);
    }
  }, [isOpen, dialogOpen]);

  // Setup form
  const form = useForm<PasswordChangeFormData>({
    resolver: zodResolver(passwordChangeSchema),
    mode: "onChange", // Enable real-time validation
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  
  // Watch password field for strength calculation
  const newPassword = form.watch("newPassword");
  
  // Update password strength when new password changes
  useEffect(() => {
    if (newPassword) {
      setPasswordStrength(calculatePasswordStrength(newPassword));
    } else {
      setPasswordStrength(0);
    }
  }, [newPassword]);
  
  // Reset form and states when dialog closes
  useEffect(() => {
    if (!dialogOpen) {
      form.reset();
      setPasswordStrength(0);
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
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
   * Submit password change with enhanced error handling
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
        let errorMessage = "Αποτυχία αλλαγής κωδικού";
        
        // Provide specific error messages based on response
        if (response.status === 401) {
          errorMessage = "Ο τρέχων κωδικός είναι λανθασμένος";
        } else if (response.status === 400) {
          errorMessage = error.message || "Μη έγκυρα δεδομένα κωδικού";
        } else if (response.status >= 500) {
          errorMessage = "Σφάλμα διακομιστή. Παρακαλώ δοκιμάστε ξανά";
        }
        
        throw new Error(errorMessage);
      }

      toast({
        title: "Επιτυχής αλλαγή",
        description: "Ο κωδικός σας άλλαξε με επιτυχία. Παρακαλώ συνδεθείτε ξανά με τον νέο κωδικό.",
        duration: 5000,
      });
      
      // Close dialog first, then reset form (prevents freezing)
      handleDialogClose();
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Αποτυχία αλλαγής κωδικού",
        variant: "destructive",
        duration: 5000,
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
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Αλλαγή Κωδικού
          </DialogTitle>
          <DialogDescription>
            Εισάγετε τον τρέχοντα κωδικό σας και δημιουργήστε έναν ισχυρό νέο κωδικό.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form id="password-change-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Current Password Field */}
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Τρέχων Κωδικός
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showCurrentPassword ? "text" : "password"}
                        placeholder="Εισάγετε τον τρέχοντα κωδικό"
                        disabled={isSubmitting}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        disabled={isSubmitting}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* New Password Field with Strength Indicator */}
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Νέος Κωδικός
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Δημιουργήστε έναν ισχυρό κωδικό"
                        disabled={isSubmitting}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        disabled={isSubmitting}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  
                  {/* Password Strength Indicator */}
                  {newPassword && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Ισχύς κωδικού:</span>
                        <span className={getPasswordStrengthInfo(passwordStrength).textColor}>
                          {getPasswordStrengthInfo(passwordStrength).label}
                        </span>
                      </div>
                      <Progress 
                        value={passwordStrength} 
                        className="h-2"
                      />
                      
                      {/* Password Requirements Checklist */}
                      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {newPassword.length >= 8 ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-500" />
                          )}
                          8+ χαρακτήρες
                        </div>
                        <div className="flex items-center gap-1">
                          {/[A-Z]/.test(newPassword) ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-500" />
                          )}
                          Κεφαλαίο γράμμα
                        </div>
                        <div className="flex items-center gap-1">
                          {/[a-z]/.test(newPassword) ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-500" />
                          )}
                          Μικρό γράμμα
                        </div>
                        <div className="flex items-center gap-1">
                          {/[0-9]/.test(newPassword) ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-500" />
                          )}
                          Αριθμός
                        </div>
                        <div className="flex items-center gap-1 col-span-2">
                          {/[^A-Za-z0-9]/.test(newPassword) ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-500" />
                          )}
                          Ειδικό σύμβολο (!@#$%^&*)
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Confirm Password Field */}
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Επιβεβαίωση Νέου Κωδικού</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Επιβεβαιώστε τον νέο κωδικό"
                        disabled={isSubmitting}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={isSubmitting}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        
        <DialogFooter className="mt-6 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleDialogClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Ακύρωση
          </Button>
          <Button 
            type="submit"
            form="password-change-form"
            disabled={isSubmitting || passwordStrength < 60}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Shield className="mr-2 h-4 w-4 animate-spin" />
                Αποθήκευση...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Αλλαγή Κωδικού
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
