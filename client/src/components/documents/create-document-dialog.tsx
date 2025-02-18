import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

interface Unit {
  id: string;
  name: string;
}

interface Project {
  id: number;
  name: string;
  mis: string;
  na853: string | null;
  budget: number | null;
}

interface BudgetData {
  budgetAmount: number;
  ethsiaPistosi: number;
  availableAmount: number;
  totalSpent: number;
}

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
  })).min(1, "At least one recipient is required"),
  attachments: z.object({
    main: z.instanceof(File).optional(),
    support: z.instanceof(File).optional(),
    additional: z.instanceof(File).optional()
  })
});

type CreateDocumentForm = z.infer<typeof createDocumentSchema>;

const steps = ["Unit Selection", "Project Details", "Recipients", "Attachments"];

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateDocumentDialog({ open, onOpenChange }: CreateDocumentDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreateDocumentForm>({
    resolver: zodResolver(createDocumentSchema),
    defaultValues: {
      unit: "",
      project: "",
      expenditure_type: "",
      recipients: [],
      attachments: {}
    }
  });

  const { data: units = [], isLoading: unitsLoading } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    enabled: currentStep === 0
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects", form.watch("unit")],
    enabled: Boolean(form.watch("unit"))
  });

  const { data: expenditureTypes = [], isLoading: expenditureTypesLoading } = useQuery<string[]>({
    queryKey: ["/api/projects", form.watch("project"), "expenditure-types"],
    enabled: Boolean(form.watch("project"))
  });

  // Load budget data when project is selected
  const { data: projectBudget } = useQuery<BudgetData>({
    queryKey: ["/api/budget", form.watch("project")],
    enabled: Boolean(form.watch("project")),
    onSuccess: (data) => setBudgetData(data)
  });

  const calculateTotalAmount = () => {
    return form.watch("recipients")?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
  };

  const validateBudgetAmount = () => {
    if (!budgetData) return true;
    const totalAmount = calculateTotalAmount();
    return totalAmount <= budgetData.availableAmount;
  };

  const createDocumentMutation = useMutation({
    mutationFn: async (data: CreateDocumentForm) => {
      const formData = new FormData();

      // Add basic fields
      formData.append("unit", data.unit);
      formData.append("project", data.project);
      formData.append("expenditure_type", data.expenditure_type);

      // Add recipients as JSON
      formData.append("recipients", JSON.stringify(data.recipients));

      // Add attachments
      Object.entries(data.attachments).forEach(([type, file]) => {
        if (file) {
          formData.append(`attachment_${type}`, file);
        }
      });

      const response = await fetch("/api/documents/generated", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create document");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Success",
        description: "Document created successfully",
      });
      onOpenChange(false);
      form.reset();
      setCurrentStep(0);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
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

  const handleFileChange = (type: keyof CreateDocumentForm["attachments"]) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size exceeds 10MB limit",
        variant: "destructive"
      });
      e.target.value = "";
      return;
    }

    form.setValue(`attachments.${type}`, file);
  };

  const nextStep = async () => {
    const fields = getFieldsForStep(currentStep);
    const isValid = await form.trigger(fields);

    if (isValid) {
      if (currentStep === 2 && !validateBudgetAmount()) {
        toast({
          title: "Error",
          description: "Total amount exceeds available budget",
          variant: "destructive"
        });
        return;
      }
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const getFieldsForStep = (step: number): Array<keyof CreateDocumentForm> => {
    switch (step) {
      case 0:
        return ["unit"];
      case 1:
        return ["project", "expenditure_type"];
      case 2:
        return ["recipients"];
      case 3:
        return ["attachments"];
      default:
        return [];
    }
  };

  const onSubmit = (data: CreateDocumentForm) => {
    if (currentStep === steps.length - 1) {
      createDocumentMutation.mutate(data);
    } else {
      nextStep();
    }
  };

  const getSelectedValue = (field: keyof CreateDocumentForm, list: any[], displayField: string = 'name') => {
    const value = form.watch(field);
    if (!value) return undefined;
    const item = list.find((i: any) => String(i.id) === value);
    return item ? item[displayField] : undefined;
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

        <div className="flex items-center justify-center mb-8">
          <nav className="flex items-center space-x-2">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    index === currentStep
                      ? "bg-primary text-primary-foreground"
                      : index < currentStep
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className="w-8 h-px bg-muted" />
                )}
              </div>
            ))}
          </nav>
        </div>

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
                <FormField
                  control={form.control}
                  name="project"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue("expenditure_type", "");
                        }}
                        value={field.value}
                        disabled={!form.watch("unit") || projectsLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem 
                              key={project.id.toString()} 
                              value={project.id.toString()}
                            >
                              {project.na853 ? `${project.na853} - ${project.name}` : project.name}
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
                        disabled={!form.watch("project") || expenditureTypesLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {expenditureTypes.map((type, index) => (
                            <SelectItem 
                              key={`type-${index}`}
                              value={type}
                            >
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {budgetData && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <h3 className="text-sm font-medium mb-2">Budget Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Total Budget:</span>
                        <p className="font-medium">{budgetData.budgetAmount.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Available Amount:</span>
                        <p className="font-medium">{budgetData.availableAmount.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Recipients</h3>
                  <Button
                    type="button"
                    onClick={addRecipient}
                    disabled={form.watch("recipients")?.length >= 10}
                  >
                    Add Recipient
                  </Button>
                </div>

                {form.watch("recipients")?.map((_, index) => (
                  <div key={index} className="grid grid-cols-5 gap-4 p-4 border rounded-lg">
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
                              {...field} 
                              onChange={e => field.onChange(parseFloat(e.target.value))}
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
                              onChange={e => field.onChange(parseInt(e.target.value))}
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

            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="attachments.main"
                    render={({ field: { value, ...field } }) => (
                      <FormItem>
                        <FormLabel>Main Document</FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => handleFileChange("main")(e)}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="attachments.support"
                    render={({ field: { value, ...field } }) => (
                      <FormItem>
                        <FormLabel>Supporting Document</FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => handleFileChange("support")(e)}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="attachments.additional"
                    render={({ field: { value, ...field } }) => (
                      <FormItem>
                        <FormLabel>Additional Document</FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => handleFileChange("additional")(e)}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0}
              >
                Previous
              </Button>
              <Button
                type="submit"
                disabled={createDocumentMutation.isPending}
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