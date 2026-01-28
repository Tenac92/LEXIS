import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, FileX } from "lucide-react";
import { EsdianFieldsWithSuggestions } from "./EsdianFieldsWithSuggestions";
import type { UseFormReturn } from "react-hook-form";

interface AttachmentsAndExtrasStepProps {
  form: UseFormReturn<any>;
  attachments: any[];
  attachmentsLoading: boolean;
  user: any;
  onSelectAll?: () => void;
  onAttachmentToggle?: (id: string, checked: boolean) => void;
}

export function AttachmentsAndExtrasStep({
  form,
  attachments,
  attachmentsLoading,
  user,
  onSelectAll,
  onAttachmentToggle,
}: AttachmentsAndExtrasStepProps) {
  const selectedAttachments = form.watch("selectedAttachments") || [];
  const validAttachments = attachments.filter((att: any) => att.file_type !== "none");
  const allSelected = validAttachments.every((att: any) =>
    selectedAttachments.includes(att.id)
  );

  return (
    <div className="space-y-6">
      {/* Clear section header */}
      <div className="pb-3 border-b">
        <h2 className="text-lg font-semibold">Συνημμένα και Επιπλέον Στοιχεία</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Επιλέξτε συνημμένα και συμπληρώστε πεδία εσωτερικής διανομής
        </p>
      </div>

      {/* Attachments Section */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-medium">
            Απαιτούμενα Συνημμένα{" "}
            {validAttachments.length > 0 && (
              <span className="text-muted-foreground text-sm">
                ({selectedAttachments.length}/{validAttachments.length})
              </span>
            )}
          </h3>
          {validAttachments.length > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSelectAll}
            >
              {allSelected ? "Αποεπιλογή Όλων" : "Επιλογή Όλων"}
            </Button>
          )}
        </div>

        {attachmentsLoading ? (
          <div className="flex items-center justify-center p-8">
            <FileText className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : validAttachments.length > 0 ? (
          <div className="space-y-2">
            {attachments.map((attachment: any) =>
              attachment.file_type === "none" ? (
                <div
                  key={attachment.id}
                  className="flex flex-col items-center justify-center py-8 text-muted-foreground"
                >
                  <FileX className="h-12 w-12 mb-4" />
                  <p className="font-medium">{attachment.title}</p>
                  <p className="text-sm">{attachment.description}</p>
                </div>
              ) : (
                <div
                  key={attachment.id}
                  className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                >
                  <Checkbox
                    checked={selectedAttachments.includes(attachment.id)}
                    onCheckedChange={(checked) =>
                      onAttachmentToggle?.(attachment.id, Boolean(checked))
                    }
                  />
                  <div className="flex-1">
                    <span className="text-sm">{attachment.title}</span>
                    {attachment.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {attachment.description}
                      </p>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground bg-muted/20 rounded-lg border">
            <FileText className="h-12 w-12 mb-4" />
            <p>Δεν βρέθηκαν συνημμένα για αυτόν τον τύπο δαπάνης</p>
          </div>
        )}
      </div>

      {/* ESDIAN Fields for Internal Distribution */}
      <div className="pt-4 border-t">
        <h3 className="text-base font-medium mb-3">Εσωτερική Διανομή (ESDIAN)</h3>
        <EsdianFieldsWithSuggestions form={form} user={user} />
      </div>

      {/* Helper text */}
      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
        <p>
          <strong>Σημείωση:</strong> Τα συνημμένα και τα πεδία ESDIAN είναι
          προαιρετικά αλλά συνιστάται να συμπληρωθούν για πληρότητα του
          εγγράφου.
        </p>
      </div>
    </div>
  );
}
