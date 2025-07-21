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
import { Loader2, Save, X, User, Euro, Hash, FileText, Calendar, Plus, Trash2, Users } from "lucide-react";
import type { GeneratedDocument } from "@shared/schema";

// Define recipient schema for beneficiary editing
const recipientSchema = z.object({
  firstname: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  lastname: z.string().min(1, "Το επώνυμο είναι υποχρεωτικό"),
  fathername: z.string().optional(),
  afm: z.string().min(9, "Το ΑΦΜ πρέπει να έχει 9 ψηφία").max(9, "Το ΑΦΜ πρέπει να έχει 9 ψηφία"),
  amount: z.number().min(0.01, "Το ποσό πρέπει να είναι μεγαλύτερο από 0"),
  installment: z.string().default("ΕΦΑΠΑΞ"),
  installments: z.array(z.string()).default(["ΕΦΑΠΑΞ"]),
  installmentAmounts: z.record(z.string(), z.number()).default({ ΕΦΑΠΑΞ: 0 }),
});

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
  recipients: z.array(recipientSchema).min(1, "Πρέπει να υπάρχει τουλάχιστον ένας δικαιούχος"),
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
      status: "pending",
      comments: "",
      total_amount: 0,
      esdian_field1: "",
      esdian_field2: "",
      is_correction: false,
      original_protocol_number: "",
      original_protocol_date: "",
      recipients: [],
    },
  });

  // Fetch beneficiary payments for this document
  const { data: beneficiaryPayments, refetch: refetchPayments } = useQuery({
    queryKey: ['/api/documents', document?.id, 'beneficiaries'],
    queryFn: async () => {
      if (!document?.id) return [];
      const response = await apiRequest(`/api/documents/${document.id}/beneficiaries`);
      return response || [];
    },
    enabled: !!document?.id && open,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Convert beneficiary payments to recipients format for the form
  const recipients = useMemo(() => {
    if (!beneficiaryPayments?.length) return [];
    
    return beneficiaryPayments.map((payment: any) => ({
      id: payment.id,
      beneficiary_id: payment.beneficiary_id,
      firstname: payment.beneficiaries?.name || '',
      lastname: payment.beneficiaries?.surname || '',
      fathername: payment.beneficiaries?.fathername || '',
      afm: payment.beneficiaries?.afm || '',
      amount: parseFloat(payment.amount) || 0,
      installment: payment.installment || 'ΕΦΑΠΑΞ',
      installments: [payment.installment || 'ΕΦΑΠΑΞ'],
      installmentAmounts: { [payment.installment || 'ΕΦΑΠΑΞ']: parseFloat(payment.amount) || 0 },
      status: payment.status || 'pending',
    }));
  }, [beneficiaryPayments]);

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
        recipients: recipients.length > 0 ? recipients : [{ 
          firstname: "", 
          lastname: "", 
          fathername: "", 
          afm: "", 
          amount: 0, 
          installment: "ΕΦΑΠΑΞ", 
          installments: ["ΕΦΑΠΑΞ"], 
          installmentAmounts: { ΕΦΑΠΑΞ: 0 } 
        }],
      });
    }
  }, [document, open, form, calculatedTotal, recipients]);

  // Update document and beneficiaries mutation
  const updateMutation = useMutation({
    mutationFn: async (data: EditDocumentForm) => {
      if (!document?.id) throw new Error("No document ID");

      // Prepare the document update payload
      const documentPayload = {
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

      // Update document first
      const documentResult = await apiRequest(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(documentPayload),
      });

      // Update beneficiaries if they exist and have been modified
      if (data.recipients && data.recipients.length > 0 && data.recipients.some(r => r.id)) {
        await apiRequest(`/api/documents/${document.id}/beneficiaries`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ recipients: data.recipients }),
        });
      }

      return documentResult;
    },
    onSuccess: () => {
      toast({
        title: "Επιτυχία",
        description: "Το έγγραφο και οι δικαιούχοι ενημερώθηκαν επιτυχώς",
      });
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents', document?.id, 'beneficiaries'] });
      refetchPayments();
      
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

            {/* Beneficiaries Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Διαχείριση Δικαιούχων
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="recipients"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Δικαιούχοι Εγγράφου</FormLabel>
                      <div className="space-y-4">
                        {field.value?.map((recipient: any, index: number) => (
                          <div key={index} className="p-4 border rounded-lg bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div>
                                <label className="text-sm font-medium">Όνομα *</label>
                                <Input
                                  value={recipient.firstname || ''}
                                  onChange={(e) => {
                                    const newRecipients = [...field.value];
                                    newRecipients[index] = { ...newRecipients[index], firstname: e.target.value };
                                    field.onChange(newRecipients);
                                  }}
                                  placeholder="Όνομα δικαιούχου"
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium">Επώνυμο *</label>
                                <Input
                                  value={recipient.lastname || ''}
                                  onChange={(e) => {
                                    const newRecipients = [...field.value];
                                    newRecipients[index] = { ...newRecipients[index], lastname: e.target.value };
                                    field.onChange(newRecipients);
                                  }}
                                  placeholder="Επώνυμο δικαιούχου"
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium">Πατρώνυμο</label>
                                <Input
                                  value={recipient.fathername || ''}
                                  onChange={(e) => {
                                    const newRecipients = [...field.value];
                                    newRecipients[index] = { ...newRecipients[index], fathername: e.target.value };
                                    field.onChange(newRecipients);
                                  }}
                                  placeholder="Πατρώνυμο"
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium">ΑΦΜ *</label>
                                <Input
                                  value={recipient.afm || ''}
                                  onChange={(e) => {
                                    const newRecipients = [...field.value];
                                    newRecipients[index] = { ...newRecipients[index], afm: e.target.value };
                                    field.onChange(newRecipients);
                                  }}
                                  placeholder="123456789"
                                  maxLength={9}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium">Ποσό (€) *</label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={recipient.amount || ''}
                                  onChange={(e) => {
                                    const newRecipients = [...field.value];
                                    newRecipients[index] = { ...newRecipients[index], amount: parseFloat(e.target.value) || 0 };
                                    field.onChange(newRecipients);
                                  }}
                                  placeholder="0.00"
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium">Δόση</label>
                                <Select
                                  value={recipient.installment || 'ΕΦΑΠΑΞ'}
                                  onValueChange={(value) => {
                                    const newRecipients = [...field.value];
                                    newRecipients[index] = { ...newRecipients[index], installment: value };
                                    field.onChange(newRecipients);
                                  }}
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ΕΦΑΠΑΞ">ΕΦΑΠΑΞ</SelectItem>
                                    <SelectItem value="ΤΡΙΜΗΝΟ 1">ΤΡΙΜΗΝΟ 1</SelectItem>
                                    <SelectItem value="ΤΡΙΜΗΝΟ 2">ΤΡΙΜΗΝΟ 2</SelectItem>
                                    <SelectItem value="ΤΡΙΜΗΝΟ 3">ΤΡΙΜΗΝΟ 3</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            {field.value.length > 1 && (
                              <div className="flex justify-end mt-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const newRecipients = field.value.filter((_: any, i: number) => i !== index);
                                    field.onChange(newRecipients);
                                  }}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Αφαίρεση
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                        
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const newRecipients = [...(field.value || []), {
                              firstname: "",
                              lastname: "",
                              fathername: "",
                              afm: "",
                              amount: 0,
                              installment: "ΕΦΑΠΑΞ",
                              installments: ["ΕΦΑΠΑΞ"],
                              installmentAmounts: { ΕΦΑΠΑΞ: 0 }
                            }];
                            field.onChange(newRecipients);
                          }}
                          className="w-full"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Προσθήκη Δικαιούχου
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Summary Information */}
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium">Σύνολο Δικαιούχων:</span>
                    <span>{form.watch('recipients')?.length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-1">
                    <span className="font-medium">Συνολικό Ποσό:</span>
                    <span>{(form.watch('recipients')?.reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0) || 0).toFixed(2)} €</span>
                  </div>
                </div>
              </CardContent>
            </Card>

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