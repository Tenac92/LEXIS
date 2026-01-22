/**
 * FeatureGate Component
 *
 * Conditional renderer that only shows UI elements for enabled features.
 * Prevents broken/incomplete features from being exposed to users.
 */

import React, { ReactNode } from "react";
import { isFeatureEnabled, FeatureKey, getFeature } from "@/config/features";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Lock } from "lucide-react";

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
  showTooltip?: boolean;
}

/**
 * Component that gates content behind feature flags
 *
 * @param feature - The feature key to check
 * @param children - Content to show if feature is enabled
 * @param fallback - Content to show if feature is disabled (default: nothing)
 * @param showTooltip - Show tooltip with disable reason on hover (default: true)
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  showTooltip = true,
}: FeatureGateProps) {
  const enabled = isFeatureEnabled(feature);

  if (enabled) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return null;
}

/**
 * Wrapper for disabled buttons that shows tooltip on hover
 */
export function FeatureLockedButton({
  feature,
  children,
  className = "",
}: {
  feature: FeatureKey;
  children: ReactNode;
  className?: string;
}) {
  const featureConfig = getFeature(feature);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center gap-2 ${className}`}>
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{featureConfig.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p className="font-semibold">{featureConfig.label}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {featureConfig.reason}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Hook to check if a feature is enabled
 */
export function useFeature(feature: FeatureKey): boolean {
  return isFeatureEnabled(feature);
}
