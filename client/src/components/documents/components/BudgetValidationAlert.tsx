import * as React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BudgetValidationAlertProps {
  validation: {
    status: "success" | "warning" | "error";
    canCreate: boolean;
    allowDocx: boolean;
    message: string;
    budgetType?: "pistosi" | "katanomi" | null;
  } | null;
  currentAmount: number;
  budgetData: any;
  selectedProjectId: string;
}

export function BudgetValidationAlert({
  validation,
  currentAmount,
  budgetData,
  selectedProjectId,
}: BudgetValidationAlertProps) {
  const { toast } = useToast();

  if (!validation || currentAmount <= 0) {
    return null;
  }

  const handleRequestReallocation = async (requestType: "ανακατανομή" | "χρηματοδότηση") => {
    try {
      const response = await fetch("/api/notifications/request-reallocation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          project_id: selectedProjectId,
          request_type: requestType,
          requested_amount: currentAmount,
          available_budget:
            requestType === "ανακατανομή"
              ? Number(budgetData?.available_budget) || 0
              : Number(budgetData?.katanomes_etous) || 0,
          shortage:
            requestType === "ανακατανομή"
              ? currentAmount - (Number(budgetData?.available_budget) || 0)
              : currentAmount -
                (Number(budgetData?.katanomes_etous) || 0) +
                (Number(budgetData?.user_view) || 0),
        }),
      });

      if (response.ok) {
        toast({
          title: `Αίτημα ${requestType === "ανακατανομή" ? "Ανακατανομής" : "Χρηματοδότησης"} Απεστάλη`,
          description: "Το αίτημα στάλθηκε στον διαχειριστή για έγκριση.",
        });
      } else {
        throw new Error("Failed");
      }
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία αποστολής αιτήματος.",
        variant: "destructive",
      });
    }
  };

  // ΠΙΣΤΩΣΗ EXCEEDED - Hard block
  if (validation.budgetType === "pistosi") {
    return (
      <Alert variant="destructive" className="border-red-300 bg-red-50">
        <AlertCircle className="h-5 w-5 text-red-600" />
        <AlertDescription className="ml-2">
          <div className="space-y-2">
            <h4 className="font-semibold text-red-800">
              Υπέρβαση Πίστωσης - Δεν Μπορείτε να Συνεχίσετε
            </h4>
            <p className="text-sm text-red-700">
              Το ποσό{" "}
              <strong>
                {currentAmount.toLocaleString("el-GR", {
                  style: "currency",
                  currency: "EUR",
                })}
              </strong>{" "}
              υπερβαίνει την ετήσια πίστωση (
              {Number(budgetData?.ethsia_pistosi || 0).toLocaleString("el-GR", {
                style: "currency",
                currency: "EUR",
              })}
              ).
            </p>
            <p className="text-sm text-red-600 font-medium">
              Πρέπει να ζητήσετε ανακατανομή προϋπολογισμού για να συνεχίσετε.
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => handleRequestReallocation("ανακατανομή")}
              className="mt-2"
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              Αίτημα Ανακατανομής
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // ΚΑΤΑΝΟΜΗ ΕΤΟΥΣ EXCEEDED - Soft block
  if (validation.budgetType === "katanomi") {
    return (
      <Alert className="border-amber-300 bg-amber-50">
        <AlertCircle className="h-5 w-5 text-amber-600" />
        <AlertDescription className="ml-2">
          <div className="space-y-2">
            <h4 className="font-semibold text-amber-800">
              Υπέρβαση Κατανομής Έτους - Απαιτείται Χρηματοδότηση
            </h4>
            <p className="text-sm text-amber-700">
              Το ποσό{" "}
              <strong>
                {currentAmount.toLocaleString("el-GR", {
                  style: "currency",
                  currency: "EUR",
                })}
              </strong>{" "}
              υπερβαίνει την κατανομή έτους (
              {Number(budgetData?.katanomes_etous || 0).toLocaleString("el-GR", {
                style: "currency",
                currency: "EUR",
              })}
              ).
            </p>
            <p className="text-sm text-amber-600">
              <strong>Μπορείτε να αποθηκεύσετε το έγγραφο</strong>, αλλά δεν θα
              μπορέσετε να εξάγετε DOCX μέχρι να εγκριθεί η χρηματοδότηση.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleRequestReallocation("χρηματοδότηση")}
              className="mt-2 bg-white border-amber-400 text-amber-700 hover:bg-amber-50"
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              Αίτημα Χρηματοδότησης
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Generic warning/error (fallback)
  if (!validation.canCreate) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Υπέρβαση Προϋπολογισμού:</strong>{" "}
          {validation.message || "Το ποσό υπερβαίνει τον διαθέσιμο προϋπολογισμό."}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
