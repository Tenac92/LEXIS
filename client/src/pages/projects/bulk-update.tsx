import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Header } from "@/components/header";
import { useAuth } from "@/hooks/use-auth";

interface APIResponse<T = any> {
  ok: boolean;
  json(): Promise<T>;
  blob(): Promise<Blob>;
}

export default function BulkUpdatePage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [updateData, setUpdateData] = useState('');
  const { user } = useAuth();

  // Check if user is admin
  if (!user?.role || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-red-600">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  const handleBulkUpdate = async () => {
    try {
      setLoading(true);
      let updates;

      try {
        updates = JSON.parse(updateData);
        if (!Array.isArray(updates)) {
          throw new Error('Updates must be an array');
        }

        // Validate each update object
        updates.forEach((update, index) => {
          if (!update.mis || !update.data) {
            throw new Error(`Invalid update at index ${index}: missing mis or data`);
          }
        });
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Invalid JSON format');
      }

      const response = await apiRequest('/api/projects/bulk-update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ updates }),
      }) as APIResponse;

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
            <div className="bg-muted p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-2">Instructions</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Enter a JSON array of updates in the format:
              </p>
              <pre className="text-xs bg-background p-4 rounded overflow-x-auto">
{`[
  {
    "mis": "5203921",
    "data": {
      "project_title": "New Title",
      "status": "completed",
      "region": "Attica"
    }
  },
  {
    "mis": "5203922",
    "data": {
      "event_description": "Updated description",
      "budget_na853": 150000
    }
  }
]`}
              </pre>
              <p className="text-sm text-muted-foreground mt-4">
                Available fields for update:
                <br />
                - project_title
                <br />
                - event_description
                <br />
                - status (active, pending, completed, pending_reallocation)
                <br />
                - region
                <br />
                - budget_na853 (number)
                <br />
                - budget_e069 (number)
                <br />
                - budget_na271 (number)
                <br />
                - ethsia_pistosi (number)
              </p>
            </div>

            <div className="space-y-2">
              <Textarea
                value={updateData}
                onChange={(e) => setUpdateData(e.target.value)}
                placeholder="Enter JSON update data"
                className="min-h-[300px] font-mono"
              />
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