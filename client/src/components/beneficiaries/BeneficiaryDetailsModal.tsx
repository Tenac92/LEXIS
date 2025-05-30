import {
  Dialog,
  DialogContent,
  DialogDescription,
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
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Λεπτομέρειες Δικαιούχου
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Πλήρη στοιχεία και πληροφορίες για τον επιλεγμένο δικαιούχο
          </DialogDescription>
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
                <label className="text-sm font-medium text-gray-700">Έργο (MIS):</label>
                <p className="text-gray-900 font-mono">{beneficiary.project || 'Δ/Υ'}</p>
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

          {/* Engineering Information */}
          {(beneficiary.cengsur1 || beneficiary.cengsur2) && (
            <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
              <h3 className="text-lg font-semibold text-orange-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Στοιχεία Μηχανικών
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {beneficiary.cengsur1 && (
                  <div className="bg-white p-4 rounded border border-orange-200">
                    <label className="text-sm font-medium text-orange-800">Μηχανικός 1:</label>
                    <p className="text-orange-900 font-medium">
                      {beneficiary.cengsur1} {beneficiary.cengname1}
                    </p>
                  </div>
                )}
                {beneficiary.cengsur2 && (
                  <div className="bg-white p-4 rounded border border-orange-200">
                    <label className="text-sm font-medium text-orange-800">Μηχανικός 2:</label>
                    <p className="text-orange-900 font-medium">
                      {beneficiary.cengsur2} {beneficiary.cengname2}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Free Text */}
          {beneficiary.freetext && (
            <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
              <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Ελεύθερο Κείμενο
              </h3>
              <div className="bg-white p-4 rounded border border-purple-200">
                <p className="text-purple-900 whitespace-pre-wrap">{beneficiary.freetext}</p>
              </div>
            </div>
          )}

          {/* Financial Information */}
          {financialData && (
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                <Euro className="w-5 h-5" />
                Οικονομικά Στοιχεία
              </h3>
              <div className="space-y-4">
                {Object.entries(financialData).map(([paymentType, paymentData]: [string, any]) => (
                  <div key={paymentType} className="bg-white p-4 rounded border border-green-200">
                    <h4 className="font-medium text-green-900 mb-3">Τύπος Δαπάνης: {paymentType}</h4>
                    
                    {typeof paymentData === 'object' && paymentData !== null ? (
                      <div className="space-y-3">
                        {Object.entries(paymentData).map(([installment, installmentData]: [string, any]) => (
                          <div key={installment} className="bg-green-25 p-3 rounded border border-green-100">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-medium text-green-800">Δόση: {installment}</span>
                              {installmentData && typeof installmentData === 'object' && installmentData.status && (
                                <Badge className={getFinancialStatusColor(installmentData.status)}>
                                  {installmentData.status === 'paid' ? 'Πληρωμένο' :
                                   installmentData.status === 'submitted' ? 'Υποβλημένο' :
                                   installmentData.status === 'pending' ? 'Εκκρεμές' : 
                                   installmentData.status || 'Εκκρεμές'}
                                </Badge>
                              )}
                            </div>
                            
                            {installmentData && typeof installmentData === 'object' ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                {installmentData.amount && (
                                  <div>
                                    <span className="text-green-700 font-medium">Ποσό: </span>
                                    <span className="text-green-900 font-mono">
                                      {formatCurrency(installmentData.amount)}
                                    </span>
                                  </div>
                                )}
                                {installmentData.protocol && (
                                  <div>
                                    <span className="text-green-700 font-medium">Αρ. Πρωτοκόλλου: </span>
                                    <span className="text-green-900 font-mono">{installmentData.protocol}</span>
                                  </div>
                                )}
                                {installmentData.date && (
                                  <div>
                                    <span className="text-green-700 font-medium">Ημερομηνία: </span>
                                    <span className="text-green-900">
                                      {installmentData.date === null ? 'Δ/Υ' : 
                                       new Date(installmentData.date).toLocaleDateString('el-GR')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-green-700">
                                Τιμή: {String(installmentData)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-green-700">
                        Τιμή: {String(paymentData)}
                      </div>
                    )}
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