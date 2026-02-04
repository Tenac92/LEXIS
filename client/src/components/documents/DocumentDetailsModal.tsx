import { useState } from "react";
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
  FileText,
  Calendar,
  User,
  Euro,
  Hash,
  CheckCircle,
  Clock,
  AlertCircle,
  FileEdit,
  X,
  Edit3,
} from "lucide-react";
import type { GeneratedDocument } from "@shared/schema";
import { EditDocumentModal } from "./edit-document-modal";
import { useQuery } from "@tanstack/react-query";

interface DocumentDetailsModalProps {
  document: GeneratedDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Recipient {
  firstname: string;
  lastname: string;
  fathername: string;
  afm: string;
  amount: number;
  installment: string;
  installments?: string[];
  installmentAmounts?: Record<string, number>;
  // ΕΚΤΟΣ ΕΔΡΑΣ fields
  month?: string;
  days?: number;
  daily_compensation?: number;
  accommodation_expenses?: number;
  kilometers_traveled?: number;
  price_per_km?: number;
  tickets_tolls_rental?: number;
  has_2_percent_deduction?: boolean;
  total_expense?: number;
  deduction_2_percent?: number;
  net_payable?: number;
}

const getStatusDetails = (status: string, is_correction: boolean | null) => {
  if (is_correction) {
    return {
      label: "Ορθή Επανάληψη",
      className: "bg-purple-100 text-purple-800",
      icon: FileEdit,
    };
  }

  switch (status) {
    case "draft":
      return {
        label: "Προσχέδιο",
        className: "bg-gray-100 text-gray-800",
        icon: Clock,
      };
    case "pending":
      return {
        label: "Εκκρεμεί",
        className: "bg-yellow-100 text-yellow-800",
        icon: Clock,
      };
    case "approved":
      return {
        label: "Εγκεκριμένο",
        className: "bg-green-100 text-green-800",
        icon: CheckCircle,
      };
    case "rejected":
      return {
        label: "Απορρίφθηκε",
        className: "bg-red-100 text-red-800",
        icon: X,
      };
    case "completed":
      return {
        label: "Ολοκληρώθηκε",
        className: "bg-blue-100 text-blue-800",
        icon: CheckCircle,
      };
    // Legacy status support
    case "ready":
      return {
        label: "Έτοιμο",
        className: "bg-green-100 text-green-800",
        icon: CheckCircle,
      };
    case "sent":
      return {
        label: "Απεσταλμένο",
        className: "bg-blue-100 text-blue-800",
        icon: CheckCircle,
      };
    default:
      return {
        label: "Άγνωστη Κατάσταση",
        className: "bg-red-100 text-red-800",
        icon: AlertCircle,
      };
  }
};

export function DocumentDetailsModal({
  document,
  open,
  onOpenChange,
}: DocumentDetailsModalProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Fetch recipients with decrypted AFM values from the API
  const { data: recipientsData = [], isLoading: recipientsLoading } = useQuery<any[]>({
    queryKey: [`/api/documents/${document?.id}/beneficiaries`],
    enabled: !!document?.id && open,
    staleTime: 5 * 60 * 1000,
  });

  if (!document) return null;

  const docAny = document as any; // Type assertion for accessing additional properties
  const statusDetails = getStatusDetails(document.status || "draft", document.is_correction || null);

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "€0,00";
    return new Intl.NumberFormat("el-GR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Transform recipients data from API
  const recipients: Recipient[] = recipientsData.map((item: any) => {
    // Handle both employee payments (ΕΚΤΟΣ ΕΔΡΑΣ) and beneficiary payments
    if (item.employee_id !== undefined) {
      // Employee payment format (ΕΚΤΟΣ ΕΔΡΑΣ)
      return {
        firstname: item.firstname || "",
        lastname: item.lastname || "",
        fathername: item.fathername || "",
        afm: item.afm || "",
        amount: Number(item.amount) || 0,
        installment: "",
        month: item.month,
        days: item.days,
        daily_compensation: item.daily_compensation,
        accommodation_expenses: item.accommodation_expenses,
        kilometers_traveled: item.kilometers_traveled,
        tickets_tolls_rental: item.tickets_tolls_rental,
        has_2_percent_deduction: item.has_2_percent_deduction,
        total_expense: item.total_expense,
        deduction_2_percent: item.deduction_2_percent,
      };
    } else if (item.beneficiaries) {
      // Beneficiary payment format (standard)
      const beneficiary = Array.isArray(item.beneficiaries) 
        ? item.beneficiaries[0] 
        : item.beneficiaries;
      return {
        firstname: beneficiary?.name || "",
        lastname: beneficiary?.surname || "",
        fathername: beneficiary?.fathername || "",
        afm: beneficiary?.afm || "",
        amount: Number(item.amount) || 0,
        installment: item.installment || "",
      };
    } else {
      // Fallback for unexpected format
      return {
        firstname: "",
        lastname: "",
        fathername: "",
        afm: "",
        amount: 0,
        installment: "",
      };
    }
  });

  // Check if this is an ΕΚΤΟΣ ΕΔΡΑΣ document
  const isEktosEdras = docAny.expenditure_type === "ΕΚΤΟΣ ΕΔΡΑΣ";

  const totalAmount = recipients.reduce(
    (sum, recipient) => sum + (recipient.amount || 0),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl font-bold text-gray-900">
                Λεπτομέρειες Εγγράφου
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                Πλήρη στοιχεία και πληροφορίες για το επιλεγμένο έγγραφο
              </DialogDescription>
            </div>
            <Button
              onClick={() => setEditModalOpen(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Edit3 className="w-4 h-4" />
              Επεξεργασία
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Document Information */}
          <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
            <h3 className="text-lg font-semibold text-orange-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Στοιχεία Εγγράφου
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-orange-700">
                  Αριθμός Εγγράφου
                </label>
                <p className="text-orange-900 font-semibold bg-white px-3 py-2 rounded border">
                  {document.protocol_number_input
                    ? `${document.protocol_number_input}/${document.protocol_date ? new Date(document.protocol_date).toLocaleDateString("el-GR") : ""}`
                    : `Έγγραφο #${document.id}`}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-orange-700">
                  Κατάσταση
                </label>
                <div className="flex items-center">
                  <Badge className={`text-sm ${statusDetails.className}`}>
                    <statusDetails.icon className="h-3 w-3 mr-1" />
                    {statusDetails.label}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-orange-700">
                  Τύπος Δαπάνης
                </label>
                <p className="text-orange-900 bg-white px-3 py-2 rounded border">
                  {docAny.expenditure_type || "Δ/Υ"}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-orange-700">
                  Ημερομηνία Δημιουργίας
                </label>
                <p className="text-orange-900 bg-white px-3 py-2 rounded border flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-600" />
                  {document.created_at
                    ? new Date(document.created_at).toLocaleDateString("el-GR")
                    : "Δ/Υ"}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-orange-700">
                  Τελευταία Ενημέρωση
                </label>
                <p className="text-orange-900 bg-white px-3 py-2 rounded border flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-600" />
                  {document.updated_at
                    ? new Date(document.updated_at).toLocaleDateString("el-GR")
                    : "Δ/Υ"}
                </p>
              </div>
              {docAny.project_na853 && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-orange-700">
                    ΝΑ853
                  </label>
                  <p className="text-orange-900 bg-white px-3 py-2 rounded border font-mono">
                    {docAny.project_na853}
                  </p>
                </div>
              )}
              {docAny.unit && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-orange-700">
                    Μονάδα
                  </label>
                  <p className="text-orange-900 bg-white px-3 py-2 rounded border">
                    {docAny.unit}
                  </p>
                </div>
              )}
              {document.total_amount && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-orange-700">
                    Συνολικό Ποσό
                  </label>
                  <p className="text-orange-900 bg-white px-3 py-2 rounded border font-semibold flex items-center gap-2">
                    <Euro className="w-4 h-4 text-orange-600" />
                    {formatCurrency(parseFloat(document.total_amount))}
                  </p>
                </div>
              )}
              {docAny.project_id && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-orange-700">
                    ID Έργου
                  </label>
                  <p className="text-orange-900 bg-white px-3 py-2 rounded border font-mono flex items-center gap-2">
                    <Hash className="w-4 h-4 text-orange-600" />
                    {docAny.project_id}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recipients Information */}
          {recipients.length > 0 && (
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-green-900 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Δικαιούχοι ({recipients.length})
                </h3>
                <div className="bg-green-100 px-4 py-2 rounded-lg border border-green-300">
                  <span className="text-green-700 text-sm font-medium">
                    Συνολικό Ποσό:{" "}
                  </span>
                  <span className="text-green-900 font-bold text-lg">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {recipients.map((recipient, index) => (
                  <div
                    key={index}
                    className="bg-white p-4 rounded-lg border border-green-200 shadow-sm"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-green-600 uppercase tracking-wide">
                          Δικαιούχος
                        </label>
                        <p className="text-green-900 font-medium">
                          {recipient.lastname} {recipient.firstname}
                          {recipient.fathername && (
                            <span className="text-green-700 text-sm block">
                              του {recipient.fathername}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-green-600 uppercase tracking-wide">
                          ΑΦΜ
                        </label>
                        <p className="text-green-900 font-mono font-medium bg-green-50 px-2 py-1 rounded">
                          {recipient.afm}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-green-600 uppercase tracking-wide">
                          Ποσό
                        </label>
                        <p className="text-green-900 font-bold text-lg bg-green-50 px-2 py-1 rounded">
                          {formatCurrency(recipient.amount)}
                        </p>
                      </div>

                      {recipient.installment && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-green-600 uppercase tracking-wide">
                            Δόση
                          </label>
                          <p className="text-green-900 font-medium bg-green-50 px-2 py-1 rounded">
                            {recipient.installment}
                          </p>
                        </div>
                      )}

                      {recipient.installments &&
                        recipient.installments.length > 1 && (
                          <div className="md:col-span-2 lg:col-span-4 space-y-1">
                            <label className="text-xs font-medium text-green-600 uppercase tracking-wide">
                              Όλες οι Δόσεις
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {recipient.installments.map((inst, instIndex) => (
                                <span
                                  key={instIndex}
                                  className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm"
                                >
                                  {inst}:{" "}
                                  {recipient.installmentAmounts &&
                                    formatCurrency(
                                      recipient.installmentAmounts[inst] || 0,
                                    )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* ΕΚΤΟΣ ΕΔΡΑΣ specific fields */}
                      {isEktosEdras && recipient.month && (
                        <div className="md:col-span-2 lg:col-span-4 space-y-2">
                          <label className="text-xs font-medium text-green-600 uppercase tracking-wide">
                            Στοιχεία Μετακίνησης
                          </label>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-green-50 p-3 rounded-lg border border-green-200">
                            <div className="space-y-1">
                              <span className="text-xs text-green-600 font-medium">Μήνας</span>
                              <p className="text-green-900 font-semibold">{recipient.month}</p>
                            </div>
                            {recipient.days !== undefined && (
                              <div className="space-y-1">
                                <span className="text-xs text-green-600 font-medium">Ημέρες</span>
                                <p className="text-green-900 font-semibold">{recipient.days}</p>
                              </div>
                            )}
                            {recipient.daily_compensation !== undefined && recipient.daily_compensation > 0 && (
                              <div className="space-y-1">
                                <span className="text-xs text-green-600 font-medium">Συνολική Ημερ. Αποζημίωση</span>
                                <p className="text-green-900 font-semibold">{formatCurrency(recipient.daily_compensation)}</p>
                              </div>
                            )}
                            {recipient.accommodation_expenses !== undefined && recipient.accommodation_expenses > 0 && (
                              <div className="space-y-1">
                                <span className="text-xs text-green-600 font-medium">Δαπάνες Διαμονής</span>
                                <p className="text-green-900 font-semibold">{formatCurrency(recipient.accommodation_expenses)}</p>
                              </div>
                            )}
                            {recipient.kilometers_traveled !== undefined && recipient.kilometers_traveled > 0 && (
                              <div className="space-y-1">
                                <span className="text-xs text-green-600 font-medium">Χιλιόμετρα</span>
                                <p className="text-green-900 font-semibold">{recipient.kilometers_traveled} km</p>
                              </div>
                            )}
                            {recipient.price_per_km !== undefined && recipient.price_per_km > 0 && (
                              <div className="space-y-1">
                                <span className="text-xs text-green-600 font-medium">Τιμή/Χλμ</span>
                                <p className="text-green-900 font-semibold">{formatCurrency(recipient.price_per_km)}</p>
                              </div>
                            )}
                            {recipient.tickets_tolls_rental !== undefined && recipient.tickets_tolls_rental > 0 && (
                              <div className="space-y-1">
                                <span className="text-xs text-green-600 font-medium">Εισιτήρια/Διόδια/Ενοικίαση</span>
                                <p className="text-green-900 font-semibold">{formatCurrency(recipient.tickets_tolls_rental)}</p>
                              </div>
                            )}
                            {recipient.net_payable !== undefined && (
                              <div className="space-y-1">
                                <span className="text-xs text-green-600 font-medium">Καθαρό Πληρωτέο</span>
                                <p className="text-green-900 font-bold text-base">{formatCurrency(recipient.net_payable)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payments Information */}
          {docAny.payment_count > 0 && (
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Πληρωμές ({docAny.payment_count})
              </h3>
              {docAny.latest_payment_date && (
                <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-blue-700">
                        Ημερομηνία Πληρωμής (Τελευταία)
                      </label>
                      <p className="text-blue-900 font-semibold bg-blue-50 px-3 py-2 rounded">
                        {new Date(docAny.latest_payment_date).toLocaleDateString(
                          "el-GR",
                        )}
                      </p>
                    </div>
                    {docAny.latest_eps && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-blue-700">
                          EPS (Ελεύθερο κείμενο)
                        </label>
                        <p className="text-blue-900 font-semibold bg-blue-50 px-3 py-2 rounded truncate">
                          {docAny.latest_eps}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>

      {/* Edit Document Modal */}
      <EditDocumentModal
        document={document}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
      />
    </Dialog>
  );
}
