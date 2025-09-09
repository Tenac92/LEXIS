import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Link, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { subprojectFormSchema, type Subproject, type SubprojectFormData } from "@shared/schema";

// Use the schema from shared/schema.ts for consistency
type NewSubprojectFormData = SubprojectFormData;

interface SubprojectSelectionDialogProps {
  projectId: string | number;
  projectTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Use the Subproject type from schema instead of custom interface
interface AvailableSubproject extends Subproject {}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Συνεχιζόμενο':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'Σε αναμονή':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'Ολοκληρωμένο':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export function SubprojectSelectionDialog({
  projectId,
  projectTitle,
  open,
  onOpenChange,
}: SubprojectSelectionDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSubprojects, setSelectedSubprojects] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState("select");

  // Form for creating new subproject
  const form = useForm<NewSubprojectFormData>({
    resolver: zodResolver(subprojectFormSchema),
    defaultValues: {
      subproject_code: "",
      title: "",
      description: "",
      status: "Συνεχιζόμενο",
    },
  });

  // Fetch all available subprojects
  const { data: allSubprojects, isLoading: isLoadingAll } = useQuery({
    queryKey: ['all-subprojects'],
    queryFn: async () => {
      const response = await fetch('/api/subprojects/all', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch subprojects: ${response.status}`);
      }

      const data = await response.json();
      return data.subprojects as AvailableSubproject[];
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch currently linked subprojects for this project
  const { data: linkedSubprojects } = useQuery({
    queryKey: ['subprojects', String(projectId)],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/subprojects`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch linked subprojects: ${response.status}`);
      }

      const data = await response.json();
      return data.subprojects;
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Mutation for linking existing subprojects
  const linkSubprojectsMutation = useMutation({
    mutationFn: async (subprojectIds: number[]) => {
      const results = [];
      for (const subprojectId of subprojectIds) {
        const response = await fetch(`/api/projects/${projectId}/subprojects/link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ subproject_id: subprojectId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 409) {
            // Already linked, skip
            continue;
          }
          throw new Error(errorData.error || 'Failed to link subproject');
        }

        results.push(await response.json());
      }
      return results;
    },
    onSuccess: (results) => {
      toast({
        title: "Επιτυχής σύνδεση",
        description: `${results.length} υποέργα συνδέθηκαν επιτυχώς`,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ["subprojects", String(projectId)],
      });

      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Σφάλμα",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for creating new subproject
  const createSubprojectMutation = useMutation({
    mutationFn: async (data: NewSubprojectFormData) => {
      const response = await fetch(`/api/projects/${projectId}/subprojects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Αποτυχία δημιουργίας υποέργου");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Επιτυχής δημιουργία",
        description: `Το υποέργο "${data.subproject.title}" δημιουργήθηκε και συνδέθηκε επιτυχώς`,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ["subprojects", String(projectId)],
      });
      queryClient.invalidateQueries({
        queryKey: ["all-subprojects"],
      });

      form.reset();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Σφάλμα",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setSelectedSubprojects([]);
    form.reset();
    onOpenChange(false);
  };

  const handleSubprojectToggle = (subprojectId: number) => {
    setSelectedSubprojects(prev => 
      prev.includes(subprojectId)
        ? prev.filter(id => id !== subprojectId)
        : [...prev, subprojectId]
    );
  };

  const handleLinkSelected = () => {
    if (selectedSubprojects.length > 0) {
      linkSubprojectsMutation.mutate(selectedSubprojects);
    }
  };

  const onSubmitNew = (data: NewSubprojectFormData) => {
    createSubprojectMutation.mutate(data);
  };

  const linkedSubprojectIds = linkedSubprojects?.subprojects?.map((sp: any) => sp.id) || [];
  const availableSubprojects = allSubprojects?.filter(sp => !linkedSubprojectIds.includes(sp.id)) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Διαχείριση Υποέργων
          </DialogTitle>
          <DialogDescription>
            {projectTitle ? (
              <>Διαχειριστείτε τα υποέργα για το έργο: <strong>{projectTitle}</strong></>
            ) : (
              <>Συνδέστε υπάρχοντα υποέργα ή δημιουργήστε νέα</>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="select">Σύνδεση Υπαρχόντων</TabsTrigger>
            <TabsTrigger value="create">Δημιουργία Νέου</TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="flex-1 overflow-auto">
            <div className="space-y-4">
              {isLoadingAll ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Φόρτωση υποέργων...</span>
                </div>
              ) : availableSubprojects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Δεν υπάρχουν διαθέσιμα υποέργα για σύνδεση
                </div>
              ) : (
                <div className="grid gap-3 max-h-96 overflow-y-auto">
                  {availableSubprojects.map((subproject) => {
                    const isSelected = selectedSubprojects.includes(subproject.id);
                    
                    return (
                      <Card
                        key={subproject.id}
                        className={cn(
                          "cursor-pointer transition-all duration-200 hover:shadow-md",
                          isSelected 
                            ? "ring-2 ring-blue-500 border-blue-200 bg-blue-50" 
                            : "border-gray-200 hover:border-gray-300"
                        )}
                        onClick={() => handleSubprojectToggle(subproject.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                              <Checkbox
                                checked={isSelected}
                                onChange={() => handleSubprojectToggle(subproject.id)}
                                className="mt-1"
                              />
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-2">
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {subproject.subproject_code || 'N/A'}
                                  </Badge>
                                  <Badge className={cn("text-xs", getStatusColor(subproject.status || 'Συνεχιζόμενο'))}>
                                    {subproject.status || 'Συνεχιζόμενο'}
                                  </Badge>
                                </div>
                                
                                <h4 className="font-medium text-sm text-gray-900 mb-1">
                                  {subproject.title}
                                </h4>
                                
                                {subproject.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {subproject.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            {isSelected && (
                              <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="create" className="flex-1 overflow-auto">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitNew)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="subproject_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Κωδικός Υποέργου</FormLabel>
                        <FormControl>
                          <Input placeholder="π.χ. SP-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Κατάσταση</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Επιλέξτε κατάσταση" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Συνεχιζόμενο">Συνεχιζόμενο</SelectItem>
                            <SelectItem value="Σε αναμονή">Σε αναμονή</SelectItem>
                            <SelectItem value="Ολοκληρωμένο">Ολοκληρωμένο</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Τίτλος Υποέργου</FormLabel>
                      <FormControl>
                        <Input placeholder="Εισάγετε τον τίτλος του υποέργου" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Περιγραφή (προαιρετικό)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Περιγράψτε το υποέργο..."
                          className="min-h-[80px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Ακύρωση
          </Button>
          
          {activeTab === "select" ? (
            <Button 
              onClick={handleLinkSelected}
              disabled={selectedSubprojects.length === 0 || linkSubprojectsMutation.isPending}
            >
              {linkSubprojectsMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Σύνδεση {selectedSubprojects.length > 0 ? `(${selectedSubprojects.length})` : ''}
            </Button>
          ) : (
            <Button 
              onClick={form.handleSubmit(onSubmitNew)}
              disabled={createSubprojectMutation.isPending}
            >
              {createSubprojectMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Δημιουργία & Σύνδεση
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}