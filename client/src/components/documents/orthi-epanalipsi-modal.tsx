import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GeneratedDocument } from "@shared/schema";
import { z } from "zod";

interface OrthiEpanalipsiModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: GeneratedDocument | null;
}

// Zod schema for form validation
const orthiEpanalipsiSchema = z.object({
  correctionReason: z.string().min(1, "Παρακαλώ εισάγετε το λόγο διόρθωσης"),
  na853: z.string().min(1, "Παρακαλώ επιλέξτε NA853"),
  comments: z.string().optional(),
  protocol_date: z.string().min(1, "Παρακαλώ επιλέξτε ημερομηνία"),
});

type OrthiEpanalipsiFormData = z.infer<typeof orthiEpanalipsiSchema>;

export function OrthiEpanalipsiModal({ isOpen, onClose, document }: OrthiEpanalipsiModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<OrthiEpanalipsiFormData>({
    resolver: zodResolver(orthiEpanalipsiSchema),
    defaultValues: {
      correctionReason: "",
      na853: document?.project_na853 || "",
      comments: "",
      protocol_date: new Date().toISOString().split('T')[0],
    },
  });

  // Reset form when document changes or modal opens
  useEffect(() => {
    if (document && isOpen) {
      form.reset({
        correctionReason: "",
        na853: document.project_na853 || "",
        comments: "",
        protocol_date: new Date().toISOString().split('T')[0],
      });
    }
  }, [document, form, isOpen]);

  // Fetch available NA853 options for the unit
  const { data: projects = [] } = useQuery({
    queryKey: ["/api/catalog", document?.unit],
    enabled: !!document?.unit && isOpen,
    queryFn: async () => {
      try {
        console.log("Fetching projects for unit:", document?.unit);
        const response = await fetch(`/api/catalog?unit=${encodeURIComponent(document?.unit || '')}`);
        if (!response.ok) {
          console.error("Failed to fetch projects:", response.status, response.statusText);
          throw new Error('Failed to fetch projects');
        }
        const data = await response.json();
        console.log("Fetched projects:", data);
        return data.data || [];
      } catch (error) {
        console.error("Error fetching projects:", error);
        throw error;
      }
    },
  });

  // Mutation for generating correction
  const generateCorrection = useMutation({
    mutationFn: async (data: OrthiEpanalipsiFormData) => {
      if (!document?.id) throw new Error("No document selected");

      console.log("Generating correction with data:", data);

      const response = await fetch(`/api/documents/generated/${document.id}/orthi-epanalipsi`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...document,
          project_na853: data.na853,
          comments: data.comments,
          correction_reason: data.correctionReason,
          protocol_date: data.protocol_date,
          original_protocol_number: document.protocol_number_input,
          original_protocol_date: document.protocol_date,
          status: "pending",
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed to generate correction" }));
        throw new Error(error.message || "Failed to generate correction");
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
        throw new Error('Invalid response format');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orthi-epanalipsi-${document.id}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Επιτυχία",
        description: "Η ορθή επανάληψη δημιουργήθηκε επιτυχώς",
      });
      onClose();
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Αποτυχία δημιουργίας ορθής επανάληψης",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: OrthiEpanalipsiFormData) => {
    generateCorrection.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Στοιχεία Ορθής Επανάληψης</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <FormLabel>Αρχικό Πρωτόκολλο</FormLabel>
                <Input 
                  value={document?.protocol_number_input || ""} 
                  readOnly
                  className="bg-gray-100"
                />
              </div>

              <FormField
                control={form.control}
                name="protocol_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ημερομηνία Πρωτοκόλλου</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="na853"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NA853</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Επιλέξτε NA853..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects?.map((project: any) => (
                        <SelectItem key={project.na853} value={project.na853}>
                          {project.na853}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="correctionReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Λόγος Ορθής Επανάληψης</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Εισάγετε το λόγο της ορθής επανάληψης..."
                      className="min-h-[100px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Σχόλια</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Εισάγετε επιπλέον σχόλια..."
                      className="min-h-[100px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  onClose();
                  form.reset();
                }} 
                type="button"
              >
                Ακύρωση
              </Button>
              <Button
                type="submit"
                disabled={generateCorrection.isPending}
              >
                Δημιουργία Ορθής Επανάληψης
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}