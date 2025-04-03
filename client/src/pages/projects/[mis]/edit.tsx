import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/header";
import { Card, CardContent } from "@/components/ui/card";
import { insertProjectSchema, type Project } from "@shared/schema";
import { z } from "zod";

// Create an extended schema for updates - all fields are optional
const updateProjectSchema = insertProjectSchema.partial();
type UpdateFormData = z.infer<typeof updateProjectSchema>;

export default function EditProjectPage() {
  const { mis } = useParams<{ mis: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  console.log("Edit Project Page - MIS Parameter:", mis);

  // Fetch the project data
  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: [`/api/projects/${mis}`],
    queryFn: async (): Promise<Project> => {
      const response = await apiRequest(`/api/projects/${mis}`);
      return response as Project;
    },
    enabled: !!mis // Only run query if mis is available
  });

  // Initialize the form
  const form = useForm<UpdateFormData>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: {
      title: "",
      mis: "",
      budget_na853: "",
      budget_e069: "",
      budget_na271: "",
      status: "active",
    },
  });

  // Update form values when project data is loaded
  useEffect(() => {
    if (project) {
      form.reset({
        title: project.title || "",
        mis: project.mis || "",
        budget_na853: project.budget_na853 || "",
        budget_e069: project.budget_e069 || "",
        budget_na271: project.budget_na271 || "",
        status: project.status || "active",
      });
    }
  }, [project, form]);

  // Update project mutation
  const updateMutation = useMutation({
    mutationFn: async (data: UpdateFormData) => {
      setLoading(true);
      try {
        console.log(`Updating project ${mis} with data:`, data);
        const response = await apiRequest(`/api/projects/${mis}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });

        if (!response) {
          throw new Error("Failed to update project");
        }

        return response;
      } finally {
        setLoading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${mis}`] });
      queryClient.invalidateQueries({ queryKey: ["budget", mis] });
      
      toast({
        title: "Success",
        description: "Project updated successfully",
      });
      
      // Navigate back to project details
      navigate(`/projects/${mis}`);
    },
    onError: (error) => {
      console.error("Error updating project:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update project",
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: UpdateFormData) => {
    updateMutation.mutate(data);
  };

  // Handle loading and error states
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto py-8">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto py-8">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold">Project Not Found</h1>
              <Button variant="outline" asChild>
                <a href="/projects">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Projects
                </a>
              </Button>
            </div>
            <Card className="p-6 bg-red-50">
              <p className="text-red-600">
                The requested project could not be found or you don't have permission to edit it.
              </p>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Edit Project</h1>
            <Button variant="outline" onClick={() => navigate(`/projects/${mis}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Button>
          </div>

          <Card>
            <CardContent className="p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Title</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Project title" />
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
                          <FormLabel>Status</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="pending_reallocation">Pending Reallocation</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="mis"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MIS</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="MIS code" readOnly />
                          </FormControl>
                          <FormDescription>
                            MIS cannot be changed after creation
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="budget_na853"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Budget NA853</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ""}
                              placeholder="Budget NA853"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="budget_na271"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Budget NA271</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ""}
                              placeholder="Budget NA271"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="budget_e069"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Budget E069</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ""}
                              placeholder="Budget E069"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={loading}
                    >
                      {loading ? "Updating..." : "Update Project"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}