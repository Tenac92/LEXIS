import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Save, X, User, Euro, Hash, FileText, Calendar, Plus, Trash2, Users, AlertCircle, MapPin } from "lucide-react";
import type { GeneratedDocument } from "@shared/schema";
import { editDocumentSchema, correctionDocumentSchema } from "@shared/schema";
import { SimpleAFMAutocomplete } from "@/components/ui/simple-afm-autocomplete";

// Use editDocumentSchema as base type - includes all fields with optional correction_reason
// The zodResolver enforces correct validation based on mode (edit vs correction)
type DocumentForm = z.infer<typeof editDocumentSchema>;

interface EditDocumentModalProps {
  document: GeneratedDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'edit' | 'correction';
  onCorrectionSuccess?: (documentId: number) => void; // Callback to open protocol modal after correction
}

const STATUS_OPTIONS = [
  { value: "draft", label: "Προσχέδιο", color: "bg-gray-100 text-gray-800" },
  { value: "pending", label: "Εκκρεμεί", color: "bg-yellow-100 text-yellow-800" },
  { value: "approved", label: "Εγκεκριμένο", color: "bg-green-100 text-green-800" },
  { value: "rejected", label: "Απορρίφθηκε", color: "bg-red-100 text-red-800" },
  { value: "completed", label: "Ολοκληρώθηκε", color: "bg-blue-100 text-blue-800" },
];

export function EditDocumentModal({ 
  document, 
  open, 
  onOpenChange,
  mode = 'edit',
  onCorrectionSuccess
}: EditDocumentModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const isCorrection = mode === 'correction';

  // Memoize user unit IDs for filtering units dropdown
  const userUnitIds = useMemo(
    () => (user?.unit_id ?? []).map(String),
    [user?.unit_id],
  );

  // Initialize form with document data using the appropriate schema
  const form = useForm<DocumentForm>({
    resolver: zodResolver(isCorrection ? correctionDocumentSchema : editDocumentSchema),
    defaultValues: {
      protocol_number_input: "",
      protocol_date: "",
      status: "pending",
      comments: "",
      total_amount: 0,
      esdian_field1: "",
      esdian_field2: "",
      is_correction: false,
      original_protocol_number: "",
      original_protocol_date: "",
      correction_reason: "",
      recipients: [],
      region: undefined,
    },
  });

  // Fetch beneficiary payments for this document
  const { data: beneficiaryPayments, refetch: refetchPayments, isLoading: beneficiariesLoading } = useQuery({
    queryKey: ['/api/documents', document?.id, 'beneficiaries'],
    queryFn: async () => {
      if (!document?.id) return [];
      const response = await apiRequest(`/api/documents/${document.id}/beneficiaries`);
      return response || [];
    },
    enabled: !!document?.id && open,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch units for dropdown (filtered to user's assigned units)
  const { data: rawUnits = [], isLoading: unitsLoading } = useQuery<any[]>({
    queryKey: ['/api/public/units'],
    staleTime: 60 * 60 * 1000, // 1 hour cache
    enabled: open,
  });

  // Filter units to only show user's assigned units (matching create dialog behavior)
  const units = useMemo(() => {
    if (!rawUnits || rawUnits.length === 0) return [];
    
    // Filter units based on user's assigned unit_id array
    const userAllowedUnits = userUnitIds;
    
    const filteredUnits = rawUnits.filter((item: any) => {
      // Check if the unit ID matches any of the user's allowed units
      // user.unit_id contains numeric unit IDs that match the 'unit' field in the API response
      const unitId = String(item.unit);
      return userAllowedUnits.includes(unitId);
    });
    
    return filteredUnits;
  }, [rawUnits, userUnitIds]);

  // Watch selected unit_id from form (numeric)
  const selectedUnitId = form.watch("unit_id");
  
  // For initial load, use document's unit_id; after form is populated, use form value
  const unitIdForProjectsQuery = selectedUnitId || document?.unit_id;

  // Fetch projects based on document or form unit_id
  const { data: projects = [], isLoading: projectsLoading } = useQuery<any[]>({
    queryKey: ['projects-working', unitIdForProjectsQuery],
    queryFn: async () => {
      if (!unitIdForProjectsQuery) return [];
      const response = await apiRequest(`/api/projects-working/${unitIdForProjectsQuery}`);
      return Array.isArray(response) ? response : [];
    },
    enabled: !!unitIdForProjectsQuery && open,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch expenditure types to find matching project_index entries
  const { data: expenditureTypes = [] } = useQuery<any[]>({
    queryKey: ['/api/public/expenditure-types'],
    staleTime: 60 * 60 * 1000,
    enabled: open,
  });

  // Fetch project_index record to resolve actual project_id from project_index_id
  const { data: projectIndexData, isLoading: projectIndexLoading } = useQuery<any>({
    queryKey: ['project-index', document?.project_index_id],
    queryFn: async () => {
      if (!document?.project_index_id) return null;
      console.log('[EditDocument] Fetching project_index record:', document.project_index_id);
      const response = await apiRequest(`/api/project-index/${document.project_index_id}`);
      console.log('[EditDocument] Project_index data:', response);
      return response;
    },
    enabled: !!document?.project_index_id && open,
    staleTime: 5 * 60 * 1000,
  });

  // Extract actual project_id and expenditure_type_id from project_index data
  const actualProjectId = useMemo(() => {
    if (!projectIndexData) return null;
    return projectIndexData.project_id;
  }, [projectIndexData]);

  // Track the expenditure_type_id from the document's project_index
  const documentExpenditureTypeId = useMemo(() => {
    if (!projectIndexData) return null;
    return projectIndexData.expenditure_type_id;
  }, [projectIndexData]);

  // Track selected project and expenditure type from document
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedExpenditureTypeId, setSelectedExpenditureTypeId] = useState<number | null>(null);

  // Track if form has been initialized to prevent re-resetting on user changes
  const formInitializedRef = useRef(false);
  
  // Track if user has manually interacted with geographic dropdowns
  const geoUserInteractedRef = useRef(false);
  
  // Track if we're making programmatic updates (to prevent cascade overwrites)
  const isProgrammaticUpdateRef = useRef(false);

  // Smart cascading geographic selection state
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>("");
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>("");
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState<string>("");

  // Geographic data query using the new normalized structure
  const { data: geographicData, isLoading: geographicDataLoading } = useQuery({
    queryKey: ["geographic-data"],
    queryFn: async () => {
      const response = await apiRequest("/api/geographic-data");
      console.log("[EditDocument] Geographic data loaded:", response);
      return response;
    },
    enabled: open,
  });

  // Project-specific geographic areas
  const { data: projectGeographicAreas = [], isLoading: regionsLoading } = useQuery({
    queryKey: ["project-geographic-areas", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) {
        return [];
      }

      try {
        // Find the project to get its MIS
        const project = projects.find((p) => p.id === selectedProjectId);
        if (!project) {
          console.error("Project not found:", selectedProjectId);
          return [];
        }

        console.log("Fetching geographic areas for project:", {
          id: selectedProjectId,
          mis: project.mis,
        });

        // Fetch project complete data which includes geographic relationships
        const response = await apiRequest(
          `/api/projects/${encodeURIComponent(project.mis || "")}/complete`,
        );

        if (!response || !geographicData) {
          return [];
        }

        // Extract project-specific geographic areas
        const projectRegions = (response as any)?.projectGeographicData?.regions || [];
        const projectUnits = (response as any)?.projectGeographicData?.regionalUnits || [];
        const projectMunicipalities = (response as any)?.projectGeographicData?.municipalities || [];

        console.log("[EditDocument] Project-specific geographic data:", {
          regions: projectRegions.length,
          units: projectUnits.length,
          municipalities: projectMunicipalities.length,
        });

        // Remove duplicates by using a Set based on code
        const uniqueRegions = Array.from(
          new Map(
            projectRegions.map((item: any) => [
              item.region_code || item.regions?.code,
              item,
            ]),
          ).values(),
        );

        const uniqueUnits = Array.from(
          new Map(
            projectUnits.map((item: any) => [
              item.unit_code || item.regional_units?.code,
              item,
            ]),
          ).values(),
        );

        const uniqueMunicipalities = Array.from(
          new Map(
            projectMunicipalities.map((item: any) => [
              item.muni_code || item.municipalities?.code,
              item,
            ]),
          ).values(),
        );

        const smartGeographicData = {
          availableRegions: uniqueRegions.map((item: any) => ({
            id: `region-${item.region_code || item.regions?.code}`,
            code: item.region_code || item.regions?.code,
            name: item.regions?.name || item.name,
            type: "region",
          })),
          availableUnits: uniqueUnits.map((item: any) => ({
            id: `unit-${item.unit_code || item.regional_units?.code}`,
            code: item.unit_code || item.regional_units?.code,
            name: item.regional_units?.name || item.name,
            type: "regional_unit",
            region_code: item.regional_units?.region_code,
          })),
          availableMunicipalities: uniqueMunicipalities.map((item: any) => ({
            id: `municipality-${item.muni_code || item.municipalities?.code}`,
            code: item.muni_code || item.municipalities?.code,
            name: item.municipalities?.name || item.name,
            type: "municipality",
            unit_code: item.municipalities?.unit_code,
          })),
        };

        console.log("[EditDocument] Smart geographic data:", smartGeographicData);
        return smartGeographicData;
      } catch (error) {
        console.error("Error fetching project geographic areas:", error);
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία φόρτωσης περιοχών",
          variant: "destructive",
        });
        return [];
      }
    },
    enabled: Boolean(selectedProjectId) && projects.length > 0 && !!geographicData && open,
  });

  // Computed available options based on current selections
  const availableRegions = (projectGeographicAreas as any)?.availableRegions || [];
  const availableUnits = selectedRegionFilter
    ? ((projectGeographicAreas as any)?.availableUnits || []).filter(
        (unit: any) => unit.region_code === selectedRegionFilter,
      )
    : (projectGeographicAreas as any)?.availableUnits || [];
  const availableMunicipalities = selectedUnitFilter
    ? ((projectGeographicAreas as any)?.availableMunicipalities || []).filter(
        (municipality: any) => municipality.unit_code === selectedUnitFilter,
      )
    : selectedRegionFilter
      ? ((projectGeographicAreas as any)?.availableMunicipalities || []).filter(
          (municipality: any) => {
            const unit = ((projectGeographicAreas as any)?.availableUnits || []).find(
              (u: any) => u.code === municipality.unit_code
            );
            return unit?.region_code === selectedRegionFilter;
          },
        )
      : (projectGeographicAreas as any)?.availableMunicipalities || [];

  // Convert beneficiary payments to recipients format for the form
  const recipients = useMemo(() => {
    if (!beneficiaryPayments || !Array.isArray(beneficiaryPayments) || beneficiaryPayments.length === 0) return [];
    
    return beneficiaryPayments.map((payment: any) => ({
      id: payment.id,
      beneficiary_id: payment.beneficiary_id,
      firstname: payment.beneficiaries?.name || '',
      lastname: payment.beneficiaries?.surname || '',
      fathername: payment.beneficiaries?.fathername || '',
      afm: payment.beneficiaries?.afm || '',
      amount: parseFloat(payment.amount) || 0,
      installment: payment.installment || 'ΕΦΑΠΑΞ',
      installments: [payment.installment || 'ΕΦΑΠΑΞ'],
      installmentAmounts: { [payment.installment || 'ΕΦΑΠΑΞ']: parseFloat(payment.amount) || 0 },
      status: payment.status || 'pending',
      secondary_text: payment.freetext || '',
    }));
  }, [beneficiaryPayments]);

  // Watch recipients and auto-calculate total
  const watchedRecipients = form.watch("recipients") || [];
  
  // Calculate total amount from recipients
  const calculatedTotal = useMemo(() => {
    return watchedRecipients.reduce((sum: number, recipient: any) => {
      return sum + (parseFloat(recipient.amount) || 0);
    }, 0);
  }, [watchedRecipients]);

  // Auto-update total_amount when recipients change
  useEffect(() => {
    if (calculatedTotal !== form.getValues("total_amount")) {
      form.setValue("total_amount", calculatedTotal);
    }
  }, [calculatedTotal, form]);

  // Reset initialization flag when modal closes or document changes
  useEffect(() => {
    // Reset when modal closes OR when document ID changes
    formInitializedRef.current = false;
    geoUserInteractedRef.current = false; // Also reset geographic interaction flag
    console.log('[EditDocument] Resetting initialization flag:', { 
      open, 
      documentId: document?.id 
    });
  }, [open, document?.id]);

  // Reset form when document changes - WITH LOADING GATES (ONLY ONCE)
  useEffect(() => {
    if (!document || !open) return;
    
    // Don't reset if already initialized (prevents overwriting user changes)
    if (formInitializedRef.current) {
      console.log('[EditDocument] Form already initialized, skipping reset');
      return;
    }
    
    // CRITICAL: Wait for all required data to load before populating form
    // This ensures dropdowns have their options available when values are set
    
    // Check if queries are still loading
    if (unitsLoading || beneficiariesLoading) {
      console.log('[EditDocument] Still loading basic data:', {
        unitsLoading,
        beneficiariesLoading
      });
      return;
    }
    
    // If document has unit_id, also wait for projects to load
    if (document.unit_id && projectsLoading) {
      console.log('[EditDocument] Still loading projects for unit:', document.unit_id);
      return;
    }
    
    // If document has project_index_id, wait for project_index data to load
    if (document.project_index_id && projectIndexLoading) {
      console.log('[EditDocument] Still loading project_index data:', document.project_index_id);
      return;
    }

    console.log('[EditDocument] All data loaded, resetting form ONCE');

    const protocolDate = document.protocol_date 
      ? new Date(document.protocol_date).toISOString().split('T')[0] 
      : "";

    const originalProtocolDate = document.original_protocol_date
      ? new Date(document.original_protocol_date).toISOString().split('T')[0]
      : "";

    // Extract ESDIAN fields
    let esdianField1 = "";
    let esdianField2 = "";
    
    if (document.esdian && Array.isArray(document.esdian)) {
      esdianField1 = document.esdian[0] || "";
      esdianField2 = document.esdian[1] || "";
    }

    // Calculate initial recipients from beneficiary payments
    const initialRecipients = (Array.isArray(beneficiaryPayments) ? beneficiaryPayments : []).map((payment: any) => ({
      id: payment.id,
      beneficiary_id: payment.beneficiary_id,
      firstname: payment.beneficiaries?.name || '',
      lastname: payment.beneficiaries?.surname || '',
      fathername: payment.beneficiaries?.fathername || '',
      afm: payment.beneficiaries?.afm || '',
      amount: parseFloat(payment.amount) || 0,
      installment: payment.installment || 'ΕΦΑΠΑΞ',
      installments: [payment.installment || 'ΕΦΑΠΑΞ'],
      installmentAmounts: { [payment.installment || 'ΕΦΑΠΑΞ']: parseFloat(payment.amount) || 0 },
      status: payment.status || 'pending',
      secondary_text: payment.freetext || '',
    }));

    // Calculate initial total from recipients or document
    const initialTotal = initialRecipients.length > 0
      ? initialRecipients.reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0)
      : parseFloat(document.total_amount?.toString() || "0") || 0;

    // For correction mode, prepare to archive current protocol info
    const formData: Partial<DocumentForm> = {
      protocol_number_input: isCorrection ? "" : (document.protocol_number_input || ""),
      protocol_date: isCorrection ? "" : protocolDate,
      status: (document.status as any) || "draft",
      comments: document.comments || "",
      total_amount: initialTotal,
      esdian_field1: esdianField1,
      esdian_field2: esdianField2,
      is_correction: isCorrection ? true : Boolean(document.is_correction),
      original_protocol_number: isCorrection ? document.protocol_number_input || "" : (document.original_protocol_number || ""),
      original_protocol_date: isCorrection ? protocolDate : originalProtocolDate,
      correction_reason: "",
      recipients: initialRecipients,
      project_index_id: document.project_index_id || undefined,  // KEEP original project_index.id for backend
      unit_id: document.unit_id ? Number(document.unit_id) : undefined,
      region: (document as any).region || undefined,
    };

    console.log('[EditDocument] Form data:', formData);
    console.log('[EditDocument] Document project_index_id:', document.project_index_id, 'resolved project_id:', actualProjectId);
    console.log('[EditDocument] NOTE: Form stores project_index.id:', document.project_index_id, 'but dropdown will display using project.id:', actualProjectId);
    form.reset(formData);

    // Set selectedProjectId and selectedExpenditureTypeId for dropdowns and queries
    if (actualProjectId) {
      setSelectedProjectId(actualProjectId);
      console.log('[EditDocument] Set selectedProjectId to resolved project.id:', actualProjectId, 'for geographic queries and dropdown display');
    }
    
    if (documentExpenditureTypeId) {
      setSelectedExpenditureTypeId(documentExpenditureTypeId);
      console.log('[EditDocument] Set selectedExpenditureTypeId:', documentExpenditureTypeId);
    }

    // Mark as initialized to prevent re-resetting on user changes
    formInitializedRef.current = true;
  }, [document, open, form, isCorrection, unitsLoading, beneficiariesLoading, projectsLoading, projectIndexLoading, actualProjectId, beneficiaryPayments]);

  // Initialize geographic selection dropdowns from document's region JSONB
  useEffect(() => {
    // Skip if user has manually interacted with geographic dropdowns
    if (geoUserInteractedRef.current) {
      return;
    }
    
    const regionData = (document as any)?.region;
    if (!document || !open || !projectGeographicAreas || !regionData) return;

    // If region is a JSONB object with codes, use those directly
    if (typeof regionData === 'object' && regionData !== null) {
      if (regionData.region_code) {
        setSelectedRegionFilter(String(regionData.region_code));
      }
      if (regionData.unit_code) {
        setSelectedUnitFilter(String(regionData.unit_code));
      }
      if (regionData.municipality_code) {
        setSelectedMunicipalityId(String(regionData.municipality_code));
      }
    }
  }, [document, open, projectGeographicAreas]);

  // Update or create correction mutation
  const updateMutation = useMutation({
    mutationFn: async (data: DocumentForm) => {
      if (!document?.id) throw new Error("No document ID");

      // Build region object from geographic selections or preserve existing
      const regionData = (() => {
        const areas = projectGeographicAreas as any;
        if (!areas) return data.region || null;

        const region = areas.availableRegions?.find((r: any) => r.code === Number(selectedRegionFilter));
        const unit = areas.availableUnits?.find((u: any) => u.code === Number(selectedUnitFilter));
        const municipality = areas.availableMunicipalities?.find((m: any) => m.code === Number(selectedMunicipalityId));

        // If no selections made, preserve existing region data
        if (!region && !unit && !municipality) {
          return data.region || null;
        }

        // Build new region object from selections
        return {
          region_code: region?.code,
          region_name: region?.name,
          unit_code: unit?.code,
          unit_name: unit?.name,
          municipality_code: municipality?.code,
          municipality_name: municipality?.name,
        };
      })();

      if (isCorrection) {
        // Correction mode: Create new corrected document
        const correctionPayload = {
          document_id: document.id,
          correction_reason: data.correction_reason || "",
          protocol_number_input: data.protocol_number_input || null,
          protocol_date: data.protocol_date || null,
          status: data.status,
          comments: data.comments || null,
          total_amount: data.total_amount,
          esdian: [data.esdian_field1, data.esdian_field2].filter(Boolean),
          recipients: data.recipients,
          project_index_id: data.project_index_id,
          unit_id: data.unit_id,
          region: regionData,
        };

        return await apiRequest(`/api/documents/${document.id}/correction`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(correctionPayload),
        });
      } else {
        // Regular edit mode: Update existing document
        const documentPayload = {
          protocol_number_input: data.protocol_number_input || null,
          protocol_date: data.protocol_date || null,
          status: data.status,
          comments: data.comments || null,
          total_amount: data.total_amount,
          esdian: [data.esdian_field1, data.esdian_field2].filter(Boolean),
          is_correction: data.is_correction,
          original_protocol_number: data.original_protocol_number || null,
          original_protocol_date: data.original_protocol_date || null,
          updated_at: new Date().toISOString(),
          project_index_id: data.project_index_id,
          unit_id: data.unit_id,
          region: regionData,
        };

        // Update document first
        await apiRequest(`/api/documents/${document.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(documentPayload),
        });

        // Update beneficiaries if they exist and have data
        if (data.recipients && data.recipients.length > 0) {
          const validRecipients = data.recipients.filter(r => 
            r.firstname || r.lastname || r.afm || (r.amount && r.amount > 0)
          );
          
          if (validRecipients.length > 0) {
            await apiRequest(`/api/documents/${document.id}/beneficiaries`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ recipients: validRecipients }),
            });
          }
        }
      }
    },
    onSuccess: () => {
      setIsLoading(false);
      toast({
        title: "Επιτυχία",
        description: isCorrection 
          ? "Η ορθή επανάληψη δημιουργήθηκε επιτυχώς. Προσθέστε τώρα το νέο πρωτόκολλο." 
          : "Το έγγραφο ενημερώθηκε επιτυχώς",
      });
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents', document?.id, 'beneficiaries'] });
      refetchPayments();
      
      // For corrections, trigger the protocol modal callback before closing
      if (isCorrection && onCorrectionSuccess && document?.id) {
        onCorrectionSuccess(document.id);
      }
      
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error(`Error ${isCorrection ? 'creating correction' : 'updating document'}:`, error);
      setIsLoading(false);
      toast({
        title: "Σφάλμα",
        description: error?.message || `Παρουσιάστηκε σφάλμα κατά ${isCorrection ? 'τη δημιουργία της διόρθωσης' : 'την ενημέρωση του εγγράφου'}`,
        variant: "destructive",
      });
    },
  });

  // Function to find matching project_index entry and update form
  const findAndUpdateProjectIndex = async (projectId: number, unitId: number, expenditureTypeId: number) => {
    try {
      console.log('[EditDocument] Finding project_index for:', { projectId, unitId, expenditureTypeId });
      
      const response = await apiRequest(`/api/project-index/find/${projectId}/${unitId}/${expenditureTypeId}`) as { id: number; project_id: number; monada_id: number; expenditure_type_id: number };
      
      if (response && response.id) {
        console.log('[EditDocument] Found matching project_index:', response.id);
        form.setValue('project_index_id', response.id);
        return response.id;
      } else {
        // Clear project_index_id if no match found
        form.setValue('project_index_id', undefined);
        return null;
      }
    } catch (error: any) {
      console.error('[EditDocument] Error finding project_index:', error);
      // Clear project_index_id to prevent saving with stale data
      form.setValue('project_index_id', undefined);
      toast({
        title: "Σφάλμα",
        description: error?.details || "Δεν βρέθηκε αντίστοιχο έργο για αυτόν τον συνδυασμό. Επιλέξτε άλλο έργο ή τύπο δαπάνης.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleSubmit = (data: DocumentForm) => {
    console.log('[EditDocument] Form validation errors:', form.formState.errors);
    console.log('[EditDocument] Form isValid:', form.formState.isValid);
    console.log('[EditDocument] Submitting data:', data);
    setIsLoading(true);
    updateMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  // Add recipient
  const addRecipient = () => {
    const currentRecipients = form.getValues("recipients") || [];
    
    if (currentRecipients.length >= 15) {
      toast({
        title: "Προσοχή",
        description: "Μέγιστος αριθμός δικαιούχων: 15",
        variant: "destructive",
      });
      return;
    }
    
    form.setValue("recipients", [
      ...currentRecipients,
      { 
        firstname: "", 
        lastname: "", 
        fathername: "", 
        afm: "", 
        amount: 0, 
        installment: "ΕΦΑΠΑΞ",
        installments: ["ΕΦΑΠΑΞ"],
        installmentAmounts: { ΕΦΑΠΑΞ: 0 },
        secondary_text: ""
      }
    ]);
  };

  // Remove recipient
  const removeRecipient = (index: number) => {
    const recipients = form.getValues("recipients") || [];
    recipients.splice(index, 1);
    form.setValue("recipients", [...recipients]);
  };

  const currentStatus = form.watch("status");
  const statusOption = STATUS_OPTIONS.find(option => option.value === currentStatus);

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            {isCorrection ? (
              <>
                <AlertCircle className="w-5 h-5 text-orange-500" />
                Δημιουργία Ορθής Επανάληψης #{document.id}
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Επεξεργασία Εγγράφου #{document.id}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isCorrection 
              ? "Συμπληρώστε τα στοιχεία για τη δημιουργία ορθής επανάληψης του εγγράφου"
              : "Επεξεργασία στοιχείων και μεταδεδομένων του εγγράφου"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 py-4">
              
              {/* Correction Reason - Only visible in correction mode */}
              {isCorrection && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-orange-700">
                      <AlertCircle className="w-4 h-4" />
                      Λόγος Διόρθωσης
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="correction_reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Αιτιολογία Ορθής Επανάληψης *</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              className="min-h-[100px]"
                              placeholder="Εισάγετε τον λόγο για τον οποίο δημιουργείται η ορθή επανάληψη..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Document Information Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    Στοιχεία Εγγράφου
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Protocol fields: Only show in edit mode, not in correction mode */}
                  {!isCorrection && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="protocol_number_input"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Αριθμός Πρωτοκόλλου</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="π.χ. 12345/2025"
                                {...field}
                                data-testid="input-protocol-number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="protocol_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ημερομηνία Πρωτοκόλλου</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                data-testid="input-protocol-date"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Κατάσταση</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-status">
                                <SelectValue placeholder="Επιλέξτε κατάσταση">
                                  {statusOption && (
                                    <Badge className={statusOption.color}>
                                      {statusOption.label}
                                    </Badge>
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  <Badge className={statusOption?.color}>
                                    {option.label}
                                  </Badge>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="total_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Euro className="w-4 h-4" />
                            Συνολικό Ποσό (Αυτόματος Υπολογισμός)
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              value={`€ ${(field.value || 0).toFixed(2)}`}
                              readOnly
                              className="bg-gray-100 font-semibold"
                              data-testid="input-total-amount"
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Υπολογίζεται αυτόματα από τα ποσά των δικαιούχων
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Project and Unit Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Έργο & Μονάδα</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="unit_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Μονάδα</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              const numericValue = parseInt(value);
                              field.onChange(numericValue);
                              // Clear project and expenditure type selection when unit changes
                              form.setValue("project_index_id", undefined);
                              setSelectedProjectId(null);
                              setSelectedExpenditureTypeId(null);
                              // Invalidate projects query to fetch new projects
                              queryClient.invalidateQueries({ queryKey: ['projects-working', numericValue] });
                            }} 
                            value={field.value ? field.value.toString() : undefined}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-unit">
                                <SelectValue placeholder="Επιλέξτε μονάδα" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {units && Array.isArray(units) && units.map((unit: any) => (
                                <SelectItem key={unit.unit} value={unit.unit.toString()}>
                                  {unit.name || unit.unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="project_index_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Έργο</FormLabel>
                          <Select 
                            onValueChange={async (value) => {
                              const projectId = parseInt(value);
                              setSelectedProjectId(projectId);
                              
                              // Find and update project_index_id if we have all required values
                              const unitId = form.getValues('unit_id');
                              if (projectId && unitId && selectedExpenditureTypeId) {
                                await findAndUpdateProjectIndex(projectId, unitId, selectedExpenditureTypeId);
                              }
                            }} 
                            value={selectedProjectId ? selectedProjectId.toString() : undefined}
                            disabled={!selectedUnitId}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-project">
                                <SelectValue placeholder={!selectedUnitId ? "Επιλέξτε πρώτα μονάδα" : "Επιλέξτε έργο"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {projects && Array.isArray(projects) && projects.map((project: any) => (
                                <SelectItem key={project.id} value={project.id.toString()}>
                                  {project.project_name || project.name || project.mis}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormItem>
                      <FormLabel>Τύπος Δαπάνης</FormLabel>
                      <Select 
                        onValueChange={async (value) => {
                          const expenditureTypeId = parseInt(value);
                          setSelectedExpenditureTypeId(expenditureTypeId);
                          
                          // Find and update project_index_id if we have all required values
                          const unitId = form.getValues('unit_id');
                          if (selectedProjectId && unitId && expenditureTypeId) {
                            await findAndUpdateProjectIndex(selectedProjectId, unitId, expenditureTypeId);
                          }
                        }} 
                        value={selectedExpenditureTypeId ? selectedExpenditureTypeId.toString() : undefined}
                        disabled={!selectedProjectId}
                      >
                        <SelectTrigger data-testid="select-expenditure-type">
                          <SelectValue placeholder={!selectedProjectId ? "Επιλέξτε πρώτα έργο" : "Επιλέξτε τύπο δαπάνης"} />
                        </SelectTrigger>
                        <SelectContent>
                          {expenditureTypes && Array.isArray(expenditureTypes) && expenditureTypes.map((type: any) => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              {type.description || type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">
                        Επιλέξτε τον τύπο δαπάνης για το έργο
                      </p>
                    </FormItem>
                  </div>
                </CardContent>
              </Card>

              {/* Εσωτερική Διανομή Fields Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Πεδία Εσωτερικής Διανομής</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="esdian_field1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Εσωτερική Διανομή Πεδίο 1</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Πρώτο πεδίο εσωτερικής διανομής"
                              {...field}
                              data-testid="input-esdian-1"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="esdian_field2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Εσωτερική Διανομή Πεδίο 2</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Δεύτερο πεδίο εσωτερικής διανομής"
                              {...field}
                              data-testid="input-esdian-2"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Comments Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Σχόλια</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="comments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Γενικές Παρατηρήσεις</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Προαιρετικά σχόλια ή σημειώσεις για το έγγραφο"
                            className="min-h-[100px]"
                            {...field}
                            data-testid="textarea-comments"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Geographic Region Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Γεωγραφική Περιοχή
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Smart Hierarchical Geographic Selection */}
                  {(availableRegions.length > 0 ||
                    availableUnits.length > 0 ||
                    availableMunicipalities.length > 0) ? (
                    <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
                      <h3 className="text-xs font-medium text-gray-700">
                        Γεωγραφική Περιοχή Διαβιβαστίκου
                      </h3>

                      {/* Filter by Region */}
                      {availableRegions.length > 0 && (
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-medium text-gray-600 whitespace-nowrap min-w-[140px]">
                            Φίλτρο Περιφέρειας
                          </label>
                          <div className="flex-1">
                            <Select
                              value={selectedRegionFilter}
                              onValueChange={(value) => {
                                // Skip if this is a programmatic update (cascade from municipality/unit selection)
                                if (isProgrammaticUpdateRef.current) {
                                  console.log("[EditDocument] Region handler: Skipping programmatic update");
                                  return;
                                }
                                
                                // Mark that user has interacted
                                geoUserInteractedRef.current = true;
                                
                                const regionCode = value === "all" ? "" : value;
                                setSelectedRegionFilter(regionCode);
                                setSelectedUnitFilter("");

                                if (regionCode) {
                                  const selectedRegionName =
                                    availableRegions.find(
                                      (r: any) => r.code === regionCode,
                                    )?.name || "";
                                  form.setValue("region", selectedRegionName);
                                  setSelectedMunicipalityId("");
                                  console.log(
                                    "[EditDocument] Selected region as final choice:",
                                    selectedRegionName,
                                  );
                                } else {
                                  // Don't clear geographic_region when selecting "all" - just reset filter state
                                  setSelectedMunicipalityId("");
                                }
                              }}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Όλες οι περιφέρειες" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">
                                  Όλες οι περιφέρειες
                                </SelectItem>
                                {availableRegions.map((region: any) => (
                                  <SelectItem
                                    key={`region-${region.code}`}
                                    value={region.code}
                                  >
                                    {region.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {/* Filter by Regional Unit */}
                      {availableUnits.length > 0 && (
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-medium text-gray-600 whitespace-nowrap min-w-[140px]">
                            Φίλτρο Περιφερειακής Ενότητας
                            {selectedRegionFilter && (
                              <span className="text-gray-500">
                                (στην{" "}
                                {
                                  availableRegions.find(
                                    (r: any) => r.code === selectedRegionFilter,
                                  )?.name
                                }
                                )
                              </span>
                            )}
                          </label>
                          <div className="flex-1">
                            <Select
                              value={selectedUnitFilter}
                              onValueChange={(value) => {
                                // Skip if this is a programmatic update (cascade from municipality selection)
                                if (isProgrammaticUpdateRef.current) {
                                  console.log("[EditDocument] Unit handler: Skipping programmatic update");
                                  return;
                                }
                                
                                // Mark that user has interacted
                                geoUserInteractedRef.current = true;
                                
                                const unitCode = value === "all" ? "" : value;
                                setSelectedUnitFilter(unitCode);

                                if (unitCode) {
                                  const selectedUnit = availableUnits.find(
                                    (u: any) => u.code === unitCode,
                                  );

                                  if (selectedUnit) {
                                    // Set parent region filter programmatically
                                    if (selectedUnit.region_code) {
                                      isProgrammaticUpdateRef.current = true;
                                      setSelectedRegionFilter(selectedUnit.region_code);
                                      // Reset flag after state update completes
                                      setTimeout(() => {
                                        isProgrammaticUpdateRef.current = false;
                                      }, 0);
                                    }

                                    form.setValue("region", selectedUnit.name);
                                    setSelectedMunicipalityId("");
                                    console.log(
                                      "[EditDocument] Selected regional unit as final choice:",
                                      selectedUnit.name,
                                    );
                                  }
                                } else {
                                  // Don't clear region when selecting "all" - just reset filter state
                                  setSelectedMunicipalityId("");
                                }
                              }}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Όλες οι περιφερειακές ενότητες" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">
                                  Όλες οι περιφερειακές ενότητες
                                </SelectItem>
                                {availableUnits.map((unit: any) => (
                                  <SelectItem
                                    key={`unit-${unit.code}`}
                                    value={unit.code}
                                  >
                                    {unit.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {/* Final Municipality Selection */}
                      {availableMunicipalities.length > 0 && (
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-medium whitespace-nowrap min-w-[140px]">
                            Τελική Επιλογή Δήμου/Κοινότητας
                            {(selectedRegionFilter || selectedUnitFilter) && (
                              <span className="text-xs text-gray-500 ml-2">
                                ({availableMunicipalities.length} διαθέσιμες
                                επιλογές)
                              </span>
                            )}
                          </label>
                          <div className="flex-1">
                            <Select
                              value={selectedMunicipalityId}
                              onValueChange={(value) => {
                                // Mark that user has interacted
                                geoUserInteractedRef.current = true;
                                
                                const selectedMunicipality =
                                  availableMunicipalities.find(
                                    (m: any) => m.id === value,
                                  );
                                if (selectedMunicipality) {
                                  const parentUnit = (
                                    (projectGeographicAreas as any)
                                      ?.availableUnits || []
                                  ).find(
                                    (u: any) =>
                                      u.code === selectedMunicipality.unit_code,
                                  );

                                  if (parentUnit) {
                                    // Set flag to prevent cascading handlers from overwriting our selection
                                    isProgrammaticUpdateRef.current = true;
                                    
                                    setSelectedUnitFilter(parentUnit.code);

                                    if (parentUnit.region_code) {
                                      setSelectedRegionFilter(
                                        parentUnit.region_code,
                                      );
                                    }
                                    
                                    // Reset flag after state updates complete
                                    setTimeout(() => {
                                      isProgrammaticUpdateRef.current = false;
                                    }, 0);
                                  }

                                  form.setValue(
                                    "region",
                                    selectedMunicipality.name,
                                  );
                                  setSelectedMunicipalityId(value);
                                  console.log(
                                    "[EditDocument] Selected municipality as final choice:",
                                    selectedMunicipality.name,
                                  );
                                }
                              }}
                              disabled={regionsLoading}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Επιλέξτε δήμο/κοινότητα" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {availableMunicipalities
                                  .filter(
                                    (municipality: any) =>
                                      municipality.code && municipality.name,
                                  )
                                  .map((municipality: any) => (
                                    <SelectItem
                                      key={`municipality-${municipality.code}`}
                                      value={municipality.id}
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-medium">
                                          {municipality.name}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          Δήμος/Κοινότητα
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                {availableMunicipalities.length === 0 && (
                                  <SelectItem
                                    value="no-municipalities"
                                    disabled
                                  >
                                    Δεν υπάρχουν διαθέσιμοι δήμοι
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {/* Show current selection path */}
                      {(selectedRegionFilter ||
                        selectedUnitFilter ||
                        selectedMunicipalityId) && (
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                          <strong>Επιλεγμένη γεωγραφική περιοχή:</strong>{" "}
                          {(() => {
                            const areas = projectGeographicAreas as any;
                            const parts = [];
                            if (selectedRegionFilter) {
                              const region = areas?.availableRegions?.find((r: any) => r.code === Number(selectedRegionFilter));
                              if (region) parts.push(region.name);
                            }
                            if (selectedUnitFilter) {
                              const unit = areas?.availableUnits?.find((u: any) => u.code === Number(selectedUnitFilter));
                              if (unit) parts.push(unit.name);
                            }
                            if (selectedMunicipalityId) {
                              const municipality = areas?.availableMunicipalities?.find((m: any) => m.code === Number(selectedMunicipalityId));
                              if (municipality) parts.push(municipality.name);
                            }
                            return parts.length > 0 ? parts.join(' → ') : 'Καμία επιλογή';
                          })()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Δεν υπάρχουν διαθέσιμες γεωγραφικές περιοχές για αυτό το έργο
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Beneficiaries Management Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Διαχείριση Δικαιούχων
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      Επεξεργασία των στοιχείων των δικαιούχων ({form.watch("recipients")?.length || 0})
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addRecipient}
                      data-testid="button-add-recipient"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Προσθήκη Δικαιούχου
                    </Button>
                  </div>

                  <Separator />

                  {(!form.watch("recipients") || form.watch("recipients")?.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Δεν υπάρχουν δικαιούχοι</p>
                      <p className="text-sm">Πατήστε "Προσθήκη Δικαιούχου" για να προσθέσετε</p>
                    </div>
                  )}

                  {form.watch("recipients")?.map((recipient, index) => (
                    <Card key={index} className="border-2">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-md flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Δικαιούχος #{index + 1}
                          </CardTitle>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRecipient(index)}
                            className="text-red-500 hover:text-red-700"
                            data-testid={`button-remove-recipient-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name={`recipients.${index}.firstname`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Όνομα *</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    data-testid={`input-recipient-firstname-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`recipients.${index}.lastname`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Επώνυμο *</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    data-testid={`input-recipient-lastname-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`recipients.${index}.fathername`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Πατρώνυμο</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    data-testid={`input-recipient-fathername-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <FormLabel>ΑΦΜ *</FormLabel>
                            <SimpleAFMAutocomplete
                              expenditureType=""
                              value={form.watch(`recipients.${index}.afm`) || ""}
                              onChange={(afm) => {
                                form.setValue(`recipients.${index}.afm`, afm);
                              }}
                              onSelectPerson={(personData) => {
                                if (personData) {
                                  form.setValue(`recipients.${index}.firstname`, personData.name || "");
                                  form.setValue(`recipients.${index}.lastname`, personData.surname || "");
                                  form.setValue(`recipients.${index}.fathername`, personData.fathername || "");
                                  const secondaryText = (personData as any).freetext || (personData as any).attribute || "";
                                  if (secondaryText) {
                                    form.setValue(`recipients.${index}.secondary_text`, secondaryText);
                                  }
                                }
                              }}
                              placeholder="Αναζήτηση με ΑΦΜ..."
                              className="w-full"
                            />
                            <FormField
                              control={form.control}
                              name={`recipients.${index}.afm`}
                              render={() => (
                                <FormItem>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name={`recipients.${index}.amount`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-1">
                                  <Euro className="w-3 h-3" />
                                  Ποσό *
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    data-testid={`input-recipient-amount-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`recipients.${index}.installment`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Δόση</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    data-testid={`input-recipient-installment-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {(!form.watch("recipients") || form.watch("recipients").length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Δεν υπάρχουν δικαιούχοι</p>
                      <p className="text-sm">Κάντε κλικ στο κουμπί "Προσθήκη Δικαιούχου" για να προσθέσετε</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Original Document Info - Only visible in correction mode or if is_correction */}
              {(isCorrection || form.watch("is_correction")) && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-700">
                      Στοιχεία Αρχικού Εγγράφου
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="original_protocol_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Αρχικός Αριθμός Πρωτοκόλλου</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                readOnly={isCorrection}
                                className={isCorrection ? "bg-gray-100" : ""}
                                data-testid="input-original-protocol-number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="original_protocol_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Αρχική Ημερομηνία Πρωτοκόλλου</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                readOnly={isCorrection}
                                className={isCorrection ? "bg-gray-100" : ""}
                                data-testid="input-original-protocol-date"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </form>
          </Form>
        </div>

        <div className="p-6 pt-2 border-t flex justify-end gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            data-testid="button-cancel"
          >
            <X className="w-4 h-4 mr-2" />
            Ακύρωση
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            data-testid="button-save"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Αποθήκευση...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isCorrection ? "Δημιουργία Ορθής Επανάληψης" : "Αποθήκευση Αλλαγών"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
