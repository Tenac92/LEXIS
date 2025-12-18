import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Trash2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

interface ViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: any;
}

export function ViewDocumentModal({ isOpen, onClose, document }: ViewModalProps) {
  const { toast } = useToast();
  const [protocolNumber, setProtocolNumber] = useState('');
  const [protocolDate, setProtocolDate] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch recipients with decrypted AFM values from the API
  const { data: decryptedRecipients = [] } = useQuery<any[]>({
    queryKey: [`/api/documents/${document?.id}/beneficiaries`],
    enabled: !!document?.id && isOpen,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (document) {
      setProtocolNumber(document.protocol_number_input || '');
      setProtocolDate(document.protocol_date ?
        new Date(document.protocol_date).toISOString().split('T')[0] :
        new Date().toISOString().split('T')[0]
      );
    }
  }, [document]);

  if (!document) return null;

  const handleProtocolSave = async () => {
    try {
      setLoading(true);

      if (!protocolNumber.trim()) {
        throw new Error('Ξ‘Ο€Ξ±ΞΉΟ„ΞµΞ―Ο„Ξ±ΞΉ Ξ±ΟΞΉΞΈΞΌΟΟ‚ Ο€ΟΟ‰Ο„ΞΏΞΊΟΞ»Ξ»ΞΏΟ…');
      }

      if (!protocolDate) {
        throw new Error('Ξ‘Ο€Ξ±ΞΉΟ„ΞµΞ―Ο„Ξ±ΞΉ Ξ·ΞΌΞµΟΞΏΞΌΞ·Ξ½Ξ―Ξ± Ο€ΟΟ‰Ο„ΞΏΞΊΟΞ»Ξ»ΞΏΟ…');
      }

      const formattedDate = new Date(protocolDate).toISOString().split('T')[0];

      // Saving protocol information with validated number and formatted date

      const response = await apiRequest<{ success: boolean; message: string; data?: any }>(`/api/documents/generated/${document.id}/protocol`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          protocol_number: protocolNumber.trim(),
          protocol_date: formattedDate
        })
      });

      if (!response || response.success === false) {
        throw new Error(response?.message || 'Ξ‘Ο€ΞΏΟ„Ο…Ο‡Ξ―Ξ± ΞµΞ½Ξ·ΞΌΞ­ΟΟ‰ΟƒΞ·Ο‚ Ο€ΟΟ‰Ο„ΞΏΞΊΟΞ»Ξ»ΞΏΟ…');
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/documents/generated'] });

      toast({
        title: "Ξ•Ο€ΞΉΟ„Ο…Ο‡Ξ―Ξ±",
        description: response.message || "Ξ¤ΞΏ Ο€ΟΟ‰Ο„ΟΞΊΞΏΞ»Ξ»ΞΏ ΞµΞ½Ξ·ΞΌΞµΟΟΞΈΞ·ΞΊΞµ ΞµΟ€ΞΉΟ„Ο…Ο‡ΟΟ‚",
      });
      onClose();

    } catch (error) {
      // Protocol saving error occurred, now display toast notification to user
      const friendlyByCode: Record<string, string> = {
        PROTOCOL_NUMBER_EXISTS_YEAR:
          "Protocol number is already used for this year. Please choose a different number.",
      };
      const code = (error as any)?.code;
      const friendlyMessage = code ? friendlyByCode[code] : undefined;

      toast({
        title: "Error",
        description:
          friendlyMessage ||
          (error instanceof Error
            ? error.message
            : "Failed to save protocol number"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [document, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Ξ›ΞµΟ€Ο„ΞΏΞΌΞ­ΟΞµΞΉΞµΟ‚ Ξ•Ξ³Ξ³ΟΞ¬Ο†ΞΏΟ…</DialogTitle>
          <DialogDescription>
            Ξ ΟΞΏΞ²ΞΏΞ»Ξ® ΞΊΞ±ΞΉ ΞµΟ€ΞµΞΎΞµΟΞ³Ξ±ΟƒΞ―Ξ± Ο„Ο‰Ξ½ ΟƒΟ„ΞΏΞΉΟ‡ΞµΞ―Ο‰Ξ½ Ο„ΞΏΟ… ΞµΞ³Ξ³ΟΞ¬Ο†ΞΏΟ…
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            {/* Protocol Section */}
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-medium text-lg mb-4">Ξ£Ο„ΞΏΞΉΟ‡ΞµΞ―Ξ± Ξ ΟΟ‰Ο„ΞΏΞΊΟΞ»Ξ»ΞΏΟ…</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ξ‘ΟΞΉΞΈΞΌΟΟ‚ Ξ ΟΟ‰Ο„ΞΏΞΊΟΞ»Ξ»ΞΏΟ…</Label>
                  <Input
                    value={protocolNumber}
                    onChange={(e) => setProtocolNumber(e.target.value)}
                    placeholder="Ξ•ΞΉΟƒΞ¬Ξ³ΞµΟ„Ξµ Ξ±ΟΞΉΞΈΞΌΟ Ο€ΟΟ‰Ο„ΞΏΞΊΟΞ»Ξ»ΞΏΟ…"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ξ—ΞΌΞµΟΞΏΞΌΞ·Ξ½Ξ―Ξ± Ξ ΟΟ‰Ο„ΞΏΞΊΟΞ»Ξ»ΞΏΟ…</Label>
                  <Input
                    type="date"
                    value={protocolDate}
                    onChange={(e) => setProtocolDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button
                className="mt-4 w-full"
                onClick={handleProtocolSave}
                disabled={loading}
              >
                {loading ? "Ξ‘Ο€ΞΏΞΈΞ®ΞΊΞµΟ…ΟƒΞ·..." : "Ξ‘Ο€ΞΏΞΈΞ®ΞΊΞµΟ…ΟƒΞ· Ξ ΟΟ‰Ο„ΞΏΞΊΟΞ»Ξ»ΞΏΟ…"}
              </Button>
            </div>

            {/* Document Information */}
            <div>
              <h3 className="font-medium text-lg">Ξ Ξ»Ξ·ΟΞΏΟ†ΞΏΟΞ―ΞµΟ‚ Ξ•Ξ³Ξ³ΟΞ¬Ο†ΞΏΟ…</h3>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <p className="text-sm text-muted-foreground">ΞΞ±Ο„Ξ¬ΟƒΟ„Ξ±ΟƒΞ·</p>
                  <p className="font-medium capitalize">{document.status === 'approved' ? 'Ξ•Ξ³ΞΊΞµΞΊΟΞΉΞΌΞ­Ξ½ΞΏ' : 'Ξ£Ξµ ΞµΞΊΞΊΟΞµΞΌΟΟ„Ξ·Ο„Ξ±'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ξ—ΞΌΞµΟΞΏΞΌΞ·Ξ½Ξ―Ξ± Ξ”Ξ·ΞΌΞΉΞΏΟ…ΟΞ³Ξ―Ξ±Ο‚</p>
                  <p className="font-medium">
                    {new Date(document.created_at).toLocaleDateString('el-GR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ξ£Ο…Ξ½ΞΏΞ»ΞΉΞΊΟ Ξ ΞΏΟƒΟ</p>
                  <p className="font-medium">
                    {new Intl.NumberFormat('el-GR', {
                      style: 'currency',
                      currency: 'EUR'
                    }).format(document.total_amount || 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Recipients Section */}
            {decryptedRecipients && decryptedRecipients.length > 0 && (
              <div>
                <h3 className="font-medium text-lg mb-2">Ξ”ΞΉΞΊΞ±ΞΉΞΏΟΟ‡ΞΏΞΉ</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {decryptedRecipients.map((item: any, index: number) => {
                    // Extract beneficiary data from API response
                    const beneficiary = item.beneficiaries ? (Array.isArray(item.beneficiaries) ? item.beneficiaries[0] : item.beneficiaries) : item;
                    const firstname = beneficiary?.name || beneficiary?.firstname || '';
                    const lastname = beneficiary?.surname || beneficiary?.lastname || '';
                    const afm = beneficiary?.afm || item.afm || '';
                    const amount = item.amount || 0;
                    
                    return (
                      <div
                        key={index}
                        className="p-3 bg-muted rounded-lg"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">
                              {lastname} {firstname}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Ξ‘Ξ¦Ξ: {afm}
                            </p>
                          </div>
                          <p className="font-medium">
                            {new Intl.NumberFormat('el-GR', {
                              style: 'currency',
                              currency: 'EUR'
                            }).format(amount)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ΞΞ»ΞµΞ―ΟƒΞΉΞΌΞΏ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface GeneratedDocument {
  id: string;
  protocol_number_input?: string;
  protocol_date?: string;
  project_id?: string;
  expenditure_type?: string;
  recipients?: Array<{
    firstname: string;
    lastname: string;
    fathername?: string;
    afm: string;
    amount: number | string;
    installment?: number | string;
    // New format fields
    installments?: string[];
    installmentAmounts?: Record<string, number>;
  }>;
  created_at: string;
  status: string;
  total_amount: number;
}


interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  document?: GeneratedDocument;
  onEdit: (id: string) => void;
}

// Define a proper Recipient interface with both formats
interface Recipient {
  firstname: string;
  lastname: string;
  fathername?: string;
  afm: string;
  amount: number;
  installment: number;
  // New format fields - can't be undefined with spread operators
  installments?: string[];
  installmentAmounts?: Record<string, number>;
}

export function EditDocumentModal({ isOpen, onClose, document, onEdit }: EditModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [protocolNumber, setProtocolNumber] = useState('');
  const [protocolDate, setProtocolDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [expenditureType, setExpenditureType] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  
  // Use this ref to avoid repeated updates of the same document
  const processedDocumentId = useRef<string | null>(null);

  // Function to load enhanced project data from MIS using optimized schema
  const loadProjectIdFromMis = async (mis: string) => {
    if (!mis) return null;

    setLoading(true); // Show loading indicator while fetching
    try {
      console.log(`[EditDocument] Fetching enhanced project data for MIS: ${mis}`);
      const response = await fetch(`/api/projects/${mis}`);

      if (response.ok) {
        const projectData = await response.json();
        if (projectData && projectData.na853) {
          console.log(`[EditDocument] Found enhanced project data:`, {
            na853: projectData.na853,
            event_type: projectData.enhanced_event_type?.name,
            expenditure_type: projectData.enhanced_expenditure_type?.name,
            unit: projectData.enhanced_unit?.name,
            region: projectData.enhanced_region?.region,
          });

          setProjectId(projectData.na853);

          // Auto-fill expenditure type if available from enhanced data
          if (projectData.enhanced_expenditure_type?.name) {
            setExpenditureType(projectData.enhanced_expenditure_type.name);
          }

          toast({
            title: "Success",
            description: `Found project: ${projectData.na853} - ${projectData.event_description || projectData.project_title}`,
          });
          return projectData.na853;
        }

        console.log(`[EditDocument] No project data found for MIS: ${mis}`);
        toast({
          title: "Warning",
          description: `No project found for MIS: ${mis}`,
          variant: "destructive",
        });
        return null;
      }

      console.error(`[EditDocument] Failed to fetch project for MIS: ${mis}`);
      toast({
        title: "Error",
        description: `Failed to fetch project for MIS: ${mis}`,
        variant: "destructive",
      });
      return null;
    } catch (error) {
      console.error("[EditDocument] Error fetching project for MIS:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to fetch project data from MIS",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false); // Hide loading indicator
    }
  };

  // Use effect with a proper cleanup to prevent memory leaks and infinite loops
  useEffect(() => {
    // Skip processing if document is undefined or dialog is not open
    if (!document || !isOpen) return;
    
    // To prevent infinite update loops, we'll check if this document has already been processed
    // Only process it if it's a new document or dialog just opened
    if (processedDocumentId.current === document.id) {
      console.log(`[EditDocument] Document ${document.id} already processed, skipping state updates`);
      return;
    }
    
    console.log(`[EditDocument] Processing document ${document.id} for the first time`);
    processedDocumentId.current = document.id;
    
    // Process the document data - simple string fields first
    setProtocolNumber(document.protocol_number_input || '');
    setProtocolDate(document.protocol_date ?
      new Date(document.protocol_date).toISOString().split('T')[0] :
      ''
    );
    
    // Initialize with document.project_id and then check if we need to load from MIS
    const currentProjectId = document.project_id || '';
    setProjectId(currentProjectId);
    
    // If project_id contains a MIS number (digits only), try to load the NA853 code
    if (currentProjectId && /^\d+$/.test(currentProjectId)) {
      console.log(`[EditDocument] Project ID appears to be a MIS number: ${currentProjectId}`);
      loadProjectIdFromMis(currentProjectId);
    }
    
    setExpenditureType(document.expenditure_type || '');

    // Safely parse recipients array with proper error handling
    try {
      // Skip if recipients is not an array
      if (!document.recipients || !Array.isArray(document.recipients)) {
        console.log('[EditDocument] No recipients found or not an array');
        setRecipients([]);
        return;
      }
      
      // Debug information
      console.log(`[EditDocument] Processing ${document.recipients.length} recipients`, 
        document.recipients.map(r => ({
          afm: r.afm,
          hasNewFormat: !!(r.installments && r.installmentAmounts)
        }))
      );

      // Map recipients to our internal format
      const safeRecipients = document.recipients.map(r => {
        // Detect if using the new format with installments array
        const hasInstallments = r.installments && Array.isArray(r.installments) && r.installments.length > 0;
        const hasInstallmentAmounts = r.installmentAmounts && 
                                   typeof r.installmentAmounts === 'object' && 
                                   Object.keys(r.installmentAmounts).length > 0;
        const isNewFormat = hasInstallments && hasInstallmentAmounts;
        
        // Create a properly typed recipient with basic fields
        const recipient: Recipient = {
          firstname: String(r.firstname || ''),
          lastname: String(r.lastname || ''),
          afm: String(r.afm || ''),
          amount: typeof r.amount === 'string' ? parseFloat(r.amount) || 0 : Number(r.amount) || 0,
          installment: typeof r.installment === 'string' ? parseInt(r.installment) || 1 : Number(r.installment) || 1
        };
        
        // Add fathername if it exists in the original data
        if ('fathername' in r && r.fathername) {
          recipient.fathername = String(r.fathername);
        }
        
        // Only handle new format if both fields are present
        if (isNewFormat) {
          console.log(`[EditDocument] Recipient ${r.afm} uses new installment format:`, {
            installments: r.installments,
            installmentAmounts: r.installmentAmounts
          });
          
          // Copy installments array if it exists and is an array
          if (hasInstallments && Array.isArray(r.installments)) {
            recipient.installments = [...r.installments];
          }
          
          // Copy installmentAmounts object if it exists
          if (hasInstallmentAmounts) {
            recipient.installmentAmounts = { ...r.installmentAmounts };
          }
          
          // Set consistent installment number based on installments array
          if (hasInstallments && Array.isArray(r.installments)) {
            if (r.installments.includes('Ξ•Ξ¦Ξ‘Ξ Ξ‘Ξ')) {
              recipient.installment = 1;
            } else if (r.installments.includes('Ξ‘')) {
              recipient.installment = 1;
            } else if (r.installments.includes('Ξ’')) {
              recipient.installment = 2;
            } else if (r.installments.includes('Ξ“')) {
              recipient.installment = 3;
            }
          }
        }
        
        return recipient;
      });

      console.log("[EditDocument] Processed recipients:", safeRecipients);
      setRecipients(safeRecipients);
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description:
          error instanceof Error
            ? error.message
            : "Αποτυχία επεξεργασίας δικαιούχων",
        variant: "destructive",
      });
    }
  }, [document, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary">Ξ•Ο€ΞµΞΎΞµΟΞ³Ξ±ΟƒΞ―Ξ± Ξ•Ξ³Ξ³ΟΞ¬Ο†ΞΏΟ…</DialogTitle>
          <DialogDescription className="text-base">
            Ξ£Ο…ΞΌΟ€Ξ»Ξ·ΟΟΟƒΟ„Ξµ Ο„Ξ± Ο€ΞµΞ΄Ξ―Ξ± Ο€Ξ±ΟΞ±ΞΊΞ¬Ο„Ο‰ Ξ³ΞΉΞ± Ξ½Ξ± Ο„ΟΞΏΟ€ΞΏΟ€ΞΏΞΉΞ®ΟƒΞµΟ„Ξµ Ο„ΞΏ Ξ­Ξ³Ξ³ΟΞ±Ο†ΞΏ. Ξ Ξ±Ο„Ξ®ΟƒΟ„Ξµ Ξ±Ο€ΞΏΞΈΞ®ΞΊΞµΟ…ΟƒΞ· ΟΟ„Ξ±Ξ½ Ο„ΞµΞ»ΞµΞΉΟΟƒΞµΟ„Ξµ.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            {/* Project Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <h3 className="font-medium">Ξ£Ο„ΞΏΞΉΟ‡ΞµΞ―Ξ± Ξ ΟΟ‰Ο„ΞΏΞΊΟΞ»Ξ»ΞΏΟ…</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ξ‘ΟΞΉΞΈΞΌΟΟ‚ Ξ ΟΟ‰Ο„ΞΏΞΊΟΞ»Ξ»ΞΏΟ…</Label>
                    <Input
                      value={protocolNumber}
                      onChange={(e) => setProtocolNumber(e.target.value)}
                      placeholder="Ξ•ΞΉΟƒΞ¬Ξ³ΞµΟ„Ξµ Ξ±ΟΞΉΞΈΞΌΟ Ο€ΟΟ‰Ο„ΞΏΞΊΟΞ»Ξ»ΞΏΟ…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ξ—ΞΌΞµΟΞΏΞΌΞ·Ξ½Ξ―Ξ± Ξ ΟΟ‰Ο„ΞΏΞΊΟΞ»Ξ»ΞΏΟ…</Label>
                    <Input
                      type="date"
                      value={protocolDate}
                      onChange={(e) => setProtocolDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium">Ξ£Ο„ΞΏΞΉΟ‡ΞµΞ―Ξ± ΞΟΞ³ΞΏΟ…</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ID ΞΟΞ³ΞΏΟ… (ΞΞ‘853)</Label>
                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Input
                          value={projectId}
                          onChange={(e) => setProjectId(e.target.value)}
                          placeholder="Ξ•ΞΉΟƒΞ¬Ξ³ΞµΟ„Ξµ ID Ξ­ΟΞ³ΞΏΟ… Ξ® MIS"
                          required
                          className={projectId && /^\d+$/.test(projectId) ? "border-blue-300 focus:border-blue-500 bg-blue-50" : ""}
                        />
                        {projectId && /^\d+$/.test(projectId) && (
                          <p className="text-xs text-blue-600 mt-1 font-medium">
                            <span>Ξ‘Ξ½Ξ±Ξ³Ξ½Ο‰ΟΞ―ΟƒΟ„Ξ·ΞΊΞµ Ο€ΞΉΞΈΞ±Ξ½ΟΟ‚ ΞΊΟ‰Ξ΄ΞΉΞΊΟΟ‚ MIS</span>
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="whitespace-nowrap min-w-[115px] h-10"
                        onClick={() => {
                          const mis = projectId.trim();
                          if (mis && /^\d+$/.test(mis)) {
                            loadProjectIdFromMis(mis);
                          } else {
                            toast({
                              title: "Ξ ΟΞΏΟƒΞΏΟ‡Ξ®",
                              description: "Ξ•ΞΉΟƒΞ¬Ξ³ΞµΟ„Ξµ Ξ­Ξ½Ξ±Ξ½ Ξ­Ξ³ΞΊΟ…ΟΞΏ ΞΊΟ‰Ξ΄ΞΉΞΊΟ MIS (ΞΌΟΞ½ΞΏ Ξ±ΟΞΉΞΈΞΌΞΏΞ―)",
                              variant: "destructive",
                            });
                          }
                        }}
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Ξ‘Ξ½Ξ±Ξ¶Ξ®Ο„Ξ·ΟƒΞ·...
                          </>
                        ) : (
                          <>Ξ•ΟΟΞµΟƒΞ· ΞΞ‘853</>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">ΞΞ±Ο„Ξ±Ο‡Ο‰ΟΞ―ΟƒΟ„Ξµ ΞΊΟ‰Ξ΄ΞΉΞΊΟ MIS ΞΊΞ±ΞΉ Ο€Ξ±Ο„Ξ®ΟƒΟ„Ξµ Ο„ΞΏ ΞΊΞΏΟ…ΞΌΟ€Ξ―</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Ξ¤ΟΟ€ΞΏΟ‚ Ξ”Ξ±Ο€Ξ¬Ξ½Ξ·Ο‚</Label>
                    <Input
                      value={expenditureType}
                      onChange={(e) => setExpenditureType(e.target.value)}
                      placeholder="Ξ•ΞΉΟƒΞ¬Ξ³ΞµΟ„Ξµ Ο„ΟΟ€ΞΏ Ξ΄Ξ±Ο€Ξ¬Ξ½Ξ·Ο‚"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Recipients Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-medium">Ξ”ΞΉΞΊΞ±ΞΉΞΏΟΟ‡ΞΏΞΉ</h3>
                  <p className="text-sm text-muted-foreground">
                    Ξ ΟΞΏΟƒΞΈΞ®ΞΊΞ· Ξ­Ο‰Ο‚ 10 Ξ΄ΞΉΞΊΞ±ΞΉΞΏΟΟ‡Ο‰Ξ½
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={addRecipient}
                  disabled={recipients.length >= 10 || loading}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Ξ ΟΞΏΟƒΞΈΞ®ΞΊΞ· Ξ”ΞΉΞΊΞ±ΞΉΞΏΟΟ‡ΞΏΟ…
                </Button>
              </div>
              <div className="space-y-3 max-h-[calc(70vh-150px)] overflow-y-auto pr-2">
                {recipients.map((recipient, index) => (
                  <Card key={index} className="p-4 relative">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-2 w-full">
                      {/* ΞΞ½ΞΏΞΌΞ± */}
                      <Input
                        value={recipient.firstname}
                        onChange={(e) => handleRecipientChange(index, 'firstname', e.target.value)}
                        placeholder="ΞΞ½ΞΏΞΌΞ±"
                        className="md:col-span-2 md:row-span-1"
                        autoComplete="off"
                        required
                      />

                      {/* Ξ•Ο€ΟΞ½Ο…ΞΌΞΏ */}
                      <Input
                        value={recipient.lastname}
                        onChange={(e) => handleRecipientChange(index, 'lastname', e.target.value)}
                        placeholder="Ξ•Ο€Ξ―ΞΈΞµΟ„ΞΏ"
                        className="md:col-span-2 md:row-span-1"
                        autoComplete="off"
                        required
                      />

                      {/* Ξ Ξ±Ο„ΟΟΞ½Ο…ΞΌΞΏ */}
                      <Input
                        value={recipient.fathername || ''}
                        onChange={(e) => handleRecipientChange(index, 'fathername', e.target.value)}
                        placeholder="Ξ Ξ±Ο„ΟΟΞ½Ο…ΞΌΞΏ"
                        className="md:col-span-2 md:row-span-1"
                        autoComplete="off"
                      />

                      {/* Ξ‘Ξ¦Ξ */}
                      <Input
                        value={recipient.afm}
                        onChange={(e) => handleRecipientChange(index, 'afm', e.target.value)}
                        placeholder="Ξ‘Ξ¦Ξ"
                        maxLength={9}
                        className="md:col-span-2 md:row-span-1"
                        autoComplete="off"
                        required
                      />

                      {/* Ξ ΞΏΟƒΟ */}
                      <NumberInput
                        value={recipient.amount || ''}
                        onChange={(formatted, numeric) => handleRecipientChange(index, 'amount', numeric)}
                        placeholder="Ξ ΞΏΟƒΟ"
                        className="md:col-span-2 md:row-span-1"
                        decimals={2}
                        required
                      />

                      {/* Delete Button - same row as the inputs */}
                      <div className="md:col-span-1 md:col-start-12 md:row-start-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRecipient(index)}
                          className="shrink-0"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      {/* Second row - installment and secondary text */}
                      <Input
                        value={recipient.installment}
                        type="number"
                        onChange={(e) => handleRecipientChange(index, 'installment', e.target.value)}
                        placeholder="Ξ”ΟΟƒΞ·"
                        min="1"
                        max="12"
                        className="md:col-span-2 md:row-start-2"
                        required
                      />

                      {/* Secondary text placeholder - empty for backward compatibility */}
                      <div className="md:col-span-8 md:row-start-2">
                        {/* For installment type info */}
                        <div className="text-xs text-muted-foreground">
                          {recipient.installment === 1 ? 'Ξ•Ξ¦Ξ‘Ξ Ξ‘Ξ / Ξ‘' : 
                           recipient.installment === 2 ? 'Ξ’' : 
                           recipient.installment === 3 ? 'Ξ“' : `Ξ”ΟΟƒΞ· #${recipient.installment}`}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Total Amount */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg shadow-sm">
              <div className="flex justify-between items-center">
                <span className="font-medium text-primary-foreground">Ξ£Ο…Ξ½ΞΏΞ»ΞΉΞΊΟ Ξ ΞΏΟƒΟ:</span>
                <span className="text-lg font-bold text-primary">
                  {new Intl.NumberFormat('el-GR', {
                    style: 'currency',
                    currency: 'EUR'
                  }).format(calculateTotalAmount())}
                </span>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Ξ‘ΞΊΟΟΟ‰ΟƒΞ·
          </Button>
          <Button onClick={handleEdit} disabled={loading}>
            {loading ? "Ξ‘Ο€ΞΏΞΈΞ®ΞΊΞµΟ…ΟƒΞ·..." : "Ξ‘Ο€ΞΏΞΈΞ®ΞΊΞµΟ…ΟƒΞ· Ξ‘Ξ»Ξ»Ξ±Ξ³ΟΞ½"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDocumentModal({ isOpen, onClose, documentId, onDelete }: DeleteModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!documentId) {
      toast({
        title: "Error",
        description: "Missing document identifier. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await apiRequest(`/api/documents/generated/${documentId}`, {
        method: 'DELETE'
      });
      toast({
        title: "Ξ•Ο€ΞΉΟ„Ο…Ο‡Ξ―Ξ±",
        description: "Ξ¤ΞΏ Ξ­Ξ³Ξ³ΟΞ±Ο†ΞΏ Ξ΄ΞΉΞ±Ξ³ΟΞ¬Ο†Ξ·ΞΊΞµ ΞµΟ€ΞΉΟ„Ο…Ο‡ΟΟ‚",
      });
      onDelete();
      onClose();
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description:
          error instanceof Error
            ? error.message
            : "Αποτυχία διαγραφής εγγράφου",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ξ”ΞΉΞ±Ξ³ΟΞ±Ο†Ξ® Ξ•Ξ³Ξ³ΟΞ¬Ο†ΞΏΟ…</DialogTitle>
          <DialogDescription>
            Ξ•Ξ―ΟƒΟ„Ξµ Ξ²Ξ­Ξ²Ξ±ΞΉΞΏΞΉ ΟΟ„ΞΉ ΞΈΞ­Ξ»ΞµΟ„Ξµ Ξ½Ξ± Ξ΄ΞΉΞ±Ξ³ΟΞ¬ΟΞµΟ„Ξµ Ξ±Ο…Ο„Ο Ο„ΞΏ Ξ­Ξ³Ξ³ΟΞ±Ο†ΞΏ; Ξ‘Ο…Ο„Ξ® Ξ· ΞµΞ½Ξ­ΟΞ³ΞµΞΉΞ± Ξ΄ΞµΞ½ ΞΌΟ€ΞΏΟΞµΞ― Ξ½Ξ± Ξ±Ξ½Ξ±ΞΉΟΞµΞΈΞµΞ―.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Ξ‘ΞΊΟΟΟ‰ΟƒΞ·
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? "Ξ”ΞΉΞ±Ξ³ΟΞ±Ο†Ξ®..." : "Ξ”ΞΉΞ±Ξ³ΟΞ±Ο†Ξ®"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExportDocumentModal({ isOpen, onClose, document }: ExportModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  if (!document) return null;

  const handleExport = async () => {
    try {
      setLoading(true);
      console.log('ΞΞ½Ξ±ΟΞΎΞ· Ξ΄ΞΉΞ±Ξ΄ΞΉΞΊΞ±ΟƒΞ―Ξ±Ο‚ ΞµΞΎΞ±Ξ³Ο‰Ξ³Ξ®Ο‚ ΞµΞ³Ξ³ΟΞ¬Ο†Ο‰Ξ½...');

      const testResponse = await fetch(`/api/documents/generated/${document.id}/test`);
      const testResult = await testResponse.json();

      if (!testResult.success) {
        throw new Error(testResult.message || 'Ξ‘Ο€ΞΏΟ„Ο…Ο‡Ξ―Ξ± ΞµΟ€ΞΉΞΊΟΟΟ‰ΟƒΞ·Ο‚ ΞµΞ³Ξ³ΟΞ¬Ο†ΞΏΟ…');
      }

      console.log('Ξ•Ο€ΞΉΞΊΟΟΟ‰ΟƒΞ· ΞµΞ³Ξ³ΟΞ¬Ο†ΞΏΟ… ΞµΟ€ΞΉΟ„Ο…Ο‡Ξ®Ο‚:', testResult);

      // Create and trigger download using fetch and blob approach for better handling
      const downloadUrl = `/api/documents/generated/${document.id}/export?format=both`;
      console.log('Fetching document data from URL:', downloadUrl);
      
      // Use fetch with blob response type for binary data
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`Download failed with status: ${response.status}`);
      }
      
      // Log content-type and other important headers to help debug
      console.log('Response content-type:', response.headers.get('content-type'));
      console.log('Response content-disposition:', response.headers.get('content-disposition'));
      console.log('Response content-length:', response.headers.get('content-length'));
      
      // Get the response as blob (binary data)
      const blob = await response.blob();
      console.log('Downloaded blob size:', blob.size, 'bytes, type:', blob.type);
      
      // Create object URL from blob and trigger download
      const objectUrl = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.setAttribute('download', `documents-${document.id}.zip`);
      window.document.body.appendChild(link);
      link.click();
      
      // Clean up
      window.document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      toast({
        title: "Ξ•Ο€ΞΉΟ„Ο…Ο‡Ξ―Ξ±",
        description: "Ξ— Ξ»Ξ®ΟΞ· Ο„Ο‰Ξ½ ΞµΞ³Ξ³ΟΞ¬Ο†Ο‰Ξ½ ΞΎΞµΞΊΞ―Ξ½Ξ·ΟƒΞµ",
      });

      setTimeout(() => setLoading(false), 1000);
      onClose();

    } catch (error) {
      console.error('Ξ£Ο†Ξ¬Ξ»ΞΌΞ± ΞµΞΎΞ±Ξ³Ο‰Ξ³Ξ®Ο‚:', error);
      toast({
        title: "Ξ£Ο†Ξ¬Ξ»ΞΌΞ±",
        description: error instanceof Error ? error.message : "Ξ‘Ο€ΞΏΟ„Ο…Ο‡Ξ―Ξ± Ξ»Ξ®ΟΞ·Ο‚ ΞµΞ³Ξ³ΟΞ¬Ο†Ο‰Ξ½",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Ξ•ΞΎΞ±Ξ³Ο‰Ξ³Ξ® Ξ•Ξ³Ξ³ΟΞ¬Ο†Ο‰Ξ½</DialogTitle>
          <DialogDescription>
            Ξ Ξ±Ο„Ξ®ΟƒΟ„Ξµ Ο„ΞΏ ΞΊΞΏΟ…ΞΌΟ€Ξ― Ο€Ξ±ΟΞ±ΞΊΞ¬Ο„Ο‰ Ξ³ΞΉΞ± Ξ½Ξ± ΞΊΞ±Ο„ΞµΞ²Ξ¬ΟƒΞµΟ„Ξµ Ο„Ξ± Ξ­Ξ³Ξ³ΟΞ±Ο†Ξ± (ΞΊΟΟΞΉΞΏ Ξ­Ξ³Ξ³ΟΞ±Ο†ΞΏ ΞΊΞ±ΞΉ Ξ Ξ΅ΞΞ£Ξ‘ΞΞ‘Ξ¤ΞΞ›Ξ™Ξ£ΞΞΞ£ ΞΞ΅Ξ™Ξ–ΞΞΞ¤Ξ™ΞΞ£) ΟƒΞµ ΞΌΞΏΟΟ†Ξ® ZIP.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-sm">
          <div className="font-semibold mb-1">Ξ Ξ»Ξ·ΟΞΏΟ†ΞΏΟΞ―ΞµΟ‚:</div>
          <p>Ξ¤ΞΏ Ξ±ΟΟ‡ΞµΞ―ΞΏ ZIP Ο€ΞµΟΞΉΞ­Ο‡ΞµΞΉ Ξ΄ΟΞΏ Ξ­Ξ³Ξ³ΟΞ±Ο†Ξ± DOCX:</p>
          <ul className="list-disc pl-5 mt-1">
            <li>Ξ¤ΞΏ ΞΊΟΟΞΉΞΏ Ξ­Ξ³Ξ³ΟΞ±Ο†ΞΏ ΞΌΞµ ΟΞ»Ξ± Ο„Ξ± ΟƒΟ„ΞΏΞΉΟ‡ΞµΞ―Ξ±</li>
            <li>Ξ¤ΞΏ ΟƒΟ…ΞΌΟ€Ξ»Ξ·ΟΟ‰ΞΌΞ±Ο„ΞΉΞΊΟ Ξ­Ξ³Ξ³ΟΞ±Ο†ΞΏ "Ξ Ξ΅ΞΞ£Ξ‘ΞΞ‘Ξ¤ΞΞ›Ξ™Ξ£ΞΞΞ£ ΞΞ΅Ξ™Ξ–ΞΞΞ¤Ξ™ΞΞ£" ΞΌΞµ Ο„Ξ± ΟƒΟ„ΞΏΞΉΟ‡ΞµΞ―Ξ± Ο€Ξ±ΟΞ±Ξ»Ξ·Ο€Ο„ΟΞ½ ΞΊΞ±ΞΉ Ο„ΟΟ€ΞΏ Ξ ΟΞ¬ΞΎΞ·Ο‚</li>
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Ξ‘ΞΊΟΟΟ‰ΟƒΞ·
          </Button>
          <Button
            onClick={handleExport}
            disabled={loading}
            className="min-w-[100px]"
          >
            {loading ? "Ξ•Ο€ΞµΞΎΞµΟΞ³Ξ±ΟƒΞ―Ξ±..." : "Ξ›Ξ®ΟΞ·"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  onDelete: () => void;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: GeneratedDocument;
}

