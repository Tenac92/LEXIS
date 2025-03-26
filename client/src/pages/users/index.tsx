import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Search, Edit2, Trash2, UserPlus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Form,
  FormControl,
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

const userSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.string().min(1, "Role is required"),
  units: z.array(z.string()).optional(),
  telephone: z.string().optional(),
  department: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

export default function UsersPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: "",
      name: "",
      password: "",
      role: "user",
      units: [],
      telephone: "",
      department: ""
    },
  });

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
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

  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest(`/api/users/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Deleted",
        description: "User has been successfully deleted",
      });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const response = await apiRequest("/api/users", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Created",
        description: "New user has been successfully created",
      });
      setNewUserDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Create Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UserFormData) => {
    createUserMutation.mutate(data);
  };

  const filteredUsers = users?.filter((user) => {
    const searchMatch =
      !search ||
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.units?.toLowerCase().includes(search.toLowerCase());

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
        <Button onClick={() => setNewUserDialogOpen(true)}>
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
                    <TableCell>{user.units?.join(", ") || "-"}</TableCell>
                    <TableCell>{user.telephone || "-"}</TableCell>
                    <TableCell>{user.department || "-"}</TableCell>
                    <TableCell className="text-right">
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
      <Dialog open={newUserDialogOpen} onOpenChange={setNewUserDialogOpen}>
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
                    <Select
                      onValueChange={(value) => {
                        const currentUnits = field.value || [];
                        const newUnits = currentUnits.includes(value)
                          ? currentUnits.filter(unit => unit !== value)
                          : [...currentUnits, value];
                        field.onChange(newUnits);
                      }}
                      defaultValue={field.value?.[0]}
                      multiple
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select units">
                            {field.value?.length 
                              ? `${field.value.length} units selected` 
                              : "Select units"}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                                field.value?.includes(unit.id) ? "bg-primary" : ""
                              }`}>
                                {field.value?.includes(unit.id) && "✓"}
                              </div>
                              {unit.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={departments.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
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
    </div>
    </>
  );
}