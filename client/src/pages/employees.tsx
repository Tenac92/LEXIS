/**
 * Employee Management Page
 * Complete CRUD interface for managing employees with search and filtering
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insertEmployeeSchema,
  type Employee,
  type InsertEmployee,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Search, Edit, Trash2, Users, Upload, Trash } from "lucide-react";
import { Header } from "@/components/header";

export default function EmployeesPage() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const { toast } = useToast();

  // Fetch available units for filtering
  const { data: units = [] } = useQuery({
    queryKey: ["/api/units"],
    queryFn: async () => {
      const res = await fetch("/api/units");
      const json = await res.json();
      console.log("[Employees] Units API response:", json);
      return json.data || json || [];
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    refetchOnWindowFocus: false,
    refetchOnMount: "stale",
  });

  // For managers, force their unit; for admins, use selected unit
  const filterUnitForQuery = useMemo(() => {
    if (isManager && user?.unit_id?.[0]) {
      const managerUnitId = user.unit_id[0].toString();
      const managerUnit = units?.find(
        (u: any) => u.id?.toString() === managerUnitId,
      );
      console.log("[Employees] Manager unit lookup:", {
        managerUnitId,
        managerUnit,
      });
      return managerUnit?.code || selectedUnit;
    }
    return selectedUnit;
  }, [isManager, user?.unit_id, units, selectedUnit]);

  // Fetch employees with optional unit filter
  const { data: employees = [], isLoading } = useQuery({
    queryKey: [
      "/api/employees",
      filterUnitForQuery !== "all" ? filterUnitForQuery : undefined,
    ],
    queryFn: () => {
      const params =
        filterUnitForQuery !== "all" ? `?unit=${filterUnitForQuery}` : "";
      return fetch(`/api/employees${params}`)
        .then((res) => res.json())
        .then((data) => data.data || []);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: "stale",
  });

  // Create employee mutation
  const createEmployeeMutation = useMutation({
    mutationFn: (data: InsertEmployee) =>
      apiRequest("/api/employees", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
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
    },
  });

  // Update employee mutation
  const updateEmployeeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertEmployee> }) =>
      apiRequest(`/api/employees/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
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
    },
  });

  // Delete employee mutation
  const deleteEmployeeMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/employees/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
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
    },
  });

  // Import employees mutation
  const importEmployeesMutation = useMutation({
    mutationFn: (employees: InsertEmployee[]) =>
      apiRequest("/api/employees/import", {
        method: "POST",
        body: JSON.stringify({ employees }),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsImportDialogOpen(false);
      toast({
        title: "Επιτυχία",
        description: data.message || "Η εισαγωγή ολοκληρώθηκε επιτυχώς",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Σφάλμα",
        description: error.message || "Σφάλμα κατά την εισαγωγή των υπαλλήλων",
        variant: "destructive",
      });
    },
  });

  // Cleanup duplicates mutation
  const cleanupDuplicatesMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/employees/cleanup-duplicates", {
        method: "POST",
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Επιτυχία",
        description: data.message || "Ο καθαρισμός ολοκληρώθηκε επιτυχώς",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Σφάλμα",
        description: error.message || "Σφάλμα κατά τον καθαρισμό διπλοτύπων",
        variant: "destructive",
      });
    },
  });

  // Filter employees based on search term and unit (memoized to prevent unnecessary recalculations)
  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee: Employee) => {
        // Unit filter (additional client-side filtering for consistency)
        if (selectedUnit !== "all" && employee.monada !== selectedUnit) {
          return false;
        }
        // Search filter
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
          employee.surname?.toLowerCase().includes(searchLower) ||
          employee.name?.toLowerCase().includes(searchLower) ||
          employee.fathername?.toLowerCase().includes(searchLower) ||
          employee.afm?.includes(searchTerm)
        );
      }),
    [employees, searchTerm, selectedUnit],
  );

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (employee: Employee) => {
    if (
      window.confirm(
        `Είστε σίγουροι ότι θέλετε να διαγράψετε τον υπάλληλο ${employee.name} ${employee.surname};`,
      )
    ) {
      deleteEmployeeMutation.mutate(employee.id);
    }
  };

  const maskAFM = (afm: string | undefined) => {
    if (!afm) return "";
    const afmStr = afm.toString();
    if (afmStr.length <= 4) return afmStr;
    const first3 = afmStr.substring(0, 3);
    const last3 = afmStr.substring(afmStr.length - 3);
    const masked = afmStr.substring(3, afmStr.length - 3).replace(/./g, "*");
    return `${first3}${masked}${last3}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex items-start justify-between mb-8">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight">
                  Διαχείριση Υπαλλήλων
                </h1>
              </div>
              <p className="text-base text-muted-foreground">
                Διαχειριστείτε τον κατάλογο υπαλλήλων για αυτόματη συμπλήρωση
                στα έγγραφα
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!isManager && (
                <>
                  <EmployeeDialog
                    isOpen={isCreateDialogOpen}
                    onOpenChange={setIsCreateDialogOpen}
                    onSubmit={(data) => createEmployeeMutation.mutate(data)}
                    isLoading={createEmployeeMutation.isPending}
                    trigger={
                      <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Νέος Υπάλληλος
                      </Button>
                    }
                  />
                  <ImportEmployeesDialog
                    isOpen={isImportDialogOpen}
                    onOpenChange={setIsImportDialogOpen}
                    onImport={(employees) =>
                      importEmployeesMutation.mutate(employees)
                    }
                    isLoading={importEmployeesMutation.isPending}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Θέλετε να αφαιρέσετε τα διπλότυπα υπαλλήλων;",
                        )
                      ) {
                        cleanupDuplicatesMutation.mutate();
                      }
                    }}
                    disabled={cleanupDuplicatesMutation.isPending}
                    className="gap-2"
                  >
                    <Trash className="h-4 w-4" />
                    {cleanupDuplicatesMutation.isPending
                      ? "Γίνεται καθαρισμός..."
                      : "Αφαίρεση Διπλοτύπων"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Search and Filters */}
          <Card className="border-0 shadow-sm bg-white/50 backdrop-blur supports-[backdrop-filter]:bg-white/40">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Search className="h-4 w-4 text-primary" />
                Αναζήτηση & Φίλτρα
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 flex-col md:flex-row">
                <div className="flex-1">
                  <Input
                    placeholder="Αναζήτηση με όνομα, επώνυμο, πατρώνυμο ή ΑΦΜ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-white/50"
                  />
                </div>
                <Select
                  value={filterUnitForQuery}
                  onValueChange={isManager ? undefined : setSelectedUnit}
                  disabled={isManager}
                >
                  <SelectTrigger className="w-full md:w-48 bg-white/50">
                    <SelectValue placeholder="Επιλογή μονάδας" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Όλες οι μονάδες</SelectItem>
                    {Array.isArray(units) && units.length > 0 ? (
                      units.map((unit: any) => (
                        <SelectItem
                          key={unit.id}
                          value={unit.code || unit.unit || unit.id}
                        >
                          {unit.name ||
                            unit.unit_name?.name ||
                            unit.code ||
                            unit.unit}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="all" disabled>
                        Φόρτωση μονάδων...
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Employees Table */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-4 w-4 text-primary" />
                  Κατάλογος Υπαλλήλων
                </CardTitle>
                <Badge variant="secondary" className="text-base px-3 py-1">
                  {filteredEmployees.length} υπάλληλοι
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-pulse text-muted-foreground">
                    Φόρτωση υπαλλήλων...
                  </div>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">
                    Δεν βρέθηκαν υπάλληλοι
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="w-12 text-xs font-semibold">
                          ID
                        </TableHead>
                        <TableHead className="font-semibold">Επώνυμο</TableHead>
                        <TableHead className="font-semibold">Όνομα</TableHead>
                        <TableHead className="font-semibold">
                          Πατρώνυμο
                        </TableHead>
                        <TableHead className="font-semibold">ΑΦΜ</TableHead>
                        <TableHead className="font-semibold">Κλάδος</TableHead>
                        <TableHead className="font-semibold">
                          Ιδιότητα
                        </TableHead>
                        <TableHead className="font-semibold">
                          Σχέση Εργασίας
                        </TableHead>
                        <TableHead className="font-semibold">Μονάδα</TableHead>
                        <TableHead className="w-24 text-center font-semibold">
                          Ενέργειες
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((employee: Employee) => (
                        <TableRow
                          key={employee.id}
                          className="hover:bg-muted/40 transition-colors"
                        >
                          <TableCell className="text-xs text-muted-foreground font-medium">
                            {employee.id}
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">
                            {employee.surname}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {employee.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {employee.fathername}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className="font-mono text-xs"
                            >
                              {maskAFM(employee.afm)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {employee.klados}
                          </TableCell>
                          <TableCell className="text-sm">
                            {employee.attribute}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {employee.workaf}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="bg-blue-50 dark:bg-blue-900/20"
                            >
                              {employee.monada}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {!isManager && (
                              <div className="flex gap-2 justify-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(employee)}
                                  data-testid={`button-edit-employee-${employee.id}`}
                                  className="hover:bg-blue-50 dark:hover:bg-blue-900/20 h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(employee)}
                                  data-testid={`button-delete-employee-${employee.id}`}
                                  className="hover:bg-red-50 dark:hover:bg-red-900/20 h-8 w-8 p-0"
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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
                  data,
                })
              }
              isLoading={updateEmployeeMutation.isPending}
              employee={editingEmployee}
              title="Επεξεργασία Υπαλλήλου"
            />
          )}
        </div>
      </main>
    </div>
  );
}

// Import Dialog Component
interface ImportEmployeesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (employees: InsertEmployee[]) => void;
  isLoading: boolean;
}

function ImportEmployeesDialog({
  isOpen,
  onOpenChange,
  onImport,
  isLoading,
}: ImportEmployeesDialogProps) {
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Send file to server for safe Excel parsing (uses exceljs, not vulnerable xlsx)
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/employees/parse-excel", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        alert(
          `Σφάλμα κατά την ανάγνωση του αρχείου: ${error.message || "Unknown error"}`,
        );
        return;
      }

      const data: InsertEmployee[] = await response.json();

      if (data.length === 0) {
        alert("Δεν βρέθηκαν έγκυρα δεδομένα υπαλλήλων στο αρχείο");
        return;
      }

      onImport(data);
      onOpenChange(false);
    } catch (error) {
      console.error("Error importing file:", error);
      alert(
        `Σφάλμα κατά την ανάγνωση του αρχείου: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Εισαγωγή Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Εισαγωγή Υπαλλήλων</DialogTitle>
          <DialogDescription>
            Επιλέξτε ένα αρχείο Excel με τα στοιχεία των υπαλλήλων
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">
                  <span className="font-semibold">Κάντε κλικ για αποστολή</span>{" "}
                  ή σύρετε αρχείο
                </p>
                <p className="text-xs text-gray-500">Excel ή CSV αρχεία</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                disabled={isLoading}
              />
            </label>
          </div>
          {isLoading && (
            <div className="text-center text-sm text-muted-foreground">
              Εισαγωγή σε εξέλιξη...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
  trigger,
}: EmployeeDialogProps) {
  const form = useForm<InsertEmployee>({
    resolver: zodResolver(insertEmployeeSchema),
    defaultValues: {
      surname: employee?.surname ?? "",
      name: employee?.name ?? "",
      fathername: employee?.fathername ?? "",
      afm: employee?.afm ?? "",
      klados: employee?.klados ?? "",
      attribute: employee?.attribute ?? "",
      workaf: employee?.workaf ?? "",
      monada: employee?.monada ?? "",
    },
  });

  const handleSubmit = (data: InsertEmployee) => {
    onSubmit(data);
    form.reset();
  };

  const content = (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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
                    <Input {...field} value={field.value || ""} />
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
                    <Input {...field} value={field.value || ""} />
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
                    <Input {...field} value={field.value || ""} />
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
                    <Input {...field} value={field.value || ""} />
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
                    <Input {...field} value={field.value || ""} />
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
                    <Input {...field} value={field.value || ""} />
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
                    <Input {...field} value={field.value || ""} />
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
                    <Input {...field} value={field.value || ""} />
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
