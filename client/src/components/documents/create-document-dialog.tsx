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

// Define strict types for API responses
interface Unit {
  id: string;
  name: string;
}

interface Project {
  id: string;
  mis: string | null;
  na853: string;
  event_description: string;
  budget_na853: number;
  expenditure_type: string[];
}

interface BudgetData {
  user_view: number;
  ethsia_pistosi: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  total_spent: number;
  current_budget: number;
}

// Form Schema with strict validation
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
  status: z.string().default("draft")
});

type CreateDocumentForm = z.infer<typeof createDocumentSchema>;

const steps = ["Unit Selection", "Project Details", "Recipients"];

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
      status: "draft"
    }
  });

  const selectedUnit = form.watch("unit");
  const selectedProjectId = form.watch("project_id");

  // Query units
  const { data: units = [], isLoading: unitsLoading } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    enabled: currentStep === 0
  });

  // Query projects based on selected unit
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/catalog", selectedUnit],
    queryFn: async () => {
      if (!selectedUnit) return [];
      const response = await fetch(`/api/catalog?unit=${encodeURIComponent(selectedUnit)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch projects');
      }
      return response.json();
    },
    enabled: Boolean(selectedUnit)
  });

  // Get selected project
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // Reset expenditure type when project changes
  useEffect(() => {
    if (selectedProject) {
      form.setValue("expenditure_type", "");
    }
  }, [selectedProject, form]);

  // Query expenditure types based on selected project
  const { data: expenditureTypes = [], isLoading: expenditureTypesLoading } = useQuery<string[]>({
    queryKey: ["expenditureTypes", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const project = projects.find(p => p.id === selectedProjectId);
      return project?.expenditure_type || [];
    },
    enabled: Boolean(selectedProjectId && projects.length > 0)
  });


  // Query budget data based on selected project
  const { data: budgetData } = useQuery<BudgetData>({
    queryKey: ["/api/budget", selectedProjectId],
    enabled: Boolean(selectedProjectId)
  });

  // Reset project-related fields when unit changes
  useEffect(() => {
    if (!selectedUnit) {
      form.setValue("project_id", "");
      form.setValue("expenditure_type", "");
    }
  }, [selectedUnit, form]);

  const onSubmit = async (data: CreateDocumentForm) => {
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          total_amount: data.recipients.reduce((sum, r) => sum + r.amount, 0)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create document');
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/documents'] });

      toast({
        title: "Success",
        description: "Document created successfully",
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Submission error:', error);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create New Document</DialogTitle>
          <DialogDescription>
            Step {currentStep + 1} of {steps.length}: {steps[currentStep]}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Unit Selection Step */}
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

            {/* Project Selection Step */}
            {currentStep === 1 && (
              <div className="space-y-4">
                {budgetData && (
                  <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl border border-blue-100/50 shadow-lg">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-600">Available Budget</h3>
                        <p className="text-2xl font-bold text-blue-600">
                          {budgetData.current_budget.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-600">Total Budget</h3>
                        <p className="text-2xl font-bold text-gray-700">
                          {budgetData.user_view.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-600">Annual Budget</h3>
                        <p className="text-2xl font-bold text-gray-700">
                          {budgetData.ethsia_pistosi.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
                        </p>
                      </div>
                    </div>
                  </div>
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
                          {projectsLoading ? (
                            <SelectItem value="loading">Loading projects...</SelectItem>
                          ) : projects.length === 0 ? (
                            <SelectItem value="none">No projects available</SelectItem>
                          ) : (
                            projects.map((project) => (
                              <SelectItem 
                                key={project.id} 
                                value={project.id}
                              >
                                {project.na853
                                  ? `${project.na853} - ${project.event_description}`
                                  : project.event_description || "Untitled Project"}
                              </SelectItem>
                            ))
                          )}
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
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {selectedProject.expenditure_type.map((type) => (
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

            {/* Recipients Step */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium">Recipients</h3>
                    <p className="text-sm text-gray-500">Add up to 10 recipients</p>
                  </div>
                  <Button
                    type="button"
                    onClick={addRecipient}
                    disabled={form.watch("recipients")?.length >= 10}
                  >
                    Add Recipient
                  </Button>
                </div>

                {form.watch("recipients")?.map((recipient, index) => (
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

            {/* Navigation Buttons */}
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
                onClick={() => {
                  if (currentStep < steps.length - 1) {
                    setCurrentStep((prev) => prev + 1);
                  } else {
                    form.handleSubmit(onSubmit)();
                  }
                }}
              >
                {currentStep === steps.length - 1 ? "Create Document" : "Next"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}