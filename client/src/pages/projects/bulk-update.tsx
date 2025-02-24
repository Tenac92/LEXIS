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
  na853: string;
  data: {
    ethsia_pistosi: number;
    q1: number;
    q2: number;
    q3: number;
    q4: number;
    katanomes_etous: number;
    user_view: number;
  };
}

export default function BulkUpdatePage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [updates, setUpdates] = useState<UpdateItem[]>([{ 
    mis: '', 
    na853: '',
    data: { 
      ethsia_pistosi: 0,
      q1: 0,
      q2: 0,
      q3: 0,
      q4: 0,
      katanomes_etous: 0,
      user_view: 0
    } 
  }]);
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
    setUpdates([...updates, { 
      mis: '', 
      na853: '',
      data: { 
        ethsia_pistosi: 0,
        q1: 0,
        q2: 0,
        q3: 0,
        q4: 0,
        katanomes_etous: 0,
        user_view: 0
      } 
    }]);
  };

  const handleRemoveUpdate = (index: number) => {
    setUpdates(updates.filter((_, i) => i !== index));
  };

  const handleUpdateChange = (index: number, field: string, value: string | number) => {
    const newUpdates = [...updates];
    if (field === 'mis') {
      newUpdates[index].mis = value as string;
    } else if (field === 'na853') {
      newUpdates[index].na853 = value as string;
    } else {
      newUpdates[index].data = {
        ...newUpdates[index].data,
        [field]: Number(value) || 0
      };
    }
    setUpdates(newUpdates);
  };

  const handleBulkUpdate = async () => {
    try {
      setLoading(true);

      // Validate updates
      const invalidUpdates = updates.filter(update => !update.mis || !update.na853);
      if (invalidUpdates.length > 0) {
        throw new Error('All updates must have both MIS and NA853 numbers');
      }

      const response = await apiRequest('/api/budget/bulk-update', {
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
        description: "Budget splits updated successfully",
      });

      setLocation('/projects');
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update budget splits",
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
                  <div className="grid grid-cols-2 gap-4">
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
                      <Label htmlFor={`na853-${index}`}>NA853 Code *</Label>
                      <Input
                        id={`na853-${index}`}
                        value={update.na853}
                        onChange={(e) => handleUpdateChange(index, 'na853', e.target.value)}
                        placeholder="e.g., 2024ΝΑ85300140"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`ethsia-pistosi-${index}`}>Annual Credit</Label>
                      <Input
                        id={`ethsia-pistosi-${index}`}
                        type="number"
                        value={update.data.ethsia_pistosi || ''}
                        onChange={(e) => handleUpdateChange(index, 'ethsia_pistosi', e.target.value)}
                        placeholder="Enter annual credit amount"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`user-view-${index}`}>User View Amount</Label>
                      <Input
                        id={`user-view-${index}`}
                        type="number"
                        value={update.data.user_view || ''}
                        onChange={(e) => handleUpdateChange(index, 'user_view', e.target.value)}
                        placeholder="Enter user view amount"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor={`q1-${index}`}>Q1</Label>
                      <Input
                        id={`q1-${index}`}
                        type="number"
                        value={update.data.q1 || ''}
                        onChange={(e) => handleUpdateChange(index, 'q1', e.target.value)}
                        placeholder="Q1 amount"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`q2-${index}`}>Q2</Label>
                      <Input
                        id={`q2-${index}`}
                        type="number"
                        value={update.data.q2 || ''}
                        onChange={(e) => handleUpdateChange(index, 'q2', e.target.value)}
                        placeholder="Q2 amount"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`q3-${index}`}>Q3</Label>
                      <Input
                        id={`q3-${index}`}
                        type="number"
                        value={update.data.q3 || ''}
                        onChange={(e) => handleUpdateChange(index, 'q3', e.target.value)}
                        placeholder="Q3 amount"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`q4-${index}`}>Q4</Label>
                      <Input
                        id={`q4-${index}`}
                        type="number"
                        value={update.data.q4 || ''}
                        onChange={(e) => handleUpdateChange(index, 'q4', e.target.value)}
                        placeholder="Q4 amount"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`katanomes-etous-${index}`}>Yearly Distribution</Label>
                    <Input
                      id={`katanomes-etous-${index}`}
                      type="number"
                      value={update.data.katanomes_etous || ''}
                      onChange={(e) => handleUpdateChange(index, 'katanomes_etous', e.target.value)}
                      placeholder="Enter yearly distribution amount"
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