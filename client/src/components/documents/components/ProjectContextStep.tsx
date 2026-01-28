import * as React from "react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectSelect, type ProjectSelectHandle } from "./ProjectSelect";
import { BudgetIndicator } from "@/components/ui/budget-indicator";
import type { UseFormReturn } from "react-hook-form";

interface ProjectContextStepProps {
  form: UseFormReturn<any>;
  selectedUnit: string;
  selectedProject: any;
  budgetData: any;
  currentAmount: number;
  onProjectSelect: (project: any) => void;
  updateFormData: (data: any) => void;
  formData: any;
  projectSelectRef?: React.Ref<ProjectSelectHandle>;
}

export function ProjectContextStep({
  form,
  selectedUnit,
  selectedProject,
  budgetData,
  currentAmount,
  onProjectSelect,
  updateFormData,
  formData,
  projectSelectRef,
}: ProjectContextStepProps) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Clear section header */}
      <div className="pb-3 border-b">
        <h2 className="text-lg font-semibold">Πλαίσιο Έργου</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Το έργο και ο τύπος δαπάνης που αφορά το έγγραφο
        </p>
      </div>

      {/* Budget Overview - Compact at top */}
      <BudgetIndicator budgetData={budgetData} currentAmount={currentAmount} />

      {/* Project & Expenditure Fields */}
      <div className="space-y-4">
        <FormField
          control={form.control}
          name="project_id"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-base">
                Έργο <span className="text-destructive">*</span>
              </FormLabel>
              <ProjectSelect
                selectedUnit={selectedUnit || ""}
                ref={projectSelectRef}
                onProjectSelect={(project) => {
                  if (project) {
                    field.onChange(project.id);
                    onProjectSelect(project);
                    updateFormData({
                      ...formData,
                      project_id: String(project.id),
                    });
                  } else {
                    field.onChange("");
                    updateFormData({
                      ...formData,
                      project_id: "",
                    });
                  }
                }}
                value={field.value}
                placeholder="Επιλέξτε έργο..."
              />
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
                <FormLabel className="text-base">
                  Τύπος Δαπάνης <span className="text-destructive">*</span>
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={!selectedProject}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Επιλέξτε τύπο δαπάνης" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {selectedProject?.expenditure_types?.length > 0 ? (
                      selectedProject.expenditure_types.map((type: string) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem
                        key="no-expenditure-types"
                        value="no-expenditure-types"
                        disabled
                      >
                        Δεν υπάρχουν διαθέσιμοι τύποι δαπάνης
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
                <p className="text-xs text-muted-foreground mt-1">
                  Ορίζει τα συνημμένα και τους δικαιούχους που θα είναι διαθέσιμοι
                </p>
              </FormItem>
            )}
          />
        )}
      </div>

      {/* Helper text */}
      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
        <p>
          <strong>Σημείωση:</strong> Οι διαθέσιμοι τύποι δαπάνης εξαρτώνται από το επιλεγμένο έργο
        </p>
      </div>
    </div>
  );
}
