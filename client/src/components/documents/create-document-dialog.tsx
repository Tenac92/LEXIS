import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { createClient } from '@supabase/supabase-js';
import type { BudgetValidationResponse } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL and Key must be defined in environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

interface Project {
  id: string;
  name: string;
  expenditure_types: string[];
}

interface BudgetData {
  current_budget: number;
  total_budget: number;
  annual_budget: number;
  katanomes_etous: number;
}

interface BudgetIndicatorProps {
  budgetData: BudgetData;
  currentAmount: number;
}

const BudgetIndicator: React.FC<BudgetIndicatorProps> = ({ budgetData, currentAmount }) => {
  const availableBudget = budgetData.current_budget - currentAmount;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl border border-blue-100/50 shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div>
          <h3 className="text-sm font-medium text-gray-600">Available Budget</h3>
          <p className="text-2xl font-bold text-blue-600">
            {availableBudget.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-600">Total Budget</h3>
          <p className="text-2xl font-bold text-gray-700">
            {budgetData.total_budget.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-600">Annual Allocation</h3>
          <p className="text-2xl font-bold text-gray-700">
            {budgetData.katanomes_etous.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
      </div>
    </div>
  );
};

interface Attachment {
  id: string;
  name: string;
  type: string;
  description?: string;
}

const createDocumentSchema = z.object({
  unit: z.string().min(1, "Unit is required"),
  project_id: z.string().min(1, "Project is required"),
  expenditure_type: z.string().min(1, "Expenditure type is required"),
  recipients: z.array(z.object({
    firstname: z.string().min(2, "First name must be at least 2 characters"),
    lastname: z.string().min(2, "Last name must be at least 2 characters"),
    afm: z.string().length(9, "AFM must be exactly 9 digits"),
    amount: z.number().min(0.01, "Amount must be greater than 0"),
    installment: z.number().int().min(1).max(12, "Installment must be between 1 and 12")
  })).min(1, "At least one recipient is required"),
  total_amount: z.number().min(0.01, "Total amount must be greater than 0"),
  status: z.string().default("draft"),
  selectedAttachments: z.array(z.string()).default([])
});

type CreateDocumentForm = z.infer<typeof createDocumentSchema>;

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateDocumentDialog({ open, onOpenChange }: CreateDocumentDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreateDocumentForm>({
    resolver: zodResolver(createDocumentSchema),
    defaultValues: {
      unit: "",
      project_id: "",
      expenditure_type: "",
      recipients: [],
      status: "draft",
      selectedAttachments: []
    }
  });

  const selectedUnit = form.watch("unit");
  const selectedProjectId = form.watch("project_id");
  const recipients = form.watch("recipients") || [];

  const currentAmount = recipients.reduce((sum, r) => {
    return sum + (typeof r.amount === 'number' ? r.amount : 0);
  }, 0);

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('unit_det')
          .select('unit, unit_name')
          .order('unit');

        if (error) {
          console.error('Error fetching units:', error);
          toast({
            title: "Error",
            description: "Failed to load units. Please try again.",
            variant: "destructive"
          });
          throw error;
        }

        return data.map((item: any) => ({
          id: item.unit,
          name: item.unit_name
        }));
      } catch (error) {
        console.error('Units fetch error:', error);
        throw error;
      }
    },
    retry: 2
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["projects", selectedUnit],
    queryFn: async () => {
      if (!selectedUnit) return [];

      try {
        const { data, error } = await supabase
          .from('project_catalog')
          .select('mis, na853, event_description, project_title, expenditure_type')
          .contains('implementing_agency', [selectedUnit])
          .order('mis');

        if (error) {
          console.error('Error fetching projects:', error);
          toast({
            title: "Error",
            description: "Failed to load projects. Please try again.",
            variant: "destructive"
          });
          throw error;
        }

        return data.map((item: any) => {
          let expenditureTypes: string[] = [];
          try {
            if (item.expenditure_type) {
              if (Array.isArray(item.expenditure_type)) {
                expenditureTypes = item.expenditure_type;
              } else if (typeof item.expenditure_type === 'string') {
                expenditureTypes = item.expenditure_type
                  .replace(/[{}]/g, '')
                  .split(',')
                  .map((type: string) => type.trim())
                  .filter(Boolean);
              }
            }
          } catch (e) {
            console.error('Error parsing expenditure types:', e, item);
          }

          return {
            id: item.mis.toString(),
            name: `${item.na853} - ${item.event_description || item.project_title || 'No description'}`,
            expenditure_types: expenditureTypes
          };
        });

      } catch (error) {
        console.error('Projects fetch error:', error);
        throw error;
      }
    },
    enabled: Boolean(selectedUnit),
    retry: 2
  });

  const { data: budgetData, error: budgetError } = useQuery({
    queryKey: ["budget", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return null;

      try {
        const { data: budgetData, error } = await supabase
          .from('budget_na853_split')
          .select('user_view, proip, ethsia_pistosi, katanomes_etous')
          .eq('mis', selectedProjectId)
          .single();

        if (error) throw error;
        if (!budgetData) throw new Error('Budget data not found');

        return {
          current_budget: parseFloat(budgetData.user_view?.toString() || '0'),
          total_budget: parseFloat(budgetData.proip?.toString() || '0'),
          annual_budget: parseFloat(budgetData.ethsia_pistosi?.toString() || '0'),
          katanomes_etous: parseFloat(budgetData.katanomes_etous?.toString() || '0')
        };
      } catch (error) {
        console.error('Budget fetch error:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load budget information.",
          variant: "destructive"
        });
        return null;
      }
    },
    enabled: Boolean(selectedProjectId)
  });

  const { data: attachments = [], isLoading: attachmentsLoading } = useQuery({
    queryKey: ['attachments'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('attachments')
          .select('*')
          .order('name');

        if (error) throw error;
        return data as Attachment[];
      } catch (error) {
        console.error('Error fetching attachments:', error);
        throw error;
      }
    }
  });

  const { data: validationResult } = useQuery<BudgetValidationResponse>({
    queryKey: ["budget-validation", selectedProjectId, currentAmount],
    queryFn: async () => {
      if (!selectedProjectId || currentAmount <= 0) {
        return { status: 'success', canCreate: true };
      }

      try {
        return await apiRequest<BudgetValidationResponse>('/api/budget/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mis: selectedProjectId,
            amount: currentAmount
          })
        });
      } catch (error) {
        console.error('Budget validation error:', error);
        throw error;
      }
    },
    enabled: Boolean(selectedProjectId) && currentAmount > 0
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const onSubmit = async (data: CreateDocumentForm) => {
    try {
      if (!selectedProjectId) {
        toast({
          title: "Error",
          description: "Project must be selected",
          variant: "destructive"
        });
        return;
      }

      if (!data.recipients?.length) {
        toast({
          title: "Error",
          description: "At least one recipient is required",
          variant: "destructive"
        });
        return;
      }

      const totalAmount = data.recipients.reduce((sum, r) => sum + r.amount, 0);

      const payload = {
        unit: data.unit,
        project_id: data.project_id,
        expenditure_type: data.expenditure_type,
        recipients: data.recipients.map(r => ({
          firstname: r.firstname,
          lastname: r.lastname,
          afm: r.afm,
          amount: r.amount.toString(),
          installment: r.installment
        })),
        total_amount: totalAmount.toString(),
        status: "draft",
        attachments: data.selectedAttachments
      };

      console.log('Creating document with payload:', payload);

      const response = await apiRequest('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      await queryClient.invalidateQueries({ queryKey: ["budget", data.project_id] });

      toast({ title: "Success", description: "Document created successfully" });

      onOpenChange(false);
      form.reset();
      setCurrentStep(0);
    } catch (error) {
      console.error('Document creation error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create document",
        variant: "destructive"
      });
    }
  };

  const addRecipient = () => {
    const currentRecipients = form.watch("recipients") || [];
    if (currentRecipients.length >= 10) {
      toast({
        title: "Error",
        description: "Maximum 10 recipients allowed",
        variant: "destructive"
      });
      return;
    }

    form.setValue("recipients", [
      ...currentRecipients,
      { firstname: "", lastname: "", afm: "", amount: 0, installment: 1 }
    ]);
  };

  const removeRecipient = (index: number) => {
    const currentRecipients = form.watch("recipients") || [];
    form.setValue("recipients", currentRecipients.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (selectedUnit) {
      form.setValue("project_id", "");
      form.setValue("expenditure_type", "");
    }
  }, [selectedUnit, form]);

  useEffect(() => {
    if (selectedProjectId) {
      form.setValue("expenditure_type", "");
    }
  }, [selectedProjectId, form]);

  const handleNext = async () => {
    if (currentStep === 1) {
      const isValid = await form.trigger(["project_id", "expenditure_type"]);

      if (!isValid) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive"
        });
        return;
      }

      if (!selectedProject?.expenditure_types?.length) {
        toast({
          title: "Error",
          description: "Selected project has no expenditure types available",
          variant: "destructive"
        });
        return;
      }
    }

    if (currentStep < 3) {
      const isValid = await form.trigger(
        currentStep === 0 ? ["unit"] :
          currentStep === 1 ? ["project_id", "expenditure_type"] :
            ["recipients"]
      );

      if (isValid) {
        setCurrentStep((prev) => prev + 1);
      }
    } else {
      form.handleSubmit(onSubmit)();
    }
  };

  // Return dialog JSX
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create New Document</DialogTitle>
          <DialogDescription>
            Step {currentStep + 1} of 4: {
              currentStep === 0 ? "Select Unit" :
                currentStep === 1 ? "Choose Project" :
                  currentStep === 2 ? "Add Recipients" :
                    "Select Attachments"
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {currentStep === 0 && (
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={unitsLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units.map((unit: any) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                {budgetData && (
                  <BudgetIndicator
                    budgetData={budgetData}
                    currentAmount={currentAmount}
                  />
                )}

                <FormField
                  control={form.control}
                  name="project_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!selectedUnit || projectsLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedProject && (
                  <FormField
                    control={form.control}
                    name="expenditure_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expenditure Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!selectedProject?.expenditure_types?.length}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select expenditure type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {selectedProject?.expenditure_types?.map((type: string) => (
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
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                {budgetData && (
                  <BudgetIndicator
                    budgetData={budgetData}
                    currentAmount={currentAmount}
                  />
                )}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-medium">Recipients</h3>
                      <p className="text-sm text-gray-500">Add up to 10 recipients</p>
                    </div>
                    <Button
                      type="button"
                      onClick={addRecipient}
                      disabled={recipients.length >= 10}
                    >
                      Add Recipient
                    </Button>
                  </div>

                  {recipients.map((_, index) => (
                    <div key={index} className="grid grid-cols-6 gap-4 p-4 border rounded-lg">
                      <FormField
                        control={form.control}
                        name={`recipients.${index}.firstname`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
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
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`recipients.${index}.afm`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>AFM</FormLabel>
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
                            <FormLabel>Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
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
                            <FormLabel>Installment</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                                min={1}
                                max={12}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => removeRecipient(index)}
                        className="mt-8"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Select Attachments</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose the attachments to include in the document
                  </p>
                </div>

                {attachmentsLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <span className="loading loading-spinner loading-md"></span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-start space-x-3">
                        <Checkbox
                          checked={form.watch("selectedAttachments").includes(attachment.id)}
                          onCheckedChange={(checked) => {
                            const currentSelected = form.watch("selectedAttachments");
                            if (checked) {
                              form.setValue("selectedAttachments", [...currentSelected, attachment.id]);
                            } else {
                              form.setValue(
                                "selectedAttachments",
                                currentSelected.filter(id => id !== attachment.id)
                              );
                            }
                          }}
                          id={`attachment-${attachment.id}`}
                        />
                        <div className="space-y-1">
                          <label
                            htmlFor={`attachment-${attachment.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {attachment.name}
                          </label>
                          {attachment.description && (
                            <p className="text-sm text-muted-foreground">
                              {attachment.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}
                disabled={currentStep === 0}
              >
                Previous
              </Button>
              <Button
                type="button"
                onClick={handleNext}
              >
                {currentStep === 3 ? "Create Document" : "Next"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}