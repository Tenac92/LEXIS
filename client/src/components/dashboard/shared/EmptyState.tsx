/**
 * EmptyState - Consistent empty state component
 * Shows friendly message when no data is available
 */

import React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={cn("text-center p-8 text-muted-foreground", className)}>
      <Icon className="h-12 w-12 mx-auto mb-3 opacity-30" />
      <p className="text-sm font-medium mb-1">{title}</p>
      {description && <p className="text-xs mb-4">{description}</p>}
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={action.onClick}
          asChild={!!action.href}
        >
          {action.href ? (
            <a href={action.href}>{action.label}</a>
          ) : (
            action.label
          )}
        </Button>
      )}
    </div>
  );
}
