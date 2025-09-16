import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Star, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

// Enhanced ESDIAN suggestion types
interface EsdianSuggestion {
  value: string;
  frequency: number;
  lastUsed: string;
  userFrequency: number;
  teamFrequency: number;
  contextMatches: number;
  source: 'user' | 'team';
  score: number;
}

interface EsdianCompleteSet {
  fields: string[];
  frequency: number;
  lastUsed: string;
  documentId: number;
  isUserOwned: boolean;
  isContextMatch: boolean;
  score: number;
}

interface EsdianAutoPopulate {
  fields: string[];
  confidence: 'high' | 'medium' | 'low';
  reason: 'context_match' | 'user_pattern' | 'team_pattern';
  documentId: number;
}

interface EsdianCategories {
  recent: EsdianSuggestion[];
  frequent: EsdianSuggestion[];
  contextual: EsdianSuggestion[];
  team: EsdianSuggestion[];
}

interface EsdianSuggestionsResponse {
  status: string;
  suggestions: EsdianSuggestion[];
  completeSets: EsdianCompleteSet[];
  autoPopulate: EsdianAutoPopulate | null;
  categories: EsdianCategories;
  total: number;
  hasContext: boolean;
}

interface EsdianFieldsWithSuggestionsProps {
  form: any;
  user: any;
}

export function EsdianFieldsWithSuggestions({ form, user }: EsdianFieldsWithSuggestionsProps) {
  const projectId = form.watch("project_id");
  const expenditureType = form.watch("expenditure_type");
  
  // Watch the esdian_fields array
  const esdianFields = form.watch("esdian_fields") || [""];
  
  // Initialize with at least one field if none exist
  useEffect(() => {
    if (!esdianFields || esdianFields.length === 0) {
      form.setValue("esdian_fields", [""]);
    }
  }, [form, esdianFields]);

  const { data: esdianSuggestions } = useQuery<EsdianSuggestionsResponse>({
    queryKey: ['esdian-suggestions', user?.id, projectId, expenditureType],
    queryFn: async () => {
      if (!user?.id) return { 
        status: 'error', 
        suggestions: [], 
        completeSets: [],
        autoPopulate: null,
        categories: { recent: [], frequent: [], contextual: [], team: [] },
        total: 0, 
        hasContext: false 
      };
      
      const params = new URLSearchParams();
      if (projectId) params.append('project_id', projectId);
      if (expenditureType) params.append('expenditure_type', expenditureType);
      
      const url = `/api/user-preferences/esdian${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiRequest(url);
      return response as EsdianSuggestionsResponse;
    },
    enabled: Boolean(user?.id),
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes to allow for context changes
  });

  const suggestions = esdianSuggestions?.suggestions || [];
  const hasContext = esdianSuggestions?.hasContext || false;
  const completeSets = esdianSuggestions?.completeSets || [];
  const autoPopulate = esdianSuggestions?.autoPopulate;
  const categories = esdianSuggestions?.categories;

  const handleSuggestionClick = (value: string, fieldIndex: number) => {
    const currentFields = form.getValues("esdian_fields") || [];
    const newFields = [...currentFields];
    newFields[fieldIndex] = value;
    form.setValue("esdian_fields", newFields);
  };

  const addEsdianField = () => {
    const currentFields = form.getValues("esdian_fields") || [];
    form.setValue("esdian_fields", [...currentFields, ""]);
  };

  const removeEsdianField = (index: number) => {
    const currentFields = form.getValues("esdian_fields") || [];
    if (currentFields.length > 1) {
      const newFields = currentFields.filter((_: string, i: number) => i !== index);
      form.setValue("esdian_fields", newFields);
    }
  };

  const applyContextSuggestions = () => {
    const contextSuggestions = suggestions.filter((s: EsdianSuggestion) => s.contextMatches > 0);
    if (contextSuggestions.length > 0) {
      const newFields = contextSuggestions.slice(0, Math.min(contextSuggestions.length, 5)).map((s: EsdianSuggestion) => s.value);
      form.setValue("esdian_fields", newFields);
    }
  };

  // Auto-population effect when suggestions load
  useEffect(() => {
    if (autoPopulate && autoPopulate.confidence === 'high') {
      const currentFields = form.getValues("esdian_fields") || [""];
      // Only auto-populate if fields are empty
      const hasEmptyFields = currentFields.every((field: string) => !field || field.trim() === "");
      
      if (hasEmptyFields) {
        form.setValue("esdian_fields", autoPopulate.fields);
        console.log(`[EsdianFields] Auto-populated with ${autoPopulate.reason}: ${autoPopulate.fields.join(', ')}`);
      }
    }
  }, [autoPopulate, form]);

  // Apply complete set function
  const applyCompleteSet = (set: EsdianCompleteSet) => {
    form.setValue("esdian_fields", set.fields);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Εσωτερική Διανομή</h3>
          <p className="text-sm text-gray-600">Επιλέξτε τμήματα για διανομή του εγγράφου</p>
        </div>
        {suggestions.length > 0 && hasContext && (
          <Badge variant="secondary" className="text-xs">
            <Lightbulb className="h-3 w-3 mr-1" />
            Έξυπνες προτάσεις
          </Badge>
        )}
      </div>

      {/* Auto-Population Indicator */}
      {autoPopulate && autoPopulate.confidence === 'high' && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">
              Τα πεδία συμπληρώθηκαν αυτόματα βάσει {autoPopulate.reason === 'context_match' ? 'παρόμοιων εγγράφων για αυτό το έργο' : 'της συνήθους χρήσης σας'}
            </span>
          </div>
        </div>
      )}

      {/* One-Click Complete Sets */}
      {completeSets.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded p-3">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-800">Γρήγορη επιλογή από προηγούμενα έγγραφα</span>
          </div>
          <div className="space-y-2">
            {completeSets.slice(0, 3).map((set: EsdianCompleteSet, index: number) => (
              <div key={index} className="flex items-center justify-between bg-white rounded p-3 text-sm border">
                <div className="flex-1">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {set.fields.map((field: string, fieldIndex: number) => (
                      <Badge key={fieldIndex} variant="secondary" className="text-xs">
                        {field}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span>{set.isUserOwned ? '👤 Δικό σας' : '👥 Ομάδας'}</span>
                    {set.isContextMatch && <span>✨ Αυτό το έργο</span>}
                    <span>📊 {set.frequency}x</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-purple-600 hover:bg-purple-50 border-purple-300"
                  onClick={() => applyCompleteSet(set)}
                  data-testid={`button-apply-complete-set-${index}`}
                >
                  Εφαρμογή
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Smart Suggestions */}
      {suggestions.filter((s: EsdianSuggestion) => s.contextMatches > 0).length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 text-green-600" />
              <span className="text-xs font-medium text-green-800">Για αυτό το έργο συνήθως:</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-green-700 hover:bg-green-100 h-6 px-2"
              onClick={applyContextSuggestions}
            >
              Αυτόματη εφαρμογή
            </Button>
          </div>
          <div className="space-y-1">
            {suggestions
              .filter((s: EsdianSuggestion) => s.contextMatches > 0)
              .slice(0, 5)
              .map((suggestion: EsdianSuggestion, index: number) => (
                <div key={index} className="flex items-center justify-between bg-white rounded p-2 text-xs">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-gray-700 truncate">{suggestion.value}</span>
                    <div className="flex gap-1">
                      {suggestion.source === 'user' && <span className="text-blue-600">👤</span>}
                      {suggestion.contextMatches > 0 && <span className="text-green-600">✨</span>}
                      {suggestion.frequency > 2 && <span className="text-orange-600">⭐</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {esdianFields.map((_: string, fieldIndex: number) => (
                      <Button
                        key={fieldIndex}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-green-600 hover:bg-green-100"
                        onClick={() => handleSuggestionClick(suggestion.value, fieldIndex)}
                        title={`Πεδίο ${fieldIndex + 1}`}
                        data-testid={`button-suggestion-${index}-field-${fieldIndex + 1}`}
                      >
                        {fieldIndex + 1}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Dynamic ESDIAN Input Fields */}
      <div className="space-y-4">
        {esdianFields.map((field: string, index: number) => (
          <div key={index} className="flex items-end gap-2">
            <div className="flex-1">
              <FormField
                control={form.control}
                name={`esdian_fields.${index}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Εσωτερική Διανομή {index + 1}</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="π.χ. ΤΜΗΜΑ ΔΙΑΧΕΙΡΙΣΗΣ ΚΡΙΣΕΩΝ" 
                        data-testid={`input-esdian-field-${index + 1}`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {esdianFields.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 px-3 text-red-600 hover:bg-red-50 hover:border-red-300"
                onClick={() => removeEsdianField(index)}
                data-testid={`button-remove-esdian-field-${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full h-10 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
          onClick={addEsdianField}
          data-testid="button-add-esdian-field"
        >
          <Plus className="h-4 w-4 mr-2" />
          Προσθήκη νέου πεδίου διανομής
        </Button>
      </div>
    </div>
  );
}