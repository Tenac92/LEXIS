import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Cross2Icon, PlusIcon, TrashIcon } from "@radix-ui/react-icons";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Header } from "@/components/header";
import { useAuth } from "@/hooks/use-auth";
import { Label } from "@/components/ui/label";

interface UpdateItem {
  mis: string;
  data: {
    project_title?: string;
    event_description?: string;
    status?: string;
    region?: string;
    budget_na853?: number;
    budget_e069?: number;
    budget_na271?: number;
    ethsia_pistosi?: number;
  };
}

export default function BulkUpdatePage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [updates, setUpdates] = useState<UpdateItem[]>([{ mis: '', data: {} }]);
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
    setUpdates([...updates, { mis: '', data: {} }]);
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
        ...newUpdates[index].data,
        [field]: field.includes('budget') || field === 'ethsia_pistosi' ? Number(value) : value
      };
    }
    setUpdates(newUpdates);
  };

  const handleBulkUpdate = async () => {
    try {
      setLoading(true);

      // Validate updates
      const invalidUpdates = updates.filter(update => !update.mis || Object.keys(update.data).length === 0);
      if (invalidUpdates.length > 0) {
        throw new Error('All updates must have a MIS number and at least one field to update');
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
            <h1 className="text-3xl font-bold">Bulk Update Projects</h1>
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

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Project Title</Label>
                      <Input
                        value={update.data.project_title || ''}
                        onChange={(e) => handleUpdateChange(index, 'project_title', e.target.value)}
                        placeholder="Enter project title"
                      />
                    </div>

                    <div>
                      <Label>Status</Label>
                      <Select
                        value={update.data.status}
                        onValueChange={(value) => handleUpdateChange(index, 'status', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="pending_reallocation">Pending Reallocation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Region</Label>
                      <Input
                        value={update.data.region || ''}
                        onChange={(e) => handleUpdateChange(index, 'region', e.target.value)}
                        placeholder="Enter region"
                      />
                    </div>

                    <div>
                      <Label>Event Description</Label>
                      <Input
                        value={update.data.event_description || ''}
                        onChange={(e) => handleUpdateChange(index, 'event_description', e.target.value)}
                        placeholder="Enter description"
                      />
                    </div>

                    <div>
                      <Label>Budget NA853</Label>
                      <Input
                        type="number"
                        value={update.data.budget_na853 || ''}
                        onChange={(e) => handleUpdateChange(index, 'budget_na853', e.target.value)}
                        placeholder="Enter budget"
                      />
                    </div>

                    <div>
                      <Label>Budget E069</Label>
                      <Input
                        type="number"
                        value={update.data.budget_e069 || ''}
                        onChange={(e) => handleUpdateChange(index, 'budget_e069', e.target.value)}
                        placeholder="Enter budget"
                      />
                    </div>

                    <div>
                      <Label>Budget NA271</Label>
                      <Input
                        type="number"
                        value={update.data.budget_na271 || ''}
                        onChange={(e) => handleUpdateChange(index, 'budget_na271', e.target.value)}
                        placeholder="Enter budget"
                      />
                    </div>

                    <div>
                      <Label>Annual Credit</Label>
                      <Input
                        type="number"
                        value={update.data.ethsia_pistosi || ''}
                        onChange={(e) => handleUpdateChange(index, 'ethsia_pistosi', e.target.value)}
                        placeholder="Enter annual credit"
                      />
                    </div>
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