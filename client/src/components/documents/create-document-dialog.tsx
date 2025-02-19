import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

// Types
interface Unit {
  id: string;
  name: string;
}

interface Project {
  id: string;
  mis: string;
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

// Form Schema
const createDocumentSchema = z.object({
  unit: z.string().min(1, "Unit is required"),
  project: z.string().min(1, "Project is required"),
  expenditure_type: z.string().min(1, "Expenditure type is required"),
  recipients: z.array(z.object({
    firstname: z.string().min(2, "First name must be at least 2 characters"),
    lastname: z.string().min(2, "Last name must be at least 2 characters"),
    afm: z.string().length(9, "AFM must be exactly 9 digits"),
    amount: z.number().min(0.01, "Amount must be greater than 0"),
    installment: z.number().min(1).max(12, "Installment must be between 1 and 12")
  })).min(1, "At least one recipient is required")
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

  // Form setup
  const form = useForm<CreateDocumentForm>({
    resolver: zodResolver(createDocumentSchema),
    defaultValues: {
      unit: "",
      project: "",
      expenditure_type: "",
      recipients: []
    }
  });

  // Watch form values
  const selectedUnit = form.watch("unit");
  const selectedProjectId = form.watch("project");

  // Queries
  const { data: units = [], isLoading: unitsLoading } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    enabled: currentStep === 0
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/catalog", selectedUnit],
    queryFn: async () => {
      if (!selectedUnit) return [];
      const response = await fetch(`/api/catalog?unit=${encodeURIComponent(selectedUnit)}`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
    enabled: Boolean(selectedUnit)
  });

  const { data: expenditureTypes = [], isLoading: expenditureTypesLoading } = useQuery<string[]>({
    queryKey: ["/api/catalog", selectedProjectId, "expenditure-types"],
    queryFn: async () => {
      if (!selectedProjectId) throw new Error('No project selected');
      const response = await fetch(`/api/catalog/${selectedProjectId}/expenditure-types`);
      if (!response.ok) throw new Error('Failed to fetch expenditure types');
      const data = await response.json();
      return data.expenditure_types || [];
    },
    enabled: Boolean(selectedProjectId)
  });

  // Effects
  useEffect(() => {
    if (!selectedUnit) {
      form.setValue("project", "");
      form.setValue("expenditure_type", "");
    }
  }, [selectedUnit, form]);

  // Form submission
  const onSubmit = async (data: CreateDocumentForm) => {
    try {
      // Handle form submission
      console.log('Form submitted:', data);
      onOpenChange(false);
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Error",
        description: "Failed to create document",
        variant: "destructive"
      });
    }
  };

  // Recipient management
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
                <FormField
                  control={form.control}
                  name="project"
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
                            <SelectValue>
                              {field.value
                                ? projects.find(p => p.mis === field.value)?.event_description
                                : "Select project"}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.mis} value={project.mis}>
                              {project.na853
                                ? `${project.na853} - ${project.event_description}`
                                : project.event_description}
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
                        disabled={!selectedProjectId || expenditureTypesLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {expenditureTypes.map((type) => (
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