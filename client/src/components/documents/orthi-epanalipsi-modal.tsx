import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import { GeneratedDocument } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

const orthiEpanalipsiSchema = z.object({
  correctionReason: z.string().min(1, "Παρακαλώ εισάγετε το λόγο διόρθωσης"),
  protocol_number_input: z.string().min(1, "Ο αριθμός πρωτοκόλλου είναι υποχρεωτικός"),
  protocol_date: z.string().min(1, "Η ημερομηνία πρωτοκόλλου είναι υποχρεωτική"),
});

interface OrthiEpanalipsiModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: GeneratedDocument | null;
}

export function OrthiEpanalipsiModal({ isOpen, onClose, document }: OrthiEpanalipsiModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(orthiEpanalipsiSchema),
    defaultValues: {
      correctionReason: "",
      protocol_number_input: "",
      protocol_date: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof orthiEpanalipsiSchema>) => {
    try {
      console.log('Submitting orthi epanalipsi with data:', data);

      const response = await fetch(`/api/documents/generated/${document?.id}/orthi-epanalipsi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Orthi epanalipsi error response:", errorText);
        throw new Error("Failed to create orthi epanalipsi");
      }

      // Get the response as a blob for downloading
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orthi-epanalipsi-${document?.id}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Επιτυχία", description: "Η ορθή επανάληψη δημιουργήθηκε" });
      onClose();
    } catch (error) {
      console.error("Error creating orthi epanalipsi:", error);
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία δημιουργίας ορθής επανάληψης",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Δημιουργία Ορθής Επανάληψης</DialogTitle>
          <DialogDescription>
            Συμπληρώστε τα στοιχεία για τη δημιουργία ορθής επανάληψης του εγγράφου.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="correctionReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Λόγος Διόρθωσης</FormLabel>
                    <FormControl>
                      <Textarea {...field} className="min-h-[100px]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="protocol_number_input"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Νέος Αριθμός Πρωτοκόλλου</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="protocol_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Νέα Ημερομηνία Πρωτοκόλλου</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </ScrollArea>

        <DialogFooter className="p-6 pt-2">
          <Button type="submit" onClick={form.handleSubmit(onSubmit)}>
            Δημιουργία Ορθής Επανάληψης
          </Button>
          <Button variant="outline" onClick={onClose}>
            Ακύρωση
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}