// Auto-inheritance logic hook for connected decisions in budget versions
import { useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ComprehensiveFormData, DecisionOrigin } from '@/utils/project-form-types';

export function useAutoInheritance(form: UseFormReturn<ComprehensiveFormData>) {
  // 🔗 Auto-inheritance logic για connected decisions
  const handleConnectedDecisionChange = useCallback((
    formulationIndex: number, 
    budgetType: 'pde' | 'epa', 
    versionIndex: number, 
    newDecisionId: number,
    isAdding: boolean = true
  ) => {
    const formulations = form.getValues('formulation_details');
    const versions = formulations[formulationIndex].budget_versions[budgetType];
    
    if (isAdding) {
      // Προσθήκη decision στην τρέχουσα έκδοση
      const currentDecisions = versions[versionIndex].connected_decisions || [];
      if (!currentDecisions.includes(newDecisionId)) {
        currentDecisions.push(newDecisionId);
        versions[versionIndex].connected_decisions = currentDecisions;
        
        // 🚀 AUTO-INHERITANCE: Προσθήκη σε όλες τις μεταγενέστερες εκδόσεις
        for (let i = versionIndex + 1; i < versions.length; i++) {
          const laterVersionDecisions = versions[i].connected_decisions || [];
          if (!laterVersionDecisions.includes(newDecisionId)) {
            versions[i].connected_decisions = [...laterVersionDecisions, newDecisionId];
          }
        }
        
        // Ενημέρωση form
        form.setValue(`formulation_details.${formulationIndex}.budget_versions.${budgetType}`, versions);
        
        console.log(`[Auto-Inheritance] Decision ${newDecisionId} added to ${budgetType} version ${versionIndex} and ${versions.length - versionIndex - 1} later versions`);
      }
    }
  }, [form]);

  // 🗑️ Helper για αφαίρεση decision (χωρίς auto-inheritance για removal)
  const handleConnectedDecisionRemoval = useCallback((
    formulationIndex: number,
    budgetType: 'pde' | 'epa',
    versionIndex: number,
    decisionIdToRemove: number
  ) => {
    const formulations = form.getValues('formulation_details');
    const versions = formulations[formulationIndex].budget_versions[budgetType];
    
    const currentDecisions = versions[versionIndex].connected_decisions || [];
    versions[versionIndex].connected_decisions = currentDecisions.filter(id => id !== decisionIdToRemove);
    
    form.setValue(`formulation_details.${formulationIndex}.budget_versions.${budgetType}`, versions);
    
    console.log(`[Decision Removal] Decision ${decisionIdToRemove} removed from ${budgetType} version ${versionIndex}`);
  }, [form]);

  // 🔍 Helper για εντοπισμό inherited vs direct decisions
  const getDecisionOrigin = useCallback((
    formulationIndex: number,
    budgetType: 'pde' | 'epa',
    versionIndex: number,
    decisionId: number
  ): DecisionOrigin => {
    const formulations = form.getValues('formulation_details');
    const versions = formulations[formulationIndex].budget_versions[budgetType];
    
    // Ελέγχουμε αν το decision υπάρχει σε παλαιότερη έκδοση
    for (let i = versionIndex - 1; i >= 0; i--) {
      const olderVersionDecisions = versions[i].connected_decisions || [];
      if (olderVersionDecisions.includes(decisionId)) {
        return { isInherited: true, inheritedFromVersion: i };
      }
    }
    
    return { isInherited: false, inheritedFromVersion: null };
  }, [form]);

  return {
    handleConnectedDecisionChange,
    handleConnectedDecisionRemoval,
    getDecisionOrigin,
  };
}