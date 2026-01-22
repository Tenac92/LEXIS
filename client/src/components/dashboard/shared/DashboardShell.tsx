/**
 * DashboardShell - Unified layout component for all role dashboards
 * Provides consistent structure with header, KPI row, and configurable sections
 */

import React, { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

export interface DashboardAction {
  label: string;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "outline" | "ghost";
}

export interface DashboardSection {
  id: string;
  title?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  content: ReactNode;
}

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  roleBadge?: string;
  actions?: DashboardAction[];
  children: ReactNode;
  className?: string;
}

export function DashboardShell({
  title,
  subtitle,
  roleBadge,
  actions = [],
  children,
  className = "",
}: DashboardShellProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{title}</h1>
            {roleBadge && (
              <Badge variant="outline" className="text-xs">
                {roleBadge}
              </Badge>
            )}
          </div>
          {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
        </div>

        {/* Actions */}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action, idx) => {
              const Icon = action.icon;
              return (
                <Button
                  key={idx}
                  variant={action.variant || "default"}
                  onClick={action.onClick}
                  asChild={!!action.href}
                >
                  {action.href ? (
                    <a href={action.href}>
                      {Icon && <Icon className="w-4 h-4 mr-2" />}
                      {action.label}
                    </a>
                  ) : (
                    <>
                      {Icon && <Icon className="w-4 h-4 mr-2" />}
                      {action.label}
                    </>
                  )}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
