import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, MapPin, Building2, BriefcaseBusiness, Target, Euro, Hash, 
  FileText, Building, DollarSign, Info, Clock, CheckCircle, 
  AlertCircle, User, Phone, Mail, Home, CreditCard, Globe, MapIcon
} from "lucide-react";
import { type Project, type OptimizedProject } from "@shared/schema";
// Format currency helper function
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

interface ProjectDetailsDialogProps {
  project: Project | OptimizedProject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'ενεργό':
    case 'active':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'ολοκληρωμένο':
    case 'completed':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'σε εξέλιξη':
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'αναστολή':
    case 'suspended':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusText = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'ενεργό':
    case 'active':
      return 'Ενεργό';
    case 'ολοκληρωμένο':
    case 'completed':
      return 'Ολοκληρωμένο';
    case 'σε εξέλιξη':
    case 'in_progress':
      return 'Σε Εξέλιξη';
    case 'αναστολή':
    case 'suspended':
      return 'Αναστολή';
    default:
      return status || 'Άγνωστο';
  }
};

// Helper function to safely extract array values
const getArrayValue = (value: any): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  return [];
};

// Helper function to safely extract object properties
const getObjectValue = (obj: any, key: string): string => {
  if (!obj || typeof obj !== 'object') return '';
  return obj[key] || '';
};

const getRegionText = (project: Project) => {
  if (!project.region) return "Δ/Υ";
  
  // Handle string regions
  if (typeof project.region === 'string') {
    return project.region;
  }
  
  // Handle array regions
  if (Array.isArray(project.region)) {
    return project.region.join(', ');
  }
  
  // Handle object regions - try to extract meaningful text
  if (typeof project.region === 'object') {
    try {
      // If it's an object with name or title properties
      const obj = project.region as any;
      if (obj.name) return obj.name;
      if (obj.title) return obj.title;
      if (obj.region) return obj.region;
      
      // If it has keys, try to join their values
      const keys = Object.keys(obj);
      if (keys.length > 0) {
        const values = keys.map(key => obj[key]).filter(val => val && typeof val === 'string');
        if (values.length > 0) {
          return values.join(', ');
        }
      }
      
      // Last resort - convert to JSON string and clean it up
      const jsonStr = JSON.stringify(obj);
      if (jsonStr !== '{}' && jsonStr !== 'null') {
        return jsonStr.replace(/[{}"\[\]]/g, '').replace(/,/g, ', ');
      }
    } catch (e) {
      console.warn('Error parsing region object:', e);
    }
  }
  
  return "Δ/Υ";
};

export function ProjectDetailsDialog({ project, open, onOpenChange }: ProjectDetailsDialogProps) {
  // Cast to any to handle type differences between Project and OptimizedProject
  const projectData = project as any;

  // Helper to safely get values
  const getValue = (key: string, fallback = 'Δ/Υ') => {
    return projectData[key] || fallback;
  };

  // Helper to format arrays
  const formatArray = (value: any) => {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'string') return value;
    return 'Δ/Υ';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Πλήρη Στοιχεία Έργου
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Όλα τα διαθέσιμα στοιχεία και πληροφορίες για το επιλεγμένο έργο
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Βασικά Στοιχεία</TabsTrigger>
            <TabsTrigger value="budget">Οικονομικά</TabsTrigger>
            <TabsTrigger value="details">Λεπτομέρειες</TabsTrigger>
            <TabsTrigger value="technical">Τεχνικά</TabsTrigger>
          </TabsList>

          {/* Basic Information Tab */}
          <TabsContent value="basic" className="space-y-6">
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Βασικά Στοιχεία Έργου
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1 md:col-span-2 lg:col-span-3">
                  <label className="text-sm font-medium text-green-700">Περιγραφή Συμβάντος</label>
                  <p className="text-green-900 font-semibold bg-white px-3 py-2 rounded border">
                    {getValue('event_description', 'Δεν υπάρχει περιγραφή συμβάντος')}
                  </p>
                </div>
                
                <div className="space-y-1 md:col-span-2 lg:col-span-3">
                  <label className="text-sm font-medium text-green-700">Τίτλος Έργου</label>
                  <p className="text-green-900 font-semibold bg-white px-3 py-2 rounded border">
                    {getValue('project_title') || getValue('title') || getValue('name', 'Δεν υπάρχει τίτλος έργου')}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-medium text-green-700">Κωδικός MIS</label>
                  <p className="text-green-900 bg-white px-3 py-2 rounded border font-mono flex items-center gap-2">
                    <Hash className="w-4 h-4 text-green-600" />
                    {getValue('mis')}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-medium text-green-700">ΝΑ853</label>
                  <p className="text-green-900 bg-white px-3 py-2 rounded border font-mono flex items-center gap-2">
                    <FileText className="w-4 h-4 text-green-600" />
                    {getValue('na853')}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-green-700">Κατάσταση</label>
                  <div className="bg-white px-3 py-2 rounded border">
                    <Badge variant="secondary" className={getStatusColor(getValue('status', ''))}>
                      {getStatusText(getValue('status', ''))}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Unit and Location Info */}
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                <Building className="w-5 h-5" />
                Φορέας & Τοποθεσία
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projectData.unit?.name && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-blue-700">Μονάδα</label>
                    <p className="text-blue-900 bg-white px-3 py-2 rounded border flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      {projectData.unit.name}
                    </p>
                  </div>
                )}
                
                {projectData.region && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-blue-700">Περιφέρεια</label>
                    <p className="text-blue-900 bg-white px-3 py-2 rounded border flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      {formatArray(projectData.region)}
                    </p>
                  </div>
                )}
                
                {projectData.event_type?.name && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-blue-700">Τύπος Συμβάντος</label>
                    <p className="text-blue-900 bg-white px-3 py-2 rounded border flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-600" />
                      {projectData.event_type.name}
                    </p>
                  </div>
                )}

                {projectData.expenditure_type?.name && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-blue-700">Τύπος Δαπάνης</label>
                    <p className="text-blue-900 bg-white px-3 py-2 rounded border flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-blue-600" />
                      {projectData.expenditure_type.name}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Budget Tab */}
          <TabsContent value="budget" className="space-y-6">
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                <Euro className="w-5 h-5" />
                Οικονομικά Στοιχεία
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {getValue('budget_na853') && getValue('budget_na853') !== 'Δ/Υ' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-blue-700">Προϋπολογισμός ΝΑ853</label>
                    <p className="text-blue-900 bg-white px-3 py-2 rounded border font-semibold">
                      {formatCurrency(parseFloat(getValue('budget_na853', '0')))}
                    </p>
                  </div>
                )}
                
                {getValue('budget_na271') && getValue('budget_na271') !== 'Δ/Υ' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-blue-700">Προϋπολογισμός ΝΑ271</label>
                    <p className="text-blue-900 bg-white px-3 py-2 rounded border font-semibold">
                      {formatCurrency(parseFloat(getValue('budget_na271', '0')))}
                    </p>
                  </div>
                )}
                
                {getValue('budget_e069') && getValue('budget_e069') !== 'Δ/Υ' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-blue-700">Προϋπολογισμός Ε069</label>
                    <p className="text-blue-900 bg-white px-3 py-2 rounded border font-semibold">
                      {formatCurrency(parseFloat(getValue('budget_e069', '0')))}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6">
            <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
              <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Λεπτομέρειες
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getValue('event_year') && getValue('event_year') !== 'Δ/Υ' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-purple-700">Έτη Συμβάντος</label>
                    <p className="text-purple-900 bg-white px-3 py-2 rounded border">
                      {formatArray(getValue('event_year'))}
                    </p>
                  </div>
                )}
                
                {getValue('e069') && getValue('e069') !== 'Δ/Υ' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-purple-700">Κωδικός E069</label>
                    <p className="text-purple-900 bg-white px-3 py-2 rounded border font-mono">
                      {getValue('e069')}
                    </p>
                  </div>
                )}
                
                {getValue('na271') && getValue('na271') !== 'Δ/Υ' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-purple-700">Κωδικός ΝΑ271</label>
                    <p className="text-purple-900 bg-white px-3 py-2 rounded border font-mono">
                      {getValue('na271')}
                    </p>
                  </div>
                )}
                
                {getValue('event_type_id') && getValue('event_type_id') !== 'Δ/Υ' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-purple-700">ID Τύπου Συμβάντος</label>
                    <p className="text-purple-900 bg-white px-3 py-2 rounded border">
                      {getValue('event_type_id')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Technical Tab */}
          <TabsContent value="technical" className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Hash className="w-5 h-5" />
                Τεχνικά Στοιχεία
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">ID Έργου</label>
                  <p className="text-gray-900 bg-white px-3 py-2 rounded border font-mono">
                    {getValue('id')}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Ημερομηνία Δημιουργίας</label>
                  <p className="text-gray-900 bg-white px-3 py-2 rounded border flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    {getValue('created_at') ? new Date(getValue('created_at')).toLocaleDateString('el-GR') : 'Δ/Υ'}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Ημερομηνία Ενημέρωσης</label>
                  <p className="text-gray-900 bg-white px-3 py-2 rounded border flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-600" />
                    {getValue('updated_at') ? new Date(getValue('updated_at')).toLocaleDateString('el-GR') : 'Δ/Υ'}
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}