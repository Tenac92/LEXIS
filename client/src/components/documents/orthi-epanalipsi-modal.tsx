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

// Constants
const EXPENDITURE_TYPES = [
  "ΔΚΑ ΕΠΙΣΚΕΥΗ",
  "ΔΚΑ ΑΝΑΚΑΤΑΣΚΕΥΗ",
  "ΔΚΑ ΑΥΤΟΣΤΕΓΑΣΗ",
  "ΔΚΑ ΑΠΟΠΕΡΑΤΩΣΗ",
  "ΔΚΑ ΕΠΙΣΚΕΥΗ ΚΟΙΝΟΧΡΗΣΤΩΝ",
  "ΔΚΑ ΑΝΑΚΑΤΑΣΚΕΥΗ ΚΟΙΝΟΧΡΗΣΤΩΝ",
] as const;

const UNITS = [
  "ΔΑΕΦΚ-ΚΕ",
  "ΔΑΕΦΚ-ΒΕ",
  "ΔΑΕΦΚ-ΑΚ",
  "ΔΑΕΦΚ-ΔΕ",
  "ΓΔΑΕΦΚ",
  "ΤΑΕΦΚ ΧΑΛΚΙΔΙΚΗΣ",
  "ΤΑΕΦΚ ΘΕΣΣΑΛΙΑΣ",
  "ΤΑΕΦΚ-ΑΑ",
  "ΤΑΕΦΚ-ΔΑ",
  "ΤΑΕΦΚ ΧΑΝΙΩΝ",
  "ΤΑΕΦΚ ΗΡΑΚΛΕΙΟΥ"
] as const;

// Recipient schema
const recipientSchema = z.object({
  firstname: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  lastname: z.string().min(1, "Το επώνυμο είναι υποχρεωτικό"),
  afm: z.string().length(9, "Το ΑΦΜ πρέπει να έχει 9 ψηφία"),
  amount: z.number().min(0, "Το ποσό πρέπει να είναι θετικό"),
  installment: z.number().min(1, "Η δόση πρέπει να είναι τουλάχιστον 1"),
});

// Zod schema for form validation
const orthiEpanalipsiSchema = z.object({
  correctionReason: z.string().min(1, "Παρακαλώ εισάγετε το λόγο διόρθωσης"),
  project_id: z.string().min(1, "Παρακαλώ επιλέξτε έργο"),
  project_na853: z.string().min(1, "Το NA853 είναι υποχρεωτικό"),
  comments: z.string().optional(),
  protocol_date: z.string().min(1, "Παρακαλώ επιλέξτε ημερομηνία"),
  unit: z.string().min(1, "Η μονάδα είναι υποχρεωτική"),
  expenditure_type: z.string().min(1, "Ο τύπος δαπάνης είναι υποχρεωτικός"),
  recipients: z.array(recipientSchema),
  total_amount: z.number().min(0, "Το συνολικό ποσό πρέπει να είναι θετικό"),
});

type OrthiEpanalipsiFormData = z.infer<typeof orthiEpanalipsiSchema>;

interface Project {
  mis: string;
  na853: string;
  title: string;
  expenditure_type: string;
}

export function OrthiEpanalipsiModal({ isOpen, onClose, document }: OrthiEpanalipsiModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch document details
  const { data: documentDetails } = useQuery({
    queryKey: ['/api/documents/generated', document?.id],
    enabled: !!document?.id && isOpen,
    queryFn: async () => {
      const response = await fetch(`/api/documents/generated/${document?.id}`);
      if (!response.ok) throw new Error('Failed to fetch document details');
      return response.json();
    },
  });

  const form = useForm<OrthiEpanalipsiFormData>({
    resolver: zodResolver(orthiEpanalipsiSchema),
    defaultValues: {
      correctionReason: "",
      project_id: document?.project_id || "",
      project_na853: document?.project_na853 || "",
      comments: "",
      protocol_date: new Date().toISOString().split('T')[0],
      unit: document?.unit || "",
      expenditure_type: document?.expenditure_type || "",
      recipients: document?.recipients || [],
      total_amount: document?.total_amount || 0,
    },
  });

  // Reset form when document changes or modal opens
  useEffect(() => {
    if (documentDetails && isOpen) {
      form.reset({
        correctionReason: "",
        project_id: documentDetails.project_id || "",
        project_na853: documentDetails.project_na853 || "",
        comments: documentDetails.comments || "",
        protocol_date: new Date().toISOString().split('T')[0],
        unit: documentDetails.unit || "",
        expenditure_type: documentDetails.expenditure_type || "",
        recipients: documentDetails.recipients || [],
        total_amount: documentDetails.total_amount || 0,
      });
    }
  }, [documentDetails, form, isOpen]);

  // Calculate total amount from recipients
  useEffect(() => {
    const recipients = form.watch("recipients");
    const total = recipients.reduce((sum, recipient) => sum + (recipient.amount || 0), 0);
    form.setValue("total_amount", total);
  }, [form.watch("recipients")]);

  // Update project fetch query
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects", form.watch("unit")],
    enabled: !!form.watch("unit") && isOpen,
    queryFn: async () => {
      try {
        console.log("Fetching projects for unit:", form.watch("unit"));
        const response = await fetch(`/api/projects?unit=${encodeURIComponent(form.watch("unit"))}`);
        if (!response.ok) {
          console.error("Failed to fetch projects:", response.status, response.statusText);
          throw new Error('Failed to fetch projects');
        }
        const data = await response.json();
        console.log("Fetched projects:", data);
        return data || [];
      } catch (error) {
        console.error("Error fetching projects:", error);
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία φόρτωσης έργων",
          variant: "destructive",
        });
        return [];
      }
    },
  });

  // Update project_na853 and expenditure_type when project_id changes
  useEffect(() => {
    const projectId = form.watch("project_id");
    console.log("Current project_id:", projectId);
    console.log("Available projects:", projects);
    const selectedProject = projects.find(p => p.mis === projectId);
    console.log("Selected project:", selectedProject);
    if (selectedProject) {
      form.setValue("project_na853", selectedProject.na853);
      form.setValue("expenditure_type", selectedProject.expenditure_type);
    }
  }, [form.watch("project_id"), projects, form]);

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
          ...data,
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

  const addRecipient = () => {
    const recipients = form.getValues("recipients");
    form.setValue("recipients", [
      ...recipients,
      { firstname: "", lastname: "", afm: "", amount: 0, installment: 1 }
    ]);
  };

  const removeRecipient = (index: number) => {
    const recipients = form.getValues("recipients");
    recipients.splice(index, 1);
    form.setValue("recipients", [...recipients]);
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Μονάδα</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Επιλέξτε μονάδα..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNITS.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
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
                name="expenditure_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Τύπος Δαπάνης</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Επιλέξτε τύπο δαπάνης..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EXPENDITURE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
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
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Έργο</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Επιλέξτε έργο..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.mis} value={project.mis}>
                          {project.mis} - {project.na853}
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

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <FormLabel>Δικαιούχοι</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addRecipient}
                >
                  Προσθήκη Δικαιούχου
                </Button>
              </div>

              {form.watch("recipients").map((recipient, index) => (
                <div key={index} className="space-y-4 p-4 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Δικαιούχος #{index + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeRecipient(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Διαγραφή
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`recipients.${index}.firstname`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Όνομα</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`recipients.${index}.lastname`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Επώνυμο</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name={`recipients.${index}.afm`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ΑΦΜ</FormLabel>
                          <FormControl>
                            <Input {...field} maxLength={9} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`recipients.${index}.amount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ποσό</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`recipients.${index}.installment`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Δόση</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min="1"
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>

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