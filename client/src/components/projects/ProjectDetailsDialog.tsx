import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Building2, BriefcaseBusiness, Target, Euro, Hash } from "lucide-react";
import { type Project } from "@shared/schema";

interface ProjectDetailsDialogProps {
  project: Project;
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

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Στοιχεία Έργου
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Πλήρη στοιχεία και πληροφορίες για το επιλεγμένο έργο
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Project Information */}
          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-green-900 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Στοιχεία Έργου
              </h3>
              <Badge variant="secondary" className={getStatusColor(project.status || '')}>
                {getStatusText(project.status || '')}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1 md:col-span-2 lg:col-span-3">
                <label className="text-sm font-medium text-green-700">Τίτλος Έργου</label>
                <p className="text-green-900 font-semibold bg-white px-3 py-2 rounded border">
                  {project.title || "Έργο Χωρίς Τίτλο"}
                </p>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-green-700">Κωδικός MIS</label>
                <p className="text-green-900 bg-white px-3 py-2 rounded border font-mono flex items-center gap-2">
                  <Hash className="w-4 h-4 text-green-600" />
                  {project.mis}
                </p>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-green-700">Περιφέρεια</label>
                <p className="text-green-900 bg-white px-3 py-2 rounded border flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-green-600" />
                  {getRegionText(project)}
                </p>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-green-700">Ημερομηνία Δημιουργίας</label>
                <p className="text-green-900 bg-white px-3 py-2 rounded border flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-green-600" />
                  {project.created_at ? new Date(project.created_at).toLocaleDateString('el-GR') : 'Δ/Υ'}
                </p>
              </div>
              
              {project.implementing_agency && (
                <div className="space-y-1 md:col-span-2 lg:col-span-3">
                  <label className="text-sm font-medium text-green-700">Φορέας Υλοποίησης</label>
                  <p className="text-green-900 bg-white px-3 py-2 rounded border flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-green-600" />
                    {Array.isArray(project.implementing_agency) ? project.implementing_agency.join(', ') : project.implementing_agency}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Budget Information */}
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <Euro className="w-5 h-5" />
              Προϋπολογισμός
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {project.budget_na853 && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-blue-700">ΝΑ853</label>
                  <p className="text-blue-900 bg-white px-3 py-2 rounded border font-semibold">
                    {formatCurrency(parseFloat(project.budget_na853))}
                  </p>
                </div>
              )}
              
              {project.budget_na271 && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-blue-700">ΝΑ271</label>
                  <p className="text-blue-900 bg-white px-3 py-2 rounded border font-semibold">
                    {formatCurrency(parseFloat(project.budget_na271))}
                  </p>
                </div>
              )}
              
              {project.budget_e069 && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-blue-700">Ε069</label>
                  <p className="text-blue-900 bg-white px-3 py-2 rounded border font-semibold">
                    {formatCurrency(parseFloat(project.budget_e069))}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Expenditure Types */}
          {project.expenditure_type && project.expenditure_type.length > 0 && (
            <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
              <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                <BriefcaseBusiness className="w-5 h-5" />
                Τύποι Δαπανών ({project.expenditure_type.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {project.expenditure_type.map((type, index) => (
                  <span key={index} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm border border-purple-300">
                    {type}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}