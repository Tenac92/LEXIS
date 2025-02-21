import { useState } from "react";
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
import type { BudgetValidationResponse } from "@shared/schema";

interface Unit {
  id: string;
  name: string;
}

// Form Schema
const createDocumentSchema = z.object({
  unit: z.string().min(1, "Unit is required"),
  project_id: z.string().min(1, "Project is required"),
  expenditure_type: z.string().min(1, "Expenditure type is required"),
  recipients: z.array(z.object({
    firstname: z.string().min(2, "First name must be at least 2 characters"),
    lastname: z.string().min(2, "Last name must be at least 2 characters"),
    afm: z.string().length(9, "AFM must be exactly 9 digits"),
    amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
    installment: z.coerce.number().int().min(1).max(12, "Installment must be between 1 and 12")
  })).min(1, "At least one recipient is required"),
  total_amount: z.coerce.number().min(0.01, "Total amount must be greater than 0"),
  status: z.string().default("draft")
});

type CreateDocumentForm = z.infer<typeof createDocumentSchema>;

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Budget Indicator Component
const BudgetIndicator = ({ currentBudget, totalBudget, annualBudget, currentAmount }: {
  currentBudget: number;
  totalBudget: number;
  annualBudget: number;
  currentAmount: number;
}) => {
  const availableBudget = currentBudget - currentAmount;

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
            {totalBudget.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-600">Annual Budget</h3>
          <p className="text-2xl font-bold text-gray-700">
            {annualBudget.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
      </div>
    </div>
  );
};

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
      total_amount: 0,
      status: "draft"
    }
  });

  const selectedUnit = form.watch("unit");
  const selectedProjectId = form.watch("project_id");
  const recipients = form.watch("recipients") || [];
  const currentAmount = recipients.reduce((sum, r) => sum + (typeof r.amount === 'number' ? r.amount : 0), 0);

  // Fetch units with proper typing
  const { data: units = [], isLoading: unitsLoading } = useQuery<Unit[]>({
    queryKey: ["units"],
    queryFn: async () => {
      try {
        const response = await apiRequest("/api/units");
        if (!response.ok) {
          throw new Error("Failed to fetch units");
        }
        const data = await response.json();
        return data.map((unit: any) => ({
          id: unit.id || unit.unit,
          name: unit.name || unit.unit_name
        }));
      } catch (error) {
        console.error('Failed to fetch units:', error);
        toast({
          title: "Error",
          description: "Failed to load units. Please try again.",
          variant: "destructive"
        });
        throw error;
      }
    }
  });

  // Fetch projects based on selected unit
  const { data: projects = [] } = useQuery({
    queryKey: ["projects", selectedUnit],
    queryFn: async () => {
      if (!selectedUnit) return [];
      const response = await apiRequest(`/api/projects?unit=${selectedUnit}`);
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json();
    },
    enabled: Boolean(selectedUnit)
  });

  // Fetch budget data
  const { data: budget } = useQuery({
    queryKey: ["budget", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return null;
      const response = await apiRequest(`/api/budget/${selectedProjectId}`);
      if (!response.ok) throw new Error("Failed to fetch budget");
      return response.json();
    },
    enabled: Boolean(selectedProjectId)
  });

  // Validate budget
  const { data: validationResult } = useQuery<BudgetValidationResponse>({
    queryKey: ["budget-validation", selectedProjectId, currentAmount],
    queryFn: async () => {
      if (!selectedProjectId || currentAmount <= 0) {
        return { status: 'success', canCreate: true };
      }
      const response = await apiRequest('/api/budget/validate', {
        method: 'POST',
        body: JSON.stringify({ mis: selectedProjectId, amount: currentAmount })
      });
      if (!response.ok) throw new Error("Budget validation failed");
      return response.json();
    },
    enabled: Boolean(selectedProjectId) && currentAmount > 0
  });

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

  const onSubmit = async (data: CreateDocumentForm) => {
    try {
      // Calculate total amount
      const totalAmount = data.recipients.reduce((sum, r) => sum + r.amount, 0);
      data.total_amount = totalAmount;

      const response = await apiRequest('/api/documents', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create document");
      }

      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      await queryClient.invalidateQueries({ queryKey: ["budget", data.project_id] });

      toast({
        title: "Success",
        description: "Document created successfully"
      });

      onOpenChange(false);
      form.reset();
      setCurrentStep(0);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create document",
        variant: "destructive"
      });
    }
  };

  const handleNext = async () => {
    const isValid = await form.trigger(
      currentStep === 0 ? ["unit"] :
        currentStep === 1 ? ["project_id", "expenditure_type"] :
          undefined
    );

    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (currentStep === 2) {
      await form.handleSubmit(onSubmit)();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create New Document</DialogTitle>
          <DialogDescription>
            Step {currentStep + 1} of 3: {
              currentStep === 0 ? "Select Unit" :
                currentStep === 1 ? "Choose Project" :
                  "Add Recipients"
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-6">
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
                        {units.map((unit) => (
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
                {budget && (
                  <BudgetIndicator
                    currentBudget={budget.current_budget}
                    totalBudget={budget.total_budget}
                    annualBudget={budget.annual_budget}
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
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects.map((project: any) => (
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

                <FormField
                  control={form.control}
                  name="expenditure_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expenditure Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects.find((p: any) => p.id === selectedProjectId)?.expenditure_types?.map((type: string) => (
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
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                {budget && (
                  <BudgetIndicator
                    currentBudget={budget.current_budget}
                    totalBudget={budget.total_budget}
                    annualBudget={budget.annual_budget}
                    currentAmount={currentAmount}
                  />
                )}

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
            )}

            <div className="flex justify-between pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                disabled={currentStep === 0}
              >
                Previous
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                disabled={
                  (currentStep === 2 && recipients.length === 0) ||
                  form.formState.isSubmitting
                }
              >
                {currentStep === 2
                  ? (form.formState.isSubmitting ? "Creating..." : "Create Document")
                  : "Next"
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}