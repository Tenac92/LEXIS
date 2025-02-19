import { useState } from "react";
import { useNavigate } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface APIResponse<T = any> {
  ok: boolean;
  json(): Promise<T>;
  blob(): Promise<Blob>;
}

export default function BulkUpdatePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [updateData, setUpdateData] = useState('');

  const handleBulkUpdate = async () => {
    try {
      setLoading(true);
      let updates;
      
      try {
        updates = JSON.parse(updateData);
      } catch (e) {
        throw new Error('Invalid JSON format');
      }

      const response = await apiRequest('/api/projects/bulk-update', {
        method: 'PUT',
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

      navigate('/projects');
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
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Bulk Update Projects</h1>
          <Button variant="outline" onClick={() => navigate('/projects')}>
            Back to Projects
          </Button>
        </div>

        <div className="space-y-6">
          <div className="bg-muted p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Instructions</h2>
            <p className="text-sm text-muted-foreground">
              Enter a JSON array of updates in the format:
              <br />
              <code className="text-xs bg-background p-1 rounded">
                [{'\n'}
                {'  '}{"mis": "5203921", "data": {"project_title": "New Title"}},
                {'\n'}
                {'  '}{"mis": "5203922", "data": {"status": "completed"}}{'\n'}
                ]
              </code>
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
  );
}
