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
  X,
  CreditCard,
  DollarSign,
  Copy,
  TrendingUp,
  Clock,
  Receipt
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  
  if (!beneficiary) return null;

  // Fetch all payments for this specific beneficiary
  const { data: allPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/beneficiary-payments"],
    enabled: open
  });

  // Filter payments for this specific beneficiary
  const payments = Array.isArray(allPayments) ? 
    allPayments.filter((payment: any) => payment.beneficiary_id === beneficiary.id) : [];

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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Αντιγράφηκε",
        description: `Το ${label} αντιγράφηκε στο πρόχειρο`,
      });
    }).catch(() => {
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία αντιγραφής στο πρόχειρο",
        variant: "destructive",
      });
    });
  };

  // Calculate total amount from payments
  const totalAmount = Array.isArray(payments) ? 
    payments.reduce((sum: number, payment: any) => sum + (parseFloat(payment.amount) || 0), 0) : 0;

  // Group payments by expenditure type
  const groupedPayments = Array.isArray(payments) ? 
    payments.reduce((acc: any, payment: any) => {
      const type = payment.expenditure_type || 'Άλλο';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(payment);
      return acc;
    }, {}) : {};

  // Parse financial data (legacy support)
  let financialData = null;
  try {
    const oikonomika = (beneficiary as any).oikonomika;
    if (oikonomika && typeof oikonomika === 'string') {
      financialData = JSON.parse(oikonomika);
    } else if (oikonomika && typeof oikonomika === 'object') {
      financialData = oikonomika;
    }
  } catch (error) {
    console.error('Error parsing financial data:', error);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <User className="w-7 h-7 text-blue-600" />
                Λεπτομέρειες Δικαιούχου
              </DialogTitle>
              <DialogDescription className="text-gray-600 mt-2">
                Πλήρη στοιχεία και οικονομικές πληροφορίες για{" "}
                <span className="font-semibold text-gray-800">
                  {beneficiary.surname} {beneficiary.name}
                </span>
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm">
                ID: {beneficiary.id}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(beneficiary.afm, "ΑΦΜ")}
                className="text-xs"
              >
                <Copy className="w-3 h-3 mr-1" />
                Αντιγραφή ΑΦΜ
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Personal Information */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 shadow-sm">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Προσωπικά Στοιχεία
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/70 p-4 rounded-lg border border-blue-200">
                <label className="text-sm font-medium text-blue-700 flex items-center gap-1">
                  <User className="w-4 h-4" />
                  Πλήρες Όνομα:
                </label>
                <p className="text-blue-900 font-semibold text-lg mt-1">
                  {beneficiary.surname} {beneficiary.name}
                  {beneficiary.fathername && (
                    <span className="text-blue-700 font-normal"> του {beneficiary.fathername}</span>
                  )}
                </p>
              </div>
              <div className="bg-white/70 p-4 rounded-lg border border-blue-200">
                <label className="text-sm font-medium text-blue-700 flex items-center gap-1">
                  <Hash className="w-4 h-4" />
                  ΑΦΜ:
                </label>
                <p className="text-blue-900 font-mono font-bold text-lg mt-1">{beneficiary.afm}</p>
              </div>
              <div className="bg-white/70 p-4 rounded-lg border border-blue-200">
                <label className="text-sm font-medium text-blue-700 flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  Περιφέρεια:
                </label>
                <p className="text-blue-900 font-medium mt-1">{beneficiary.region || 'Δεν έχει καθοριστεί'}</p>
              </div>
              <div className="bg-white/70 p-4 rounded-lg border border-blue-200">
                <label className="text-sm font-medium text-blue-700 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Ημερομηνία Εγγραφής:
                </label>
                <p className="text-blue-900 font-medium mt-1">
                  {beneficiary.date ? new Date(beneficiary.date).toLocaleDateString('el-GR') : 'Δεν έχει καθοριστεί'}
                </p>
              </div>
            </div>
          </div>

          {/* Administrative Information */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Διοικητικά Στοιχεία
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/70 p-4 rounded-lg border border-gray-200">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Receipt className="w-4 h-4" />
                  Αρ. Άδειας:
                </label>
                <p className="text-gray-900 font-mono font-medium text-lg mt-1">
                  {beneficiary.adeia || 'Δεν έχει καθοριστεί'}
                </p>
              </div>
              <div className="bg-white/70 p-4 rounded-lg border border-gray-200">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Hash className="w-4 h-4" />
                  Αρ. Διαδικτυακού Φακέλου:
                </label>
                <p className="text-gray-900 font-mono font-medium text-lg mt-1">
                  {beneficiary.onlinefoldernumber || 'Δεν έχει καθοριστεί'}
                </p>
              </div>
              <div className="bg-white/70 p-4 rounded-lg border border-gray-200">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Ημερομηνία Δημιουργίας:
                </label>
                <p className="text-gray-900 font-medium mt-1">
                  {beneficiary.created_at ? new Date(beneficiary.created_at).toLocaleDateString('el-GR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'Δεν έχει καθοριστεί'}
                </p>
              </div>
              <div className="bg-white/70 p-4 rounded-lg border border-gray-200">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Τελευταία Ενημέρωση:
                </label>
                <p className="text-gray-900 font-medium mt-1">
                  {beneficiary.updated_at ? new Date(beneficiary.updated_at).toLocaleDateString('el-GR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'Δεν έχει ενημερωθεί'}
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

          {/* Complete Payment Information */}
          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-green-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Πλήρη Οικονομικά Στοιχεία
              </h3>
              {paymentsLoading && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
              )}
            </div>
            
            {/* Summary */}
            {Array.isArray(payments) && payments.length > 0 && (
              <div className="bg-white p-4 rounded border border-green-200 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-900">{payments.length}</div>
                    <div className="text-sm text-green-700">Συνολικές Πληρωμές</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-900">{Object.keys(groupedPayments).length}</div>
                    <div className="text-sm text-green-700">Τύποι Δαπανών</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-900">{formatCurrency(totalAmount)}</div>
                    <div className="text-sm text-green-700">Συνολικό Ποσό</div>
                  </div>
                </div>
              </div>
            )}

            {paymentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-green-700">Φόρτωση πληρωμών...</div>
              </div>
            ) : Array.isArray(payments) && payments.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                {Object.entries(groupedPayments).map(([expenditureType, typePayments]) => {
                  const paymentsArray = typePayments as any[];
                  return (
                  <div key={expenditureType} className="bg-white p-4 rounded border border-green-200">
                    <h4 className="font-medium text-green-900 mb-3 flex items-center justify-between">
                      <span>Τύπος Δαπάνης: {expenditureType}</span>
                      <Badge variant="outline" className="text-green-700 border-green-300">
                        {paymentsArray.length} πληρωμές
                      </Badge>
                    </h4>
                    
                    <div className="space-y-3">
                      {paymentsArray.map((payment: any, index: number) => (
                        <div key={index} className="bg-green-25 p-3 rounded border border-green-100">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="font-medium text-green-800">
                                Δόση: {payment.installment || 'ΕΦΑΠΑΞ'}
                              </div>
                              <div className="text-sm text-green-700">
                                ID: {payment.id}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-900">
                                {formatCurrency(parseFloat(payment.amount || 0))}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            {payment.protocol && (
                              <div>
                                <span className="text-green-700 font-medium">Αρ. Πρωτοκόλλου: </span>
                                <span className="text-green-900 font-mono">{payment.protocol}</span>
                              </div>
                            )}
                            {payment.date && (
                              <div>
                                <span className="text-green-700 font-medium">Ημερομηνία: </span>
                                <span className="text-green-900">
                                  {new Date(payment.date).toLocaleDateString('el-GR')}
                                </span>
                              </div>
                            )}
                            {payment.created_at && (
                              <div>
                                <span className="text-green-700 font-medium">Καταχωρήθηκε: </span>
                                <span className="text-green-900">
                                  {new Date(payment.created_at).toLocaleDateString('el-GR')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-green-700">
                <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Δεν υπάρχουν καταχωρημένες πληρωμές για αυτόν τον δικαιούχο</p>
              </div>
            )}

            {/* Legacy Financial Data - if exists */}
            {financialData && (
              <div className="mt-6 pt-6 border-t border-green-200">
                <h4 className="font-medium text-green-900 mb-3">Παλαιά Δεδομένα (Legacy):</h4>
                <div className="bg-green-100 p-3 rounded text-sm">
                  <pre className="text-green-800 overflow-x-auto">
                    {JSON.stringify(financialData, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}