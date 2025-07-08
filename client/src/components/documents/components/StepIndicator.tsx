import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEP_TITLES } from "../constants";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps?: number;
}

export function StepIndicator({ currentStep, totalSteps = 5 }: StepIndicatorProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i);

  return (
    <div className="flex items-center justify-center space-x-2 md:space-x-4 mb-6">
      {steps.map((step, index) => {
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;
        const stepTitle = STEP_TITLES[step as keyof typeof STEP_TITLES] || `Βήμα ${step + 1}`;

        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  isCompleted
                    ? "bg-green-600 text-white"
                    : isCurrent
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-600"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>{step + 1}</span>
                )}
              </div>
              <div className="mt-1 text-xs text-center max-w-20">
                <div className={cn(
                  "hidden sm:block",
                  isCompleted || isCurrent ? "text-gray-900" : "text-gray-500"
                )}>
                  {stepTitle}
                </div>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-12 h-0.5 mx-2",
                  isCompleted ? "bg-green-600" : "bg-gray-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}