import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PlusIcon, TrashIcon } from "@radix-ui/react-icons";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Header } from "@/components/header";
import { useAuth } from "@/hooks/use-auth";
import { Label } from "@/components/ui/label";

interface UpdateItem {
  mis: string;
  data: {
    budget_na853_split: number;
  };
}

export default function BulkUpdatePage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [updates, setUpdates] = useState<UpdateItem[]>([{ mis: '', data: { budget_na853_split: 0 } }]);
  const { user } = useAuth();

  // Check if user is admin
  if (!user?.role || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-red-600">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  const handleAddUpdate = () => {
    setUpdates([...updates, { mis: '', data: { budget_na853_split: 0 } }]);
  };

  const handleRemoveUpdate = (index: number) => {
    setUpdates(updates.filter((_, i) => i !== index));
  };

  const handleUpdateChange = (index: number, field: string, value: string | number) => {
    const newUpdates = [...updates];
    if (field === 'mis') {
      newUpdates[index].mis = value as string;
    } else {
      newUpdates[index].data = {
        budget_na853_split: Number(value) || 0
      };
    }
    setUpdates(newUpdates);
  };

  const handleBulkUpdate = async () => {
    try {
      setLoading(true);

      // Validate updates
      const invalidUpdates = updates.filter(update => !update.mis || !update.data.budget_na853_split);
      if (invalidUpdates.length > 0) {
        throw new Error('All updates must have a MIS number and budget split amount');
      }

      const response = await apiRequest('/api/projects/bulk-update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Bulk update failed');
      }

      toast({
        title: "Success",
        description: "Projects updated successfully",
      });

      setLocation('/projects');
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Bulk Update Budget Split</h1>
            <Button variant="outline" asChild>
              <Link href="/projects">Back to Projects</Link>
            </Button>
          </div>

          <div className="space-y-6">
            {updates.map((update, index) => (
              <Card key={index} className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Update #{index + 1}</h3>
                  {updates.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveUpdate(index)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-4">
                  <div>
                    <Label htmlFor={`mis-${index}`}>MIS Number *</Label>
                    <Input
                      id={`mis-${index}`}
                      value={update.mis}
                      onChange={(e) => handleUpdateChange(index, 'mis', e.target.value)}
                      placeholder="Enter MIS number"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor={`budget-${index}`}>Budget NA853 Split *</Label>
                    <Input
                      id={`budget-${index}`}
                      type="number"
                      value={update.data.budget_na853_split || ''}
                      onChange={(e) => handleUpdateChange(index, 'budget_na853_split', e.target.value)}
                      placeholder="Enter budget split amount"
                      required
                    />
                  </div>
                </div>
              </Card>
            ))}

            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={handleAddUpdate}
                className="w-full sm:w-auto"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Another Project
              </Button>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={handleBulkUpdate}
                disabled={loading}
              >
                {loading ? "Updating..." : "Update Projects"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}