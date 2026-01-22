/**
 * KpiCard - Standardized metric card for dashboards
 * Displays a key metric with icon, label, value, and optional details
 */

import React, { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  borderColor?: string;
  detail?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  badge?: ReactNode;
  clickable?: boolean;
  href?: string;
  className?: string;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  iconColor = "text-blue-600",
  iconBgColor = "bg-blue-50",
  borderColor = "border-l-blue-500",
  detail,
  trend,
  trendValue,
  badge,
  clickable = false,
  href,
  className = "",
}: KpiCardProps) {
  const content = (
    <Card
      className={cn(
        "hover:shadow-lg transition-all duration-200 border-l-4",
        borderColor,
        clickable && "cursor-pointer",
        className,
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", iconBgColor)}>
              <Icon className={cn("h-5 w-5", iconColor)} />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                {label}
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
          </div>
          {badge && <div>{badge}</div>}
        </div>
      </CardHeader>
      {(detail || trend) && (
        <CardContent className="pt-0">
          <div className="text-sm text-muted-foreground">
            {detail}
            {trend && trendValue && (
              <span
                className={cn(
                  "ml-2 font-medium",
                  trend === "up" && "text-green-600",
                  trend === "down" && "text-red-600",
                  trend === "neutral" && "text-gray-600",
                )}
              >
                {trendValue}
              </span>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
