import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { FileText, FolderKanban, Filter, RefreshCcw, LayoutGrid, List } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function DocumentsPage() {
  const [isAdvancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pt-6 pb-8">
        <Card className="bg-card">
          <div className="p-4">
            {/* Basic Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Unit</label>
                <Select>
                  <option value="all">All Units</option>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Status</label>
                <Select>
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">User</label>
                <Select>
                  <option value="">All Users</option>
                </Select>
              </div>
            </div>

            {/* Advanced Filters Button */}
            <Sheet open={isAdvancedFiltersOpen} onOpenChange={setAdvancedFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Advanced Filters
                  </span>
                  <span className="text-muted-foreground">⌘K</span>
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Advanced Filters</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-1 gap-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="date" placeholder="From" />
                      <Input type="date" placeholder="To" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" placeholder="Min Amount" />
                      <Input type="number" placeholder="Max Amount" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Recipient</label>
                    <Input placeholder="Search recipient" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">AFM</label>
                    <Input placeholder="Search AFM" maxLength={9} />
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button variant="default" className="flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={() => setViewMode(prev => prev === 'grid' ? 'list' : 'grid')}
                className="flex items-center gap-2"
              >
                {viewMode === 'grid' ? (
                  <LayoutGrid className="h-4 w-4" />
                ) : (
                  <List className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Documents Grid */}
          <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3' : 'grid-cols-1'} gap-6 p-6`}>
            {/* Document cards will be rendered here */}
          </div>
        </Card>
      </div>
    </div>
  );
}
