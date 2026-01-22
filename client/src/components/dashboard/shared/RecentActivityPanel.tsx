/**
 * RecentActivityPanel - Shows recent activity/changes
 * Standardized display of timeline events
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowUpRight,
  Calendar,
  FileText,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { EmptyState } from "./EmptyState";
import { Link } from "wouter";

export interface ActivityItem {
  id: number | string;
  description: string;
  date: string;
  createdBy?: string;
  documentId?: number;
  protocolNumber?: string;
  na853?: string;
  changeAmount?: number;
  type?: string;
}

interface RecentActivityPanelProps {
  title?: string;
  activities: ActivityItem[];
  maxItems?: number;
  viewAllHref?: string;
  emptyMessage?: string;
}

export function RecentActivityPanel({
  title = "Πρόσφατη Δραστηριότητα",
  activities = [],
  maxItems = 10,
  viewAllHref,
  emptyMessage = "Δεν υπάρχει πρόσφατη δραστηριότητα",
}: RecentActivityPanelProps) {
  const displayActivities = activities.slice(0, maxItems);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {activities.length}{" "}
            {activities.length === 1 ? "εγγραφή" : "εγγραφές"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <EmptyState icon={Activity} title={emptyMessage} className="py-6" />
        ) : (
          <div className="space-y-4">
            {displayActivities.map((activity) => (
              <div
                key={activity.id}
                className="relative p-4 rounded-lg border hover:shadow-sm transition-all duration-200 bg-gradient-to-r from-card to-card/50"
              >
                <div className="absolute left-0 top-4 w-1 h-8 bg-primary/20 rounded-r-full" />

                <div className="pl-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-relaxed mb-2">
                        {activity.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        {activity.documentId && (
                          <Link
                            href={`/documents?highlight=${activity.documentId}`}
                          >
                            <Badge
                              variant="outline"
                              className="text-xs hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              <FileText className="w-3 h-3 mr-1" />
                              {activity.protocolNumber ||
                                `Έγγραφο #${activity.documentId}`}
                            </Badge>
                          </Link>
                        )}

                        {activity.na853 && (
                          <Badge variant="outline" className="text-xs">
                            <FileText className="w-3 h-3 mr-1" />
                            NA853: {activity.na853}
                          </Badge>
                        )}

                        {activity.changeAmount !== undefined && (
                          <Badge
                            variant={
                              activity.changeAmount > 0
                                ? "default"
                                : "destructive"
                            }
                            className="text-xs font-medium"
                          >
                            {activity.changeAmount > 0 ? (
                              <TrendingUp className="w-3 h-3 mr-1" />
                            ) : (
                              <TrendingDown className="w-3 h-3 mr-1" />
                            )}
                            {Math.abs(activity.changeAmount).toLocaleString(
                              "el-GR",
                              {
                                style: "currency",
                                currency: "EUR",
                              },
                            )}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">
                        {new Date(activity.date).toLocaleDateString("el-GR")}
                      </div>
                      {activity.createdBy && (
                        <div className="text-xs text-muted-foreground font-medium">
                          {activity.createdBy}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {viewAllHref && activities.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <Button variant="outline" asChild className="w-full">
                  <Link href={viewAllHref}>
                    Προβολή πλήρους ιστορικού
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
