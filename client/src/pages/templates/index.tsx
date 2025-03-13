```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { FileText, Plus, Eye, Edit, Trash2 } from "lucide-react";

interface Template {
  id: number;
  name: string;
  description: string;
  category: string;
  expenditure_type: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export default function TemplatesPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    category: '',
    expenditure_type: ''
  });

  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['/api/templates'],
    queryFn: async () => {
      const response = await fetch('/api/templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json() as Promise<Template[]>;
    }
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: typeof newTemplate) => {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      });
      if (!response.ok) throw new Error('Failed to create template');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      setIsCreateDialogOpen(false);
      setNewTemplate({ name: '', description: '', category: '', expenditure_type: '' });
      toast({
        title: "Επιτυχής δημιουργία",
        description: "Το πρότυπο δημιουργήθηκε επιτυχώς.",
      });
    },
    onError: (error) => {
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία δημιουργίας προτύπου. " + error.message,
        variant: "destructive",
      });
    }
  });

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    createTemplateMutation.mutate(newTemplate);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Πρότυπα Διαβιβαστικών</h1>
          <p className="text-muted-foreground">Διαχείριση προτύπων για τα διαβιβαστικά έγγραφα</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Νέο Πρότυπο
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Δημιουργία Νέου Προτύπου</DialogTitle>
              <DialogDescription>
                Συμπληρώστε τα στοιχεία του νέου προτύπου
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Όνομα Προτύπου</Label>
                <Input
                  id="name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="π.χ. Βασικό Πρότυπο Διαβιβαστικού"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Περιγραφή</Label>
                <Textarea
                  id="description"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Περιγράψτε το πρότυπο..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Κατηγορία</Label>
                <Input
                  id="category"
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="π.χ. Διαβιβαστικά"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expenditure_type">Τύπος Δαπάνης (προαιρετικό)</Label>
                <Input
                  id="expenditure_type"
                  value={newTemplate.expenditure_type}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, expenditure_type: e.target.value }))}
                  placeholder="π.χ. ΕΚΤΟΣ ΕΔΡΑΣ"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Ακύρωση
                </Button>
                <Button 
                  type="submit"
                  disabled={createTemplateMutation.isPending}
                >
                  {createTemplateMutation.isPending ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Δημιουργία
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates?.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {template.name}
              </CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <div className="text-sm">
                  <span className="font-medium">Κατηγορία:</span> {template.category}
                </div>
                {template.expenditure_type && (
                  <div className="text-sm">
                    <span className="font-medium">Τύπος Δαπάνης:</span> {template.expenditure_type}
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Eye className="h-4 w-4 mr-2" />
                    Προεπισκόπηση
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <Edit className="h-4 w-4 mr-2" />
                    Επεξεργασία
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" disabled={template.is_default}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Διαγραφή
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```
