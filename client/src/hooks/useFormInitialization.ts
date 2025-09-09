// Hook for form initialization logic
import { useEffect, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ComprehensiveFormData, UnitData, EventTypeData, ExpenditureTypeData, ProjectData } from '@/utils/project-form-types';
import { normalizeFekData } from '@/utils/project-form-utils';

interface UseFormInitializationProps {
  form: UseFormReturn<ComprehensiveFormData>;
  mis: string | undefined;
  projectData: ProjectData | undefined;
  decisionsData: any[] | undefined;
  formulationsData: any[] | undefined;
  projectIndexData: any[] | undefined;
  typedUnitsData: UnitData[] | undefined;
  typedEventTypesData: EventTypeData[] | undefined;
  typedExpenditureTypesData: ExpenditureTypeData[] | undefined;
  completeProjectData: any;
  setFormKey: (fn: (prev: number) => number) => void;
  setInitializationTime: (time: number) => void;
}

export function useFormInitialization({
  form,
  mis,
  projectData,
  decisionsData,
  formulationsData,
  projectIndexData,
  typedUnitsData,
  typedEventTypesData,
  typedExpenditureTypesData,
  completeProjectData,
  setFormKey,
  setInitializationTime,
}: UseFormInitializationProps) {
  const hasInitialized = useRef(false);
  const isInitializingRef = useRef(false);

  // Helper function to consolidate location details processing
  const getLocationDetailsFromData = () => {
    if (
      projectIndexData &&
      Array.isArray(projectIndexData) &&
      projectIndexData.length > 0
    ) {
      const locationDetailsMap = new Map();

      // Group by implementing agency and event type
      projectIndexData.forEach((indexItem) => {
        const unit = typedUnitsData?.find((u) => u.id === indexItem.monada_id);
        const eventType = typedEventTypesData?.find(
          (et) => et.id === indexItem.event_types_id,
        );
        const expenditureType = typedExpenditureTypesData?.find(
          (et) => et.id === indexItem.expenditure_type_id,
        );

        const key = `${indexItem.monada_id || "no-unit"}-${indexItem.event_types_id || "no-event"}`;

        if (!locationDetailsMap.has(key)) {
          // Use consistent naming pattern that matches the dropdown options
          const implementingAgencyName =
            unit?.unit_name?.name || unit?.name || unit?.unit || "";

          let locationDetail = {
            implementing_agency: implementingAgencyName,
            event_type: eventType?.name || "",
            expenditure_types: [],
            geographic_areas: [],
          };

          locationDetailsMap.set(key, locationDetail);
        }

        const locationDetail = locationDetailsMap.get(key);

        // Add expenditure type if it doesn't exist
        if (expenditureType && !locationDetail.expenditure_types.includes(expenditureType.expenditure_types)) {
          locationDetail.expenditure_types.push(expenditureType.expenditure_types);
        }
      });

      // Process geographic data if available
      if (completeProjectData?.projectGeographicData) {
        const { regions, regionalUnits, municipalities } = completeProjectData.projectGeographicData;
        
        locationDetailsMap.forEach((locationDetail) => {
          const uniqueAreas = new Set<string>();
          
          regions?.forEach((regionData: any) => {
            if (regionData.regions?.name) {
              const regionName = regionData.regions.name;
              
              const relatedUnits = regionalUnits?.filter((unitData: any) => 
                unitData.regional_units?.region_code === regionData.regions.code
              ) || [];
              
              const relatedMunicipalities = municipalities?.filter((muniData: any) => 
                relatedUnits.some((unitData: any) => unitData.regional_units?.code === muniData.municipalities?.unit_code)
              ) || [];

              relatedUnits.forEach((unitData: any) => {
                const regionalUnitName = unitData.regional_units?.name;
                
                const unitMunicipalities = relatedMunicipalities.filter((muniData: any) => 
                  muniData.municipalities?.unit_code === (unitData as any).regional_units?.code
                );

                if (unitMunicipalities.length > 0) {
                  unitMunicipalities.forEach((muniData: any) => {
                    const municipalityName = muniData.municipalities?.name;
                    const geographicAreaId = `${regionName}|${regionalUnitName}|${municipalityName}`;
                    
                    if (!uniqueAreas.has(geographicAreaId)) {
                      uniqueAreas.add(geographicAreaId);
                      locationDetail.geographic_areas.push(geographicAreaId);
                    }
                  });
                } else {
                  const geographicAreaId = `${regionName}|${regionalUnitName}|`;
                  
                  if (!uniqueAreas.has(geographicAreaId)) {
                    uniqueAreas.add(geographicAreaId);
                    locationDetail.geographic_areas.push(geographicAreaId);
                  }
                }
              });
            }
          });
        });
      }

      return Array.from(locationDetailsMap.values());
    }

    // Return default location detail if no data
    return [{
      implementing_agency: "",
      event_type: "",
      expenditure_types: [],
      geographic_areas: [],
    }];
  };

  useEffect(() => {
    if (
      !mis ||
      !projectData ||
      hasInitialized.current ||
      isInitializingRef.current
    ) {
      return;
    }

    console.log("🔥 FORM INITIALIZATION STARTING");
    isInitializingRef.current = true;

    const typedProjectData = projectData as ProjectData;

    // Prepare decisions data
    let processedDecisions = [];
    if (decisionsData && decisionsData.length > 0) {
      processedDecisions = decisionsData.map((decision) => ({
        protocol_number: decision.protocol_number || "",
        fek: normalizeFekData(decision.fek),
        ada: decision.ada || "",
        implementing_agency: decision.implementing_agency || [],
        decision_budget: decision.decision_budget || "",
        expenses_covered: decision.expenses_covered || "",
        expenditure_type: decision.expenditure_type || [],
        decision_type: decision.decision_type || "Έγκριση",
        included: decision.included !== false,
        comments: decision.comments || "",
      }));
    } else {
      processedDecisions = [{
        protocol_number: "",
        fek: { year: "", issue: "", number: "" },
        ada: "",
        implementing_agency: [],
        decision_budget: "",
        expenses_covered: "",
        expenditure_type: [],
        decision_type: "Έγκριση",
        included: true,
        comments: "",
      }];
    }

    // Prepare formulations data
    let processedFormulations = [];
    if (formulationsData && formulationsData.length > 0) {
      processedFormulations = formulationsData.map((formulation) => ({
        sa: formulation.sa_type || formulation.sa || "ΝΑ853",
        enumeration_code: formulation.enumeration_code || "",
        decision_year: formulation.decision_year?.toString() || "",
        decision_status: formulation.decision_status || "Ενεργή",
        change_type: formulation.change_type || "Έγκριση",
        comments: formulation.comments || "",
        budget_versions: {
          pde: formulation.budget_versions?.pde || [],
          epa: formulation.budget_versions?.epa || [],
        },
      }));
    } else {
      processedFormulations = [{
        sa: "ΝΑ853",
        enumeration_code: "",
        decision_year: "",
        decision_status: "Ενεργή",
        change_type: "Έγκριση",
        comments: "",
        budget_versions: {
          pde: [],
          epa: []
        }
      }];
    }

    const formData = {
      decisions: processedDecisions,
      event_details: {
        event_name: "",
        event_year: typedProjectData.event_year?.toString() || "",
      },
      project_details: {
        mis: typedProjectData.mis || "",
        sa: typedProjectData.na853 || "ΝΑ853",
        inc_year: "", // This would need to be extracted from project data if available
        project_title: typedProjectData.project_title || "",
        project_description: typedProjectData.event_description || "",
        summary_description: "", // This would need to be extracted if available
        expenses_executed: "", // This would need to be extracted if available
        project_status: typedProjectData.status || "Ενεργό",
      },
      formulation_details: processedFormulations,
      location_details: getLocationDetailsFromData(),
      previous_entries: [],
      changes: []
    };

    // Set each field individually to force component updates
    console.log("🔥 SETTING FORM VALUES INDIVIDUALLY:");
    form.setValue("decisions", formData.decisions, {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.setValue("event_details", formData.event_details, {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.setValue("project_details", formData.project_details, {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.setValue("formulation_details", formData.formulation_details, {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.setValue("location_details", formData.location_details, {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.setValue("previous_entries", formData.previous_entries, {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.setValue("changes", formData.changes, {
      shouldValidate: true,
      shouldDirty: true,
    });

    // Force form re-render and validation
    form.trigger();

    // Force component re-render by updating key
    setFormKey((prev) => prev + 1);

    hasInitialized.current = true;
    setInitializationTime(Date.now());

    // Clear initialization flag after a delay to allow form to settle
    setTimeout(() => {
      isInitializingRef.current = false;
      console.log("Form initialization complete - field clearing protection disabled");
    }, 3000);
  }, [
    mis,
    projectData,
    decisionsData,
    formulationsData,
    projectIndexData,
    typedUnitsData,
    typedEventTypesData,
    typedExpenditureTypesData,
    completeProjectData,
    form,
    setFormKey,
    setInitializationTime,
  ]);

  // Reset initialization state when component mounts
  useEffect(() => {
    hasInitialized.current = false;
  }, []);

  return {
    hasInitialized,
    isInitializingRef,
  };
}