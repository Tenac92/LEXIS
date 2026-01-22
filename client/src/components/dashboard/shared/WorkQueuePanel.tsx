/**
 * WorkQueuePanel - Displays items requiring attention
 * Shows errors, missing data, pending approvals, etc.
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  LucideIcon,
} from "lucide-react";
import { EmptyState } from "./EmptyState";
import { Link } from "wouter";

export interface WorkQueueItem {
  id: string | number;
  title: string;
  description?: string;
  severity?: "high" | "medium" | "low";
  icon?: LucideIcon;
  href?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface WorkQueuePanelProps {
  title: string;
  items: WorkQueueItem[];
  icon?: LucideIcon;
  emptyMessage?: string;
  maxItems?: number;
  viewAllHref?: string;
}

const severityColors = {
  high: "bg-red-50 border-red-200 text-red-800",
  medium: "bg-orange-50 border-orange-200 text-orange-800",
  low: "bg-yellow-50 border-yellow-200 text-yellow-800",
};

const severityBadge = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
} as const;

export function WorkQueuePanel({
  title,
  items,
  icon: Icon = AlertTriangle,
  emptyMessage = "Όλα τα στοιχεία είναι ενημερωμένα",
  maxItems = 5,
  viewAllHref,
}: WorkQueuePanelProps) {
  const displayItems = items.slice(0, maxItems);
  const hasMore = items.length > maxItems;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <Badge variant={items.length > 0 ? "destructive" : "outline"}>
            {items.length} {items.length === 1 ? "στοιχείο" : "στοιχεία"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={emptyMessage}
            className="py-6"
          />
        ) : (
          <div className="space-y-3">
            {displayItems.map((item) => {
              const ItemIcon = item.icon || AlertTriangle;
              const severity = item.severity || "medium";

              return (
                <div
                  key={item.id}
                  className={`p-3 border rounded-lg transition-all ${severityColors[severity]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1">
                      <ItemIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight mb-1">
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-xs opacity-80">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                    {item.href && (
                      <Link href={item.href}>
                        <Button size="sm" variant="ghost" className="h-8 px-2">
                          <ArrowUpRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                    {item.action && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={item.action.onClick}
                        className="h-8"
                      >
                        {item.action.label}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {(hasMore || viewAllHref) && (
              <div className="pt-3 border-t mt-4">
                <Button variant="link" size="sm" asChild className="w-full">
                  <Link href={viewAllHref || "#"}>
                    {hasMore
                      ? `Προβολή όλων (${items.length - maxItems} ακόμα)`
                      : "Προβολή όλων"}
                    <ArrowUpRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
