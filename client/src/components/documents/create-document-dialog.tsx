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

interface Unit {
  id: string;
  name: string;
}

interface Project {
  id: number;
  name: string;
  mis: string | null;
  na853: string | null;
  budget: number | null;
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

const steps = ["Project Details", "Recipients", "Attachments", "Review"];

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
      project: "",
      expenditure_type: "",
      recipients: [],
      attachments: {}
    }
  });

  // Fetch units
  const { data: units = [], isLoading: unitsLoading } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    enabled: currentStep === 0
  });

  // Fetch projects when unit is selected
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects", form.watch("unit")],
    enabled: currentStep === 0 && Boolean(form.watch("unit"))
  });

  // Fetch expenditure types when project is selected
  const { data: expenditureTypes = [], isLoading: expenditureTypesLoading } = useQuery<string[]>({
    queryKey: ["/api/projects", form.watch("project"), "expenditure-types"],
    enabled: Boolean(form.watch("project"))
  });

  const createDocumentMutation = useMutation({
    mutationFn: async (data: CreateDocumentForm) => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (key === "attachments") {
          Object.entries(value as Record<string, File>).forEach(([type, file]) => {
            if (file) formData.append(`attachment_${type}`, file);
          });
        } else if (key === "recipients") {
          formData.append("recipients", JSON.stringify(value));
        } else {
          formData.append(key, String(value));
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

  const nextStep = () => {
    const fields = getFieldsForStep(currentStep);
    form.trigger(fields).then((isValid) => {
      if (isValid) {
        setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
      }
    });
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const getFieldsForStep = (step: number): Array<keyof CreateDocumentForm> => {
    switch (step) {
      case 0:
        return ["unit", "project", "expenditure_type"];
      case 1:
        return ["recipients"];
      case 2:
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

  const getProjectDisplayName = (projectId: string | undefined): string => {
    if (!projectId) return 'Select project';
    const project = projects.find(p => p.id.toString() === projectId);
    return project ? (project.na853 ? `${project.na853} - ${project.name}` : project.name) : 'Select project';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create New Document</DialogTitle>
          <DialogDescription>
            Fill in the required information to create a new document. Navigate through the steps to complete the form.
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
              <div className="space-y-4">
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
                          {units?.map((unit) => (
                            <SelectItem key={`unit-${unit.id}`} value={unit.id}>
                              {unit.name}
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
                  name="project"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!form.watch("unit") || projectsLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects?.map((project) => (
                            <SelectItem 
                              key={`project-${project.id}`}
                              value={String(project.id)}
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
                          {expenditureTypes?.map((type) => (
                            <SelectItem key={`type-${type}`} value={type}>
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

            {currentStep === 1 && (
              <div className="space-y-4">
                {/* Recipients form fields */}
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                {/* File upload fields */}
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                {/* Review summary */}
              </div>
            )}

            <div className="flex justify-between">
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