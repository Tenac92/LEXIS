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
import { supabase } from "@/lib/supabase";

interface OrthiEpanalipsiModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: GeneratedDocument | null;
}

interface Recipient {
  firstname: string;
  lastname: string;
  afm: string;
  amount: number;
  installment: number;
}

interface OrthiEpanalipsiFormData {
  correctionReason: string;
  na853: string;
  recipients: Recipient[];
  comments: string;
}

export function OrthiEpanalipsiModal({ isOpen, onClose, document }: OrthiEpanalipsiModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<OrthiEpanalipsiFormData>({
    defaultValues: {
      correctionReason: "",
      na853: document?.project_na853 || "",
      recipients: document?.recipients || [],
      comments: "",
    },
  });

  // Fetch available NA853 options for the unit
  const { data: projects } = useQuery({
    queryKey: ["/api/catalog", document?.unit],
    enabled: !!document?.unit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("na853")
        .eq("unit", document?.unit);

      if (error) throw error;
      return data || [];
    },
  });

  // Mutation for generating correction
  const generateCorrection = useMutation({
    mutationFn: async (data: OrthiEpanalipsiFormData) => {
      if (!document?.id) throw new Error("No document selected");

      const response = await fetch(`/api/documents/generated/${document.id}/orthi-epanalipsi`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...document,
          recipients: data.recipients.map(recipient => ({
            ...recipient,
            amount: parseFloat(recipient.amount.toString()),
          })),
          project_na853: data.na853,
          comments: data.comments,
          correction_reason: data.correctionReason,
          original_protocol_number: document.protocol_number_input,
          original_protocol_date: document.protocol_date,
          status: "pending",
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed to generate correction" }));
        throw new Error(error.message || "Failed to generate correction");
      }

      // Handle document download
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
        description: "Η διόρθωση δημιουργήθηκε επιτυχώς",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Αποτυχία δημιουργίας διόρθωσης",
        variant: "destructive",
      });
    },
  });

  // Reset form when document changes
  useEffect(() => {
    if (document) {
      form.reset({
        correctionReason: "",
        na853: document.project_na853 || "",
        recipients: document.recipients || [],
        comments: document.comments || "",
      });
    }
  }, [document, form]);

  const onSubmit = (data: OrthiEpanalipsiFormData) => {
    generateCorrection.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Στοιχεία Διόρθωσης</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="originalProtocol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Αρχικό Πρωτόκολλο</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly value={document?.protocol_number_input || ""} />
                    </FormControl>
                  </FormItem>
                )}
              />

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
                        {projects?.map((project) => (
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
            </div>

            <FormField
              control={form.control}
              name="correctionReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Λόγος Διόρθωσης</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Δώστε το λόγο διόρθωσης"
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
                      placeholder="Εισάγετε σχόλια διόρθωσης..."
                      className="min-h-[100px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={onClose} type="button">
                Ακύρωση
              </Button>
              <Button
                type="submit"
                disabled={generateCorrection.isPending}
              >
                Δημιουργία Διόρθωσης
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
