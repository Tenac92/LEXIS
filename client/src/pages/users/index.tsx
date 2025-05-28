import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Search, Edit2, Trash2, UserPlus, X as XIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { MultiSelect } from "@/components/ui/multi-select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Header } from "@/components/header"; // Assuming Header component exists and is located here

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  units?: string[];
  created_at: string;
  telephone?: string;
  department?: string;
}

// Base schema for user data validation
const baseUserSchema = {
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
  role: z.string().min(1, "Role is required"),
  units: z.array(z.string()).optional(),
  telephone: z.string().optional().or(z.coerce.string()),
  department: z.string().optional(),
};

// Schema for creating a new user (password required)
const createUserSchema = z.object({
  ...baseUserSchema,
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Schema for editing an existing user (password optional)
const editUserSchema = z.object({
  ...baseUserSchema,
  password: z.string().refine(val => val === '' || val.length >= 6, {
    message: "Password must be at least 6 characters or empty to keep current"
  })
});

// Default schema for the form
const userSchema = createUserSchema;

type UserFormData = z.infer<typeof createUserSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;

export default function UsersPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);

  // Use React.useState to trigger re-render when the resolver changes
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');

  // Create the form with the appropriate resolver based on mode
  const form = useForm<UserFormData>({
    resolver: zodResolver(formMode === 'create' ? createUserSchema : editUserSchema),
    defaultValues: {
      email: "",
      name: "",
      password: "",
      role: "user",
      units: [],
      telephone: "",
      department: ""
    },
    // This ensures the validation rules are updated when formMode changes
    context: { mode: formMode },
  });

  const { data: users, isLoading, refetch } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
    refetchOnWindowFocus: true,
    staleTime: 0, // Consider the data stale immediately
  });

  // Define a type for the unit data
  interface UnitData {
    id: string;
    name: string;
  }

  const { data: units = [] } = useQuery<UnitData[]>({
    queryKey: ["/api/users/units"],
    queryFn: async () => {
      const response = await fetch("/api/users/units");
      if (!response.ok) throw new Error("Failed to fetch units");
      return response.json();
    },
  });

  // Helper function to convert unit abbreviations to full names for display
  const getDisplayUnits = (userUnits: string[] | undefined) => {
    if (!userUnits || !units) return [];
    
    return userUnits.map(unitId => {
      // First check if it's already a full name
      const unitByName = units.find(u => u.name === unitId);
      if (unitByName) return unitId;
      
      // Otherwise, find by abbreviation (id)
      const unitById = units.find(u => u.id === unitId);
      return unitById ? unitById.name : unitId;
    });
  };

  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      console.log("[Users] Attempting to delete user with ID:", userId);
      
      // Make a direct fetch request instead of using apiRequest to have better control
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Users] Delete response error:", errorData);
        throw new Error(errorData.message || `Failed to delete user: ${response.status}`);
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      console.log("[Users] Delete success response:", data);
      // Invalidate the cache AND explicitly refetch the data
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      refetch(); // Explicitly trigger a refetch
      toast({
        title: "User Deleted",
        description: "User has been successfully deleted",
      });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      console.error("[Users] Delete error:", error);
      toast({
        title: "Delete Failed",
        description: error.message || "An error occurred when deleting the user",
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      console.log("[Users] Attempting to create new user with data:", data);
      
      // Make a direct fetch request instead of using apiRequest to have better control
      const response = await fetch("/api/users", {
        method: "POST",
        credentials: "include",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Users] Create response error:", errorData);
        throw new Error(errorData.message || `Failed to create user: ${response.status}`);
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      console.log("[Users] Create success response:", data);
      // Invalidate the cache AND explicitly refetch the data
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      refetch(); // Explicitly trigger a refetch
      toast({
        title: "User Created",
        description: "New user has been successfully created",
      });
      setNewUserDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      console.error("[Users] Create error:", error);
      toast({
        title: "Create Failed",
        description: error.message || "An error occurred when creating the user",
        variant: "destructive",
      });
    },
  });
  
  const updateUserMutation = useMutation({
    mutationFn: async (data: UserFormData & { id: number }) => {
      const { id, ...userData } = data;
      // Don't send empty password during update
      const finalData = userData.password ? userData : { ...userData, password: undefined };
      
      console.log("[Users] Attempting to update user with ID:", id, "and data:", finalData);
      
      // Make a direct fetch request instead of using apiRequest to have better control
      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(finalData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Users] Update response error:", errorData);
        throw new Error(errorData.message || `Failed to update user: ${response.status}`);
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      console.log("[Users] Update success response:", data);
      // Invalidate the cache AND explicitly refetch the data
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      refetch(); // Explicitly trigger a refetch
      toast({
        title: "User Updated",
        description: "User has been successfully updated",
      });
      setEditUserDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      console.error("[Users] Update error:", error);
      toast({
        title: "Update Failed",
        description: error.message || "An error occurred when updating the user",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UserFormData) => {
    // Convert unit IDs to unit abbreviations for storage in the database
    const modifiedData = {
      ...data,
      units: data.units?.map((unitId) => {
        const unit = units.find(u => u.id === unitId);
        return unit ? unit.id : unitId; // Store abbreviation (id) instead of full name
      })
    };
    
    console.log('Submitting user data with abbreviations:', modifiedData);
    
    if (selectedUser && editUserDialogOpen) {
      // Update existing user
      updateUserMutation.mutate({
        ...modifiedData as UserFormData,
        id: selectedUser.id
      });
    } else {
      // Create new user
      createUserMutation.mutate(modifiedData as UserFormData);
    }
  };

  const filteredUsers = users?.filter((user) => {
    const searchMatch =
      !search ||
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      (user.units && Array.isArray(user.units) && 
        user.units.some(unit => 
          typeof unit === 'string' && unit.toLowerCase().includes(search.toLowerCase())
        ));

    const roleMatch = selectedRole === "all" || user.role === selectedRole;

    return searchMatch && roleMatch;
  });

  if (!currentUser?.role || currentUser.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-red-600">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <> {/*Added this fragment */}
    <Header/> {/*Added Header component here*/}
    <div className="container mx-auto py-8">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <h1 className="text-3xl font-bold">Users Management</h1>
        <Button 
          onClick={() => {
            setFormMode('create');
            form.reset({
              email: "",
              name: "",
              password: "",
              role: "user",
              units: [],
              telephone: "",
              department: ""
            });
            setNewUserDialogOpen(true);
          }}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Add New User
        </Button>
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Telephone</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <span className="capitalize">{user.role}</span>
                    </TableCell>
                    <TableCell>{getDisplayUnits(user.units).join(", ") || "-"}</TableCell>
                    <TableCell>{user.telephone || "-"}</TableCell>
                    <TableCell>{user.department || "-"}</TableCell>
                    <TableCell className="text-right flex justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedUser(user);
                          setFormMode('edit');
                          setEditUserDialogOpen(true);
                          
                          // Map user's unit names to unit IDs for the form
                          const userUnitIds = (user.units || []).map(unitName => {
                            const unit = units.find(u => u.name === unitName);
                            return unit ? unit.id : "";
                          }).filter(id => id !== "");
                          
                          // Pre-populate form with user data
                          form.reset({
                            email: user.email,
                            name: user.name,
                            password: "", // Don't pre-populate password for security
                            role: user.role as "admin" | "user" | "manager",
                            units: userUnitIds,
                            telephone: user.telephone || "",
                            department: user.department || ""
                          });
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedUser(user);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete User Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedUser) {
                  deleteMutation.mutate(selectedUser.id);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New User Dialog */}
      <Dialog 
        open={newUserDialogOpen} 
        onOpenChange={(open) => {
          setNewUserDialogOpen(open);
          if (!open) {
            // Reset form when dialog is closed
            form.reset({
              email: "",
              name: "",
              password: "",
              role: "user",
              units: [],
              telephone: "",
              department: ""
            });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Enter the details for the new user below
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="user@example.com" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="units"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Units</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={units}
                        value={field.value || []}
                        onChange={field.onChange}
                        placeholder="Select units"
                        addLabel="Add more units"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telephone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telephone</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter telephone number" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => {
                  const selectedUnitIds = form.watch('units') || [];
                  const { data: departments = [] } = useQuery({
                    queryKey: ['departments', selectedUnitIds],
                    queryFn: async () => {
                      if (selectedUnitIds.length === 0) return [];
                      
                      // Find the full unit objects from their IDs
                      const selectedUnitNames = units
                        .filter(unit => selectedUnitIds.includes(unit.id))
                        .map(unit => unit.name);
                        
                      // Now use the unit names to fetch departments
                      const params = new URLSearchParams();
                      selectedUnitNames.forEach(unitName => params.append('units', unitName));
                      const response = await fetch(`/api/users/units/parts?${params}`);
                      if (!response.ok) throw new Error('Failed to fetch departments');
                      return response.json();
                    },
                    enabled: selectedUnitIds.length > 0
                  });

                  return (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      {departments.length > 0 ? (
                        <>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select department" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {departments.map((dept: string) => (
                                <SelectItem key={dept} value={dept}>
                                  {dept}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground mt-1">
                          The selected units don't have any associated departments. This field will be left empty.
                        </div>
                      )}
                    </FormItem>
                  );
                }}
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setNewUserDialogOpen(false)}
                  type="button"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog 
        open={editUserDialogOpen} 
        onOpenChange={(open) => {
          setEditUserDialogOpen(open);
          if (!open) {
            // Reset form mode when dialog is closed
            setFormMode('create');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update the user details below
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="user@example.com" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Leave empty to keep current password" 
                        autoComplete="new-password" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                    <FormDescription>
                      Leave blank to keep the current password
                    </FormDescription>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="units"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Units</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={units}
                        value={field.value || []}
                        onChange={field.onChange}
                        placeholder="Select units"
                        addLabel="Add more units"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telephone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telephone</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter telephone number" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => {
                  const selectedUnitIds = form.watch('units') || [];
                  const { data: departments = [] } = useQuery({
                    queryKey: ['departments', selectedUnitIds],
                    queryFn: async () => {
                      if (selectedUnitIds.length === 0) return [];
                      
                      // Find the full unit objects from their IDs
                      const selectedUnitNames = units
                        .filter(unit => selectedUnitIds.includes(unit.id))
                        .map(unit => unit.name);
                        
                      // Now use the unit names to fetch departments
                      const params = new URLSearchParams();
                      selectedUnitNames.forEach(unitName => params.append('units', unitName));
                      const response = await fetch(`/api/users/units/parts?${params}`);
                      if (!response.ok) throw new Error('Failed to fetch departments');
                      return response.json();
                    },
                    enabled: selectedUnitIds.length > 0
                  });

                  return (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      {departments.length > 0 ? (
                        <>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select department" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {departments.map((dept: string) => (
                                <SelectItem key={dept} value={dept}>
                                  {dept}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground mt-1">
                          The selected units don't have any associated departments. This field will be left empty.
                        </div>
                      )}
                    </FormItem>
                  );
                }}
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditUserDialogOpen(false)}
                  type="button"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? "Updating..." : "Update User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}