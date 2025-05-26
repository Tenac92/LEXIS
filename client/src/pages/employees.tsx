/**
 * Employee Management Page
 * Complete CRUD interface for managing employees with search and filtering
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEmployeeSchema, type Employee, type InsertEmployee } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, Users } from "lucide-react";

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const { toast } = useToast();

  // Fetch employees with optional unit filter
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['/api/employees', selectedUnit !== 'all' ? selectedUnit : undefined],
    queryFn: () => {
      const params = selectedUnit !== 'all' ? `?unit=${selectedUnit}` : '';
      return fetch(`/api/employees${params}`).then(res => res.json()).then(data => data.data || []);
    }
  });

  // Fetch available units for filtering
  const { data: units = [] } = useQuery({
    queryKey: ['/api/units'],
    queryFn: () => fetch('/api/units').then(res => res.json()).then(data => data.data || [])
  });

  // Create employee mutation
  const createEmployeeMutation = useMutation({
    mutationFn: (data: InsertEmployee) => apiRequest('/api/employees', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Επιτυχία",
        description: "Ο υπάλληλος δημιουργήθηκε επιτυχώς",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Σφάλμα",
        description: error.message || "Σφάλμα κατά τη δημιουργία του υπαλλήλου",
        variant: "destructive",
      });
    }
  });

  // Update employee mutation
  const updateEmployeeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertEmployee> }) => 
      apiRequest(`/api/employees/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setIsEditDialogOpen(false);
      setEditingEmployee(null);
      toast({
        title: "Επιτυχία",
        description: "Ο υπάλληλος ενημερώθηκε επιτυχώς",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Σφάλμα",
        description: error.message || "Σφάλμα κατά την ενημέρωση του υπαλλήλου",
        variant: "destructive",
      });
    }
  });

  // Delete employee mutation
  const deleteEmployeeMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/employees/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({
        title: "Επιτυχία",
        description: "Ο υπάλληλος διαγράφηκε επιτυχώς",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Σφάλμα",
        description: error.message || "Σφάλμα κατά τη διαγραφή του υπαλλήλου",
        variant: "destructive",
      });
    }
  });

  // Filter employees based on search term
  const filteredEmployees = employees.filter((employee: Employee) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      employee.surname?.toLowerCase().includes(searchLower) ||
      employee.name?.toLowerCase().includes(searchLower) ||
      employee.fathername?.toLowerCase().includes(searchLower) ||
      employee.afm?.includes(searchTerm)
    );
  });

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (employee: Employee) => {
    if (window.confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε τον υπάλληλο ${employee.name} ${employee.surname};`)) {
      deleteEmployeeMutation.mutate(employee.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Διαχείριση Υπαλλήλων</h1>
          <p className="text-muted-foreground">
            Διαχειριστείτε τον κατάλογο υπαλλήλων για αυτόματη συμπλήρωση στα έγγραφα
          </p>
        </div>
        <EmployeeDialog
          isOpen={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSubmit={(data) => createEmployeeMutation.mutate(data)}
          isLoading={createEmployeeMutation.isPending}
          trigger={
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Νέος Υπάλληλος
            </Button>
          }
        />
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Αναζήτηση & Φίλτρα
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Αναζήτηση με όνομα, επώνυμο, πατρώνυμο ή ΑΦΜ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Επιλογή μονάδας" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Όλες οι μονάδες</SelectItem>
              {units.map((unit: any) => (
                <SelectItem key={unit.unit} value={unit.unit}>
                  {unit.unit_name?.name || unit.unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Employees Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Κατάλογος Υπαλλήλων ({filteredEmployees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Φόρτωση υπαλλήλων...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Επώνυμο</TableHead>
                  <TableHead>Όνομα</TableHead>
                  <TableHead>Πατρώνυμο</TableHead>
                  <TableHead>ΑΦΜ</TableHead>
                  <TableHead>Κλάδος</TableHead>
                  <TableHead>Ιδιότητα</TableHead>
                  <TableHead>Μονάδα</TableHead>
                  <TableHead>Ενέργειες</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee: Employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.surname}</TableCell>
                    <TableCell>{employee.name}</TableCell>
                    <TableCell>{employee.fathername}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{employee.afm}</Badge>
                    </TableCell>
                    <TableCell>{employee.klados}</TableCell>
                    <TableCell>{employee.attribute}</TableCell>
                    <TableCell>{employee.monada}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(employee)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(employee)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingEmployee && (
        <EmployeeDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSubmit={(data) => 
            updateEmployeeMutation.mutate({ 
              id: editingEmployee.id, 
              data 
            })
          }
          isLoading={updateEmployeeMutation.isPending}
          employee={editingEmployee}
          title="Επεξεργασία Υπαλλήλου"
        />
      )}
    </div>
  );
}

// Employee Dialog Component
interface EmployeeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertEmployee) => void;
  isLoading: boolean;
  employee?: Employee;
  title?: string;
  trigger?: React.ReactNode;
}

function EmployeeDialog({ 
  isOpen, 
  onOpenChange, 
  onSubmit, 
  isLoading, 
  employee, 
  title = "Νέος Υπάλληλος",
  trigger 
}: EmployeeDialogProps) {
  const form = useForm<InsertEmployee>({
    resolver: zodResolver(insertEmployeeSchema),
    defaultValues: {
      surname: employee?.surname || "",
      name: employee?.name || "",
      fathername: employee?.fathername || "",
      afm: employee?.afm || "",
      klados: employee?.klados || "",
      attribute: employee?.attribute || "",
      workaf: employee?.workaf || "",
      monada: employee?.monada || "",
    },
  });

  const handleSubmit = (data: InsertEmployee) => {
    onSubmit(data);
    form.reset();
  };

  const content = (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Συμπληρώστε τα στοιχεία του υπαλλήλου
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="surname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Επώνυμο</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>Όνομα</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="fathername"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Πατρώνυμο</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="afm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ΑΦΜ</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="klados"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Κλάδος</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="attribute"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ιδιότητα</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="workaf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Work AF</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="monada"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Μονάδα</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Ακύρωση
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Αποθήκευση..." : "Αποθήκευση"}
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  );

  return trigger ? (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {content}
    </Dialog>
  ) : (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {content}
    </Dialog>
  );
}