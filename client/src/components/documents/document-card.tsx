import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  User,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  FileEdit,
  Download,
  ClipboardCheck,
  Users,
  History,
  AlertCircle,
  Info,
  RotateCcw,
  Edit,
  Trash2,
  Building,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, memo, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import type { GeneratedDocument } from "@shared/schema";
import { EditDocumentModal } from "./edit-document-modal";
import { DocumentDetailsModal } from "./DocumentDetailsModal";
import { ViewDocumentModal } from "./document-modals";
import { apiRequest } from "@/lib/queryClient";

interface DocumentCardProps {
  document: GeneratedDocument;
  view?: "grid" | "list";
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

interface Recipient {
  firstname: string;
  lastname: string;
  fathername: string;
  afm: string;
  amount: number;
  installment?: string;
  installments?: string[];
  installmentAmounts?: Record<string, number>;
  // ΕΚΤΟΣ ΕΔΡΑΣ fields
  month?: string;
  days?: number;
  daily_compensation?: number;
  accommodation_expenses?: number;
  kilometers_traveled?: number;
  tickets_tolls_rental?: number;
  secondary_text?: string;
}

const getStatusDetails = (
  status: string,
  is_correction: boolean | null,
  protocol_number_input: string | null,
) => {
  // First check if this is an orthi epanalipsi and doesn't have a protocol number yet
  if (protocol_number_input) {
    return {
      label: "Ολοκληρωμένο",
      variant: "default" as const,
      icon: CheckCircle,
    };
  }
  if (is_correction && !protocol_number_input) {
    return {
      label: "Ορθή Επανάληψη",
      variant: "destructive" as const,
      icon: AlertCircle,
    };
  }

  // Then check other statuses
  switch (status) {
    case "completed":
      return {
        label: "Ολοκληρωμένο",
        variant: "default" as const,
        icon: CheckCircle,
      };
    case "pending":
      return {
        label: "Σε εκκρεμότητα",
        variant: "secondary" as const,
        icon: Clock,
      };
    default:
      return {
        label: "Σε εκκρεμότητα",
        variant: "secondary" as const,
        icon: Clock,
      };
  }
};

const DocumentCard = memo(function DocumentCard({
  document: doc,
  view = "grid",
  onView,
  onEdit,
  onDelete,
}: DocumentCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showProtocolModal, setShowProtocolModal] = useState(false);
  const [isReturned, setIsReturned] = useState((doc as any).is_returned || false);
  const [isTogglingReturn, setIsTogglingReturn] = useState(false);
  const { toast } = useToast();

  const handleCardClick = (e: React.MouseEvent) => {
    // Allow flipping anywhere on the card
    setIsFlipped(!isFlipped);
  };

  const handleExport = async () => {
    try {
      setIsLoading(true);
      // Use the both format parameter to generate both documents in a ZIP file
      const response = await fetch(
        `/api/documents/generated/${doc.id}/export?format=both`,
        {
          method: "GET",
          headers: {
            Accept:
              "application/zip, application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
        },
      );

      if (!response.ok) {
        // Check for budget validation block (403 with NEEDS_XRIMATODOTISI code)
        if (response.status === 403) {
          try {
            const errorData = await response.json();
            if (errorData.code === "NEEDS_XRIMATODOTISI") {
              toast({
                title: "Εξαγωγή DOCX Μπλοκαρισμένη",
                description: errorData.message || "Το έγγραφο χρειάζεται έγκριση χρηματοδότησης για εξαγωγή.",
                variant: "destructive",
              });
              setIsLoading(false);
              return;
            }
          } catch (parseError) {
            console.error("Failed to parse error response:", parseError);
          }
        }
        const errorText = await response.text();
        console.error("Export failed:", errorText);
        throw new Error("Failed to export document");
      }

      // Get the content type to determine if it's a ZIP or single document
      const contentType = response.headers.get("Content-Type");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Set appropriate filename based on content type
      if (contentType && contentType.includes("application/zip")) {
        link.download = `documents-${doc.id}.zip`;
      } else {
        link.download = `document-${doc.id}.docx`;
      }

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        description: "Τα έγγραφα εξήχθησαν επιτυχώς",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία εξαγωγής εγγράφων",
        variant: "destructive",
      });
      console.error("Export error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleReturn = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setIsTogglingReturn(true);
      const response = await apiRequest(`/api/documents/${doc.id}/toggle-returned`, {
        method: "POST",
      }) as { success: boolean; message: string; is_returned: boolean };

      if (response.success) {
        setIsReturned(response.is_returned);
        toast({
          description: response.message,
          variant: "default",
        });
      }
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία ενημέρωσης κατάστασης επιστροφής",
        variant: "destructive",
      });
      console.error("Toggle return error:", error);
    } finally {
      setIsTogglingReturn(false);
    }
  };

  const recipients = (doc as any).recipients as Recipient[];
  const docAny = doc as any; // Use type assertion to access potentially missing properties
  const projectNa853 = docAny.project_na853 || "";
  const statusDetails = getStatusDetails(
    doc.status || "pending",
    docAny.is_correction,
    doc.protocol_number_input || null,
  );

  // Count unique recipients by AFM (group payments by recipient)
  const uniqueRecipientCount = recipients?.length 
    ? new Set(recipients.map(r => r.afm)).size 
    : 0;

  // Group recipients by AFM with their payments
  const groupedRecipients = useMemo(() => {
    if (!recipients?.length) return [];
    
    const grouped = new Map<string, {
      afm: string;
      firstname: string;
      lastname: string;
      fathername: string;
      totalAmount: number;
      payments: Array<{
        installment: string;
        amount: number;
        month?: string;
        days?: number;
        daily_compensation?: number;
        accommodation_expenses?: number;
        kilometers_traveled?: number;
        tickets_tolls_rental?: number;
        secondary_text?: string;
        payment_date?: string | null;
        freetext?: string | null;
      }>;
    }>();

    recipients.forEach(r => {
      const key = r.afm || `${r.lastname}-${r.firstname}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          afm: r.afm,
          firstname: r.firstname,
          lastname: r.lastname,
          fathername: r.fathername,
          totalAmount: 0,
          payments: []
        });
      }
      const group = grouped.get(key)!;
      group.totalAmount += r.amount || 0;
      group.payments.push({
        installment: r.installment || r.month || '',
        amount: r.amount || 0,
        month: r.month,
        days: r.days,
        daily_compensation: r.daily_compensation,
        accommodation_expenses: r.accommodation_expenses,
        kilometers_traveled: r.kilometers_traveled,
        tickets_tolls_rental: r.tickets_tolls_rental,
        secondary_text: r.secondary_text,
        payment_date: (r as any).payment_date || null,
        freetext: (r as any).freetext || null,
      });
    });

    return Array.from(grouped.values());
  }, [recipients]);

  // Show orthi epanalipsi info when either condition is met
  const showOrthiEpanalipsiInfo =
    Boolean(docAny.is_correction) || Boolean(docAny.original_protocol_number);

  if (view === "list") {
    return (
      <>
        <Card
          className={`transition-shadow hover:shadow-lg flex cursor-pointer ${isReturned ? 'opacity-60 grayscale' : ''}`}
          onClick={() => setShowDetailsModal(true)}
        >
          <div className="p-6 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-foreground">
                    {doc.protocol_number_input && doc.protocol_date
                      ? `${doc.protocol_number_input}/${new Date(doc.protocol_date).toLocaleDateString("el-GR").replace(/\//g, '.')}`
                      : `Έγγραφο #${doc.id}`}
                  </h3>
                  <Badge variant={statusDetails.variant as any}>
                    {statusDetails.label}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="w-4 h-4" />
                      <span>Μονάδα: {(doc as any).unit}</span>
                    </div>
                    {uniqueRecipientCount > 0 && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>Δικαιούχοι ({uniqueRecipientCount})</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="w-4 h-4" />
                      <span>
                        Σύνολο:{" "}
                        {doc.total_amount
                          ? Number(doc.total_amount).toLocaleString("el-GR", {
                              style: "currency",
                              currency: "EUR",
                            })
                          : "Δ/Υ"}
                      </span>
                    </div>
                    {projectNa853 && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building className="w-4 h-4" />
                        <span>{projectNa853}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetailsModal(true);
                  }}
                >
                  <Info className="w-4 h-4 mr-2" />
                  Λεπτομέρειες
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport();
                  }}
                  disabled={isLoading}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Εξαγωγή
                </Button>
                {doc.protocol_number_input && (
                  <Button
                    size="sm"
                    variant={isReturned ? "default" : "outline"}
                    onClick={handleToggleReturn}
                    disabled={isTogglingReturn}
                    data-testid="button-toggle-returned"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Επεστράφη
                  </Button>
                )}
                <div className="flex gap-1">
                  {!docAny.is_correction && doc.protocol_number_input ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCorrectionModal(true);
                      }}
                      disabled={isLoading}
                      className="h-8 w-8 p-0 hover:bg-yellow-50 hover:text-yellow-600 transition-colors"
                      title="Ορθή Επανάληψη"
                    >
                      <History className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onView();
                      }}
                      disabled={isLoading || doc.status === "approved"}
                      className="h-8 w-8 p-0 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                      title="Πρωτόκολλο"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    title="Επεξεργασία"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Διαγραφή"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <DocumentDetailsModal
          document={doc}
          open={showDetailsModal}
          onOpenChange={setShowDetailsModal}
        />
      </>
    );
  }

  return (
    <>
      <div className={`flip-card ${isReturned ? 'opacity-60 grayscale' : ''}`} onClick={handleCardClick}>
        <div className={`flip-card-inner ${isFlipped ? "rotate-y-180" : ""}`}>
          {/* Front of card */}
          <div className="flip-card-front">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-500 to-orange-600"></div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2 flex-1">
                  <h3 className="text-xl font-bold text-gray-900 leading-tight">
                    {doc.protocol_number_input && doc.protocol_date
                      ? `${doc.protocol_number_input}/${new Date(doc.protocol_date).toLocaleDateString("el-GR").replace(/\//g, '.')}`
                      : `Έγγραφο #${doc.id}`}
                  </h3>
                  <Badge variant={statusDetails.variant}>
                    <statusDetails.icon className="h-3 w-3 mr-1" />
                    {statusDetails.label}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDetailsModal(true);
                    }}
                    className="h-8 w-8 p-0 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                    title="Λεπτομέρειες"
                  >
                    <Info className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    title="Επεξεργασία"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Διαγραφή"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Critical Information - Protocol and Status */}
              {doc.protocol_number_input && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-blue-800">
                      Αρ. Πρωτοκόλλου:
                    </span>
                    <span className="text-blue-900 font-mono">
                      {doc.protocol_number_input}
                    </span>
                  </div>
                  {doc.protocol_date && (
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm font-medium text-blue-800">
                        Ημερομηνία:
                      </span>
                      <span className="text-blue-900">
                        {new Date(doc.protocol_date).toLocaleDateString(
                          "el-GR",
                        ).replace(/\//g, '.')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Orthi Epanalipsi Information */}
              {showOrthiEpanalipsiInfo && (
                <div className="mb-4 p-3 bg-red-100 rounded-lg border border-red-200">
                  <p className="text-sm font-medium text-red-800">
                    Ορθή Επανάληψη του εγγράφου{" "}
                    {docAny.original_protocol_number}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-sm mb-6">
                <div className="flex flex-col py-1.5 px-2 bg-gray-50 rounded">
                  <span className="text-xs text-gray-600">Μονάδα</span>
                  <span className="text-gray-900 font-medium">{(doc as any).unit}</span>
                </div>
                <div className="flex flex-col py-1.5 px-2 bg-gray-50 rounded">
                  <span className="text-xs text-gray-600">Κωδικός MIS</span>
                  <span className="text-gray-900 font-mono">
                    {(doc as any).project_id || (doc as any).mis || "Δ/Υ"}
                  </span>
                </div>
                <div className="flex flex-col py-1.5 px-2 bg-gray-50 rounded">
                  <span className="text-xs text-gray-600">Συνολικό Ποσό</span>
                  <span className="text-gray-900 font-medium">
                    {parseFloat(
                      doc.total_amount?.toString() || "0",
                    ).toLocaleString("el-GR", {
                      style: "currency",
                      currency: "EUR",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex flex-col py-1.5 px-2 bg-gray-50 rounded">
                  <span className="text-xs text-gray-600">Δικαιούχοι</span>
                  <span className="text-gray-900">
                    ({uniqueRecipientCount})
                  </span>
                </div>
              </div>

              {/* Action Buttons - Critical for workflow */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport();
                  }}
                  disabled={isLoading}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Εξαγωγή
                </Button>
                {!docAny.is_correction && doc.protocol_number_input ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCorrectionModal(true);
                    }}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    <History className="h-4 w-4 mr-2" />
                    Ορθή Επανάληψη
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onView();
                    }}
                    disabled={isLoading || doc.status === "approved"}
                    className="flex-1"
                  >
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    Πρωτόκολλο
                  </Button>
                )}
              </div>

              {doc.protocol_number_input ? (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <Button
                    variant={isReturned ? "default" : "outline"}
                    size="sm"
                    onClick={handleToggleReturn}
                    disabled={isTogglingReturn}
                    className="flex-1"
                    data-testid="button-toggle-returned"
                  >
                    <RotateCcw className="h-4 h-4 mr-2" />
                    Επεστράφη
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFlipped(true);
                    }}
                    className="text-orange-600 border-orange-200 hover:bg-orange-50 flex-1"
                  >
                    <Info className="w-4 h-4 mr-2" />
                    Δείτε δικαιούχους
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFlipped(true);
                    }}
                    className="text-orange-600 border-orange-200 hover:bg-orange-50"
                  >
                    <Info className="w-4 h-4 mr-2" />
                    Δείτε δικαιούχους
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Back of card */}
          <div className="flip-card-back bg-orange-50">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-500 to-orange-600"></div>
            <div className="p-6 h-full overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-orange-900">
                    Λεπτομέρειες Εγγράφου
                  </h3>
                  <p className="text-orange-700 text-sm">Έγγραφο #{doc.id}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFlipped(false);
                  }}
                  className="h-8 w-8 p-0 hover:bg-orange-100 hover:text-orange-600 transition-colors"
                  title="Επιστροφή"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* Document Details */}
                <div className="space-y-2">
                  {doc.protocol_number_input && (
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-700 font-medium">
                        Αρ. Πρωτοκόλλου:
                      </span>
                      <span className="text-orange-900">
                        {doc.protocol_number_input}
                      </span>
                    </div>
                  )}
                  {doc.protocol_date && (
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-700 font-medium">
                        Ημερομηνία:
                      </span>
                      <span className="text-orange-900">
                        {new Date(doc.protocol_date).toLocaleDateString(
                          "el-GR",
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-700 font-medium">
                      Κωδικός ΝΑ853:
                    </span>
                    <span className="text-orange-900">
                      {projectNa853 || (doc as any).project_na853 || "Δ/Υ"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-700 font-medium">
                      Τύπος Δαπάνης:
                    </span>
                    <span className="text-orange-900">
                      {(doc as any).expenditure_type || "-"}
                    </span>
                  </div>
                  {(doc as any).latest_payment_date && (
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-700 font-medium">
                        Πληρωμή:
                      </span>
                      <span className="text-orange-900">
                        {new Date((doc as any).latest_payment_date).toLocaleDateString(
                          "el-GR",
                        )}
                      </span>
                    </div>
                  )}
                  {(doc as any).latest_eps && (
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-700 font-medium">
                        EPS:
                      </span>
                      <span className="text-orange-900 truncate">
                        {(doc as any).latest_eps}
                      </span>
                    </div>
                  )}
                </div>

                {/* Orthi Epanalipsi Details */}
                {showOrthiEpanalipsiInfo && (
                  <div className="pt-2 border-t border-orange-200">
                    <span className="text-orange-700 font-medium text-sm">
                      Ορθή Επανάληψη:
                    </span>
                    <div className="mt-1 p-2 bg-red-100 rounded border border-red-200">
                      <p className="text-sm text-red-800">
                        Αρ. πρωτ.: {docAny.original_protocol_number}
                        {docAny.original_protocol_date &&
                          ` (${new Date(docAny.original_protocol_date).toLocaleDateString("el-GR")})`}
                      </p>
                      {doc.comments && (
                        <p className="text-sm mt-1 text-red-700">
                          Λόγος: {doc.comments}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Recipients Summary - Grouped by recipient */}
                <div className="pt-2 border-t border-orange-200">
                  <span className="text-orange-700 font-medium text-sm">
                    Δικαιούχοι ({uniqueRecipientCount}):
                  </span>
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-3">
                    {groupedRecipients.slice(0, 5).map((group, index) => (
                      <div key={group.afm || index} className="text-sm" data-testid={`recipient-group-${index}`}>
                        {/* Recipient Name Header */}
                        <div className="flex justify-between items-center text-orange-900 font-medium">
                          <span className="truncate">
                            {group.lastname} {group.firstname}
                          </span>
                          <span className="text-orange-800 ml-2 flex-shrink-0">
                            {group.totalAmount.toLocaleString("el-GR", {
                              style: "currency",
                              currency: "EUR",
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        {/* Indented Payments List */}
                        {group.payments.length > 0 && (
                          <div className="mt-1 pl-3 border-l-2 border-orange-300 space-y-1">
                            {group.payments.map((payment, pIndex) => (
                              <div key={pIndex} className="text-xs text-orange-700 space-y-0.5">
                                <div className="flex justify-between items-center">
                                  <span>
                                    {payment.month 
                                      ? `Μήνας: ${payment.month}${payment.days ? ` (${payment.days} ημ.)` : ''}`
                                      : payment.installment || `Πληρωμή ${pIndex + 1}`
                                    }
                                  </span>
                                  <span className="font-medium ml-2">
                                    {payment.amount.toLocaleString("el-GR", {
                                      style: "currency",
                                      currency: "EUR",
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-orange-600">
                                  <Calendar className="w-3 h-3" />
                                  <span>
                                    Πληρωμή: {payment.payment_date
                                      ? new Date(payment.payment_date).toLocaleDateString("el-GR")
                                      : "—"}
                                  </span>
                                  <span className="ml-2 truncate" title={payment.freetext || "—"}>
                                    EPS: {payment.freetext || "—"}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {groupedRecipients.length > 5 && (
                      <div className="text-sm text-orange-700">
                        +{groupedRecipients.length - 5} περισσότεροι...
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-orange-200">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport();
                      }}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Εξαγωγή
                    </Button>
                    {!docAny.is_correction && doc.protocol_number_input ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCorrectionModal(true);
                        }}
                        disabled={isLoading}
                        className="flex-1"
                      >
                        <History className="h-4 w-4 mr-2" />
                        Ορθή Επανάληψη
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onView();
                        }}
                        disabled={isLoading || doc.status === "approved"}
                        className="flex-1"
                      >
                        <ClipboardCheck className="h-4 w-4 mr-2" />
                        Πρωτόκολλο
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EditDocumentModal
        open={showCorrectionModal}
        onOpenChange={setShowCorrectionModal}
        document={doc}
        mode="correction"
        onCorrectionSuccess={() => {
          // After successful correction, open the protocol modal
          setShowProtocolModal(true);
        }}
      />

      <DocumentDetailsModal
        document={doc}
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
      />

      <ViewDocumentModal
        isOpen={showProtocolModal}
        onClose={() => setShowProtocolModal(false)}
        document={doc}
      />
    </>
  );
});

export default DocumentCard;
