import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus } from "lucide-react";

const subprojectSchema = z.object({
  code: z.string().optional(),
  title: z.string().min(1, "Ο τίτλος είναι υποχρεωτικός"),
  status: z.string().default("active"),
  description: z.string().optional(),
});

type SubprojectFormData = z.infer<typeof subprojectSchema>;

interface AddSubprojectDialogProps {
  projectId: string | number;
  projectTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddSubprojectDialog({
  projectId,
  projectTitle,
  open,
  onOpenChange,
}: AddSubprojectDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<SubprojectFormData>({
    resolver: zodResolver(subprojectSchema),
    defaultValues: {
      code: "",
      title: "",
      status: "active",
      description: "",
    },
  });

  const createSubprojectMutation = useMutation({
    mutationFn: async (data: SubprojectFormData) => {
      const response = await fetch(`/api/projects/${projectId}/subprojects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Αποτυχία δημιουργίας υποέργου");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Επιτυχής δημιουργία",
        description: `Το υποέργο "${data.subproject.title}" δημιουργήθηκε επιτυχώς`,
      });

      // Invalidate subprojects cache to refresh the list
      queryClient.invalidateQueries({
        queryKey: ["subprojects", String(projectId)],
      });

      // Reset form and close dialog
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Σφάλμα",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SubprojectFormData) => {
    createSubprojectMutation.mutate(data);
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Προσθήκη Νέου Υποέργου
          </DialogTitle>
          <DialogDescription>
            {projectTitle ? (
              <>Προσθέστε νέο υποέργο στο έργο: <strong>{projectTitle}</strong></>
            ) : (
              <>Προσθέστε νέο υποέργο στο επιλεγμένο έργο</>
            )}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Κωδικός Υποέργου</FormLabel>
                    <FormControl>
                      <Input placeholder="π.χ. SP-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Κατάσταση</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Επιλέξτε κατάσταση" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Ενεργό</SelectItem>
                        <SelectItem value="planning">Σχεδιασμός</SelectItem>
                        <SelectItem value="completed">Ολοκληρωμένο</SelectItem>
                        <SelectItem value="suspended">Αναστολή</SelectItem>
                        <SelectItem value="cancelled">Ακυρωμένο</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Τίτλος Υποέργου</FormLabel>
                  <FormControl>
                    <Input placeholder="Εισάγετε τον τίτλο του υποέργου" {...field} />
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
                  <FormLabel>Περιγραφή (προαιρετικό)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Περιγράψτε το υποέργο..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Ακύρωση
              </Button>
              <Button 
                type="submit" 
                disabled={createSubprojectMutation.isPending}
              >
                {createSubprojectMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Δημιουργία Υποέργου
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}