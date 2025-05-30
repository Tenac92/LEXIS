import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  User, 
  MapPin, 
  FileText, 
  Calendar, 
  Euro,
  Building2,
  Hash,
  Phone,
  Mail,
  X
} from "lucide-react";
import type { Beneficiary } from "@shared/schema";

interface BeneficiaryDetailsModalProps {
  beneficiary: Beneficiary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BeneficiaryDetailsModal({ 
  beneficiary, 
  open, 
  onOpenChange 
}: BeneficiaryDetailsModalProps) {
  if (!beneficiary) return null;

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '€0,00';
    return new Intl.NumberFormat("el-GR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getFinancialStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'submitted':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Parse financial data
  let financialData = null;
  try {
    if (beneficiary.oikonomika && typeof beneficiary.oikonomika === 'string') {
      financialData = JSON.parse(beneficiary.oikonomika);
    } else if (beneficiary.oikonomika && typeof beneficiary.oikonomika === 'object') {
      financialData = beneficiary.oikonomika;
    }
  } catch (error) {
    console.error('Error parsing financial data:', error);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-gray-900">
              Λεπτομέρειες Δικαιούχου
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Personal Information */}
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Προσωπικά Στοιχεία
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-blue-800">Πλήρες Όνομα:</label>
                <p className="text-blue-900 font-medium">
                  {beneficiary.surname} {beneficiary.name}
                  {beneficiary.fathername && (
                    <span className="text-blue-700"> του {beneficiary.fathername}</span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-blue-800">ΑΦΜ:</label>
                <p className="text-blue-900 font-mono font-medium">{beneficiary.afm}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-blue-800">Περιφέρεια:</label>
                <p className="text-blue-900">{beneficiary.region || 'Δ/Υ'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-blue-800">Μονάδα:</label>
                <p className="text-blue-900">{beneficiary.monada || 'Δ/Υ'}</p>
              </div>
            </div>
          </div>

          {/* Administrative Information */}
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Διοικητικά Στοιχεία
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Αρ. Άδειας:</label>
                <p className="text-gray-900 font-mono">{beneficiary.adeia || 'Δ/Υ'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Αρ. Διαδικτυακού Φακέλου:</label>
                <p className="text-gray-900 font-mono">{beneficiary.onlinefoldernumber || 'Δ/Υ'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Έργο:</label>
                <p className="text-gray-900">{beneficiary.project || 'Δ/Υ'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Α/Α:</label>
                <p className="text-gray-900">{beneficiary.aa || 'Δ/Υ'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Ημερομηνία:</label>
                <p className="text-gray-900">{beneficiary.date || 'Δ/Υ'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Ημερομηνία Δημιουργίας:</label>
                <p className="text-gray-900">
                  {beneficiary.created_at ? new Date(beneficiary.created_at).toLocaleDateString('el-GR') : 'Δ/Υ'}
                </p>
              </div>
            </div>
          </div>

          {/* Financial Information */}
          {financialData && (
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                <Euro className="w-5 h-5" />
                Οικονομικά Στοιχεία
              </h3>
              <div className="space-y-4">
                {Object.entries(financialData).map(([key, value]: [string, any]) => (
                  <div key={key} className="bg-white p-4 rounded border border-green-200">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-green-900">Τύπος Δαπάνης: {key}</h4>
                      <Badge className={getFinancialStatusColor(value.status || 'pending')}>
                        {value.status === 'paid' ? 'Πληρωμένο' :
                         value.status === 'submitted' ? 'Υποβλημένο' :
                         value.status === 'pending' ? 'Εκκρεμείς' : 'Άγνωστο'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-green-700 font-medium">Ποσό: </span>
                        <span className="text-green-900 font-mono">
                          {formatCurrency(value.amount || 0)}
                        </span>
                      </div>
                      {value.installment && (
                        <div>
                          <span className="text-green-700 font-medium">Δόση: </span>
                          <span className="text-green-900">{value.installment}</span>
                        </div>
                      )}
                      {value.protocol_number && (
                        <div>
                          <span className="text-green-700 font-medium">Αρ. Πρωτοκόλλου: </span>
                          <span className="text-green-900 font-mono">{value.protocol_number}</span>
                        </div>
                      )}
                      {value.date && (
                        <div>
                          <span className="text-green-700 font-medium">Ημερομηνία: </span>
                          <span className="text-green-900">
                            {new Date(value.date).toLocaleDateString('el-GR')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}