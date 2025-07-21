import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Save, X, User, Euro, Hash, FileText, Calendar } from "lucide-react";
import type { GeneratedDocument } from "@shared/schema";

// Define the edit form schema
const editDocumentSchema = z.object({
  protocol_number_input: z.string().optional(),
  protocol_date: z.string().optional(),
  status: z.enum(["draft", "pending", "approved", "rejected", "completed"]),
  comments: z.string().optional(),
  total_amount: z.number().min(0),
  esdian_field1: z.string().optional(),
  esdian_field2: z.string().optional(),
  is_correction: z.boolean().default(false),
  original_protocol_number: z.string().optional(),
  original_protocol_date: z.string().optional(),
});

type EditDocumentForm = z.infer<typeof editDocumentSchema>;

interface EditDocumentModalProps {
  document: GeneratedDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS = [
  { value: "draft", label: "Προσχέδιο", color: "bg-gray-100 text-gray-800" },
  { value: "pending", label: "Εκκρεμεί", color: "bg-yellow-100 text-yellow-800" },
  { value: "approved", label: "Εγκεκριμένο", color: "bg-green-100 text-green-800" },
  { value: "rejected", label: "Απορρίφθηκε", color: "bg-red-100 text-red-800" },
  { value: "completed", label: "Ολοκληρώθηκε", color: "bg-blue-100 text-blue-800" },
];

export function EditDocumentModal({ document, open, onOpenChange }: EditDocumentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form with document data
  const form = useForm<EditDocumentForm>({
    resolver: zodResolver(editDocumentSchema),
    defaultValues: {
      protocol_number_input: "",
      protocol_date: "",
      status: "draft",
      comments: "",
      total_amount: 0,
      esdian_field1: "",
      esdian_field2: "",
      is_correction: false,
      original_protocol_number: "",
      original_protocol_date: "",
    },
  });

  // Get recipients data to show in the form
  const recipients = useMemo(() => {
    if (!document?.recipients) return [];
    
    try {
      if (typeof document.recipients === 'string') {
        return JSON.parse(document.recipients);
      } else if (Array.isArray(document.recipients)) {
        return document.recipients;
      }
    } catch (error) {
      console.error('Error parsing recipients:', error);
    }
    
    return [];
  }, [document?.recipients]);

  // Calculate total amount from recipients
  const calculatedTotal = useMemo(() => {
    return recipients.reduce((sum: number, recipient: any) => {
      return sum + (parseFloat(recipient.amount) || 0);
    }, 0);
  }, [recipients]);

  // Reset form when document changes
  useEffect(() => {
    if (document && open) {
      const protocolDate = document.protocol_date 
        ? new Date(document.protocol_date).toISOString().split('T')[0] 
        : "";

      const originalProtocolDate = document.original_protocol_date
        ? new Date(document.original_protocol_date).toISOString().split('T')[0]
        : "";

      // Extract ESDIAN fields
      let esdianField1 = "";
      let esdianField2 = "";
      
      if (document.esdian && Array.isArray(document.esdian)) {
        esdianField1 = document.esdian[0] || "";
        esdianField2 = document.esdian[1] || "";
      }

      form.reset({
        protocol_number_input: document.protocol_number_input || "",
        protocol_date: protocolDate,
        status: (document.status as any) || "draft",
        comments: document.comments || "",
        total_amount: calculatedTotal || parseFloat(document.total_amount?.toString() || "0") || 0,
        esdian_field1: esdianField1,
        esdian_field2: esdianField2,
        is_correction: Boolean(document.is_correction),
        original_protocol_number: document.original_protocol_number || "",
        original_protocol_date: originalProtocolDate,
      });
    }
  }, [document, open, form, calculatedTotal]);

  // Update document mutation
  const updateMutation = useMutation({
    mutationFn: async (data: EditDocumentForm) => {
      if (!document?.id) throw new Error("No document ID");

      // Prepare the update payload
      const payload = {
        protocol_number_input: data.protocol_number_input || null,
        protocol_date: data.protocol_date || null,
        status: data.status,
        comments: data.comments || null,
        total_amount: data.total_amount,
        esdian: [data.esdian_field1, data.esdian_field2].filter(Boolean),
        is_correction: data.is_correction,
        original_protocol_number: data.original_protocol_number || null,
        original_protocol_date: data.original_protocol_date || null,
        updated_at: new Date().toISOString(),
      };

      return await apiRequest(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast({
        title: "Επιτυχία",
        description: "Το έγγραφο ενημερώθηκε επιτυχώς",
      });
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Error updating document:", error);
      toast({
        title: "Σφάλμα",
        description: error?.message || "Παρουσιάστηκε σφάλμα κατά την ενημέρωση του εγγράφου",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: EditDocumentForm) => {
    setIsLoading(true);
    updateMutation.mutate(data);
    setIsLoading(false);
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  const currentStatus = form.watch("status");
  const statusOption = STATUS_OPTIONS.find(option => option.value === currentStatus);

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Επεξεργασία Εγγράφου #{document.id}
          </DialogTitle>
          <DialogDescription>
            Επεξεργασία στοιχείων και μεταδεδομένων του εγγράφου
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            
            {/* Document Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Στοιχεία Εγγράφου
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="protocol_number_input"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Αριθμός Πρωτοκόλλου</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="π.χ. 12345/2025"
                            {...field}
                          />
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
                        <FormLabel>Ημερομηνία Πρωτοκόλλου</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Κατάσταση</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Επιλέξτε κατάσταση">
                                {statusOption && (
                                  <Badge className={statusOption.color}>
                                    {statusOption.label}
                                  </Badge>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <Badge className={option.color}>
                                  {option.label}
                                </Badge>
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
                    name="total_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Euro className="w-4 h-4" />
                          Συνολικό Ποσό
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Εσωτερική Διανομή Fields Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Πεδία Εσωτερικής Διανομής</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="esdian_field1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Εσωτερική Διανομή Πεδίο 1</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Πρώτο πεδίο εσωτερικής διανομής"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="esdian_field2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Εσωτερική Διανομή Πεδίο 2</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Δεύτερο πεδίο εσωτερικής διανομής"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Correction Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Πληροφορίες Διόρθωσης
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="is_correction"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal">
                        Αυτό το έγγραφο είναι διόρθωση προηγούμενου εγγράφου
                      </FormLabel>
                    </FormItem>
                  )}
                />

                {form.watch("is_correction") && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <FormField
                      control={form.control}
                      name="original_protocol_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Αρχικός Αριθμός Πρωτοκόλλου</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Αρχικός αριθμός πρωτοκόλλου"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="original_protocol_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Αρχική Ημερομηνία Πρωτοκόλλου</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Comments Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Σχόλια</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="comments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Παρατηρήσεις/Σχόλια</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Προσθέστε παρατηρήσεις ή σχόλια για το έγγραφο..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Recipients Summary Card */}
            {recipients.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Δικαιούχοι ({recipients.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {recipients.slice(0, 3).map((recipient: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div>
                          <span className="font-medium">
                            {recipient.lastname} {recipient.firstname}
                          </span>
                          <span className="text-sm text-gray-500 ml-2">
                            ΑΦΜ: {recipient.afm}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium text-green-600">
                            {new Intl.NumberFormat('el-GR', {
                              style: 'currency',
                              currency: 'EUR'
                            }).format(recipient.amount || 0)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {recipients.length > 3 && (
                      <div className="text-sm text-gray-500 text-center py-2">
                        ... και {recipients.length - 3} ακόμη δικαιούχοι
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <Button type="button" variant="outline" onClick={handleClose}>
                <X className="w-4 h-4 mr-2" />
                Άκυρο
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading || updateMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {(isLoading || updateMutation.isPending) ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Αποθήκευση
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}