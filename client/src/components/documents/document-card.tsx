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
import { useState, useEffect, memo } from "react";
import { useToast } from "@/hooks/use-toast";
import type { GeneratedDocument } from "@shared/schema";
import { OrthiEpanalipsiModal } from "./orthi-epanalipsi-modal";
import { DocumentDetailsModal } from "./DocumentDetailsModal";
import { useQuery } from "@tanstack/react-query";
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
  installment: string;
  installments?: string[];
  installmentAmounts?: Record<string, number>;
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
  const [projectNa853, setProjectNa853] = useState<string>(
    (doc as any).project_na853 || "",
  );
  const { toast } = useToast();

  // Get the MIS code from the document
  const mis = (doc as any).project_id || (doc as any).mis || "";

  // Fetch project NA853 data from project resolver endpoint
  const { data: na853Data } = useQuery<any>({
    queryKey: ["/api/projects/na853", mis],
    queryFn: async () => {
      if (!mis) return null;
      try {
        console.log("Fetching NA853 for MIS:", mis);
        return await apiRequest(`/api/projects/na853/${mis}`);
      } catch (error) {
        console.error("Failed to fetch NA853 data:", error);
        return null;
      }
    },
    enabled: !!mis,
  });

  // Update NA853 when data is fetched from our special endpoint
  useEffect(() => {
    if (na853Data) {
      // Add debug log to see the structure of the response
      console.log("NA853 data received:", na853Data);

      try {
        // Our dedicated endpoint returns a simplified structure always containing na853
        if (na853Data && na853Data.na853) {
          console.log("Found NA853 from dedicated endpoint:", na853Data.na853);
          setProjectNa853(na853Data.na853);
        }
      } catch (error) {
        console.error("Error extracting NA853 from data:", error);
      }
    }
  }, [na853Data]);

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

  const recipients = (doc as any).recipients as Recipient[];
  const docAny = doc as any; // Use type assertion to access potentially missing properties
  const statusDetails = getStatusDetails(
    doc.status || "pending",
    docAny.is_correction,
    doc.protocol_number_input || null,
  );

  // Debug log to check values
  console.log("Document data:", {
    id: doc.id,
    is_correction: docAny.is_correction,
    original_protocol_number: docAny.original_protocol_number,
    original_protocol_date: docAny.original_protocol_date,
    comments: doc.comments,
  });

  // Show orthi epanalipsi info when either condition is met
  const showOrthiEpanalipsiInfo =
    Boolean(docAny.is_correction) || Boolean(docAny.original_protocol_number);

  if (view === "list") {
    return (
      <>
        <Card
          className="transition-shadow hover:shadow-lg flex cursor-pointer"
          onClick={() => setShowDetailsModal(true)}
        >
          <div className="p-6 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-foreground">
                    {doc.protocol_number_input && doc.protocol_date
                      ? `${doc.protocol_number_input}/${new Date(doc.protocol_date).toLocaleDateString("el-GR")}`
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
                    {recipients?.length > 0 && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>Δικαιούχοι: {recipients.length}</span>
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
      <div className="flip-card" onClick={handleCardClick}>
        <div className={`flip-card-inner ${isFlipped ? "rotate-y-180" : ""}`}>
          {/* Front of card */}
          <div className="flip-card-front">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-500 to-orange-600"></div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2 flex-1">
                  <h3 className="text-xl font-bold text-gray-900 leading-tight">
                    {doc.protocol_number_input && doc.protocol_date
                      ? `${doc.protocol_number_input}/${new Date(doc.protocol_date).toLocaleDateString("el-GR")}`
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
                        )}
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
                    {recipients?.length || 0}
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

              <div className="flex items-center justify-center">
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

                {/* Recipients Summary */}
                <div className="pt-2 border-t border-orange-200">
                  <span className="text-orange-700 font-medium text-sm">
                    Δικαιούχοι ({recipients?.length || 0}):
                  </span>
                  <div className="mt-1 max-h-32 overflow-y-auto space-y-1">
                    {recipients?.slice(0, 3).map((recipient, index) => (
                      <div key={index} className="text-sm text-orange-900 flex justify-between items-center">
                        <span className="truncate">
                          {recipient.lastname} {recipient.firstname}
                        </span>
                        <span className="text-orange-700 font-medium ml-2 flex-shrink-0">
                          {recipient.amount?.toLocaleString("el-GR", {
                            style: "currency",
                            currency: "EUR",
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    ))}
                    {recipients?.length > 3 && (
                      <div className="text-sm text-orange-700">
                        +{recipients.length - 3} περισσότεροι...
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

      <OrthiEpanalipsiModal
        isOpen={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        document={doc}
      />

      <DocumentDetailsModal
        document={doc}
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
      />
    </>
  );
});

export default DocumentCard;
