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
  const esdianFields = form.watch("esdian_fields") || [];

  // Ensure the value stays an array even when empty (fields are optional)
  useEffect(() => {
    if (!Array.isArray(esdianFields)) {
      form.setValue("esdian_fields", []);
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
  const contextSuggestions = suggestions.filter((s: EsdianSuggestion) => s.contextMatches > 0);
  const displayedSuggestions =
    contextSuggestions.length > 0 ? contextSuggestions.slice(0, 5) : suggestions.slice(0, 5);

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
    const newFields = currentFields.filter((_: string, i: number) => i !== index);
    form.setValue("esdian_fields", newFields);
  };

  const applySuggestionToNext = (value: string) => {
    const currentFields = form.getValues("esdian_fields") || [];
    const firstEmptyIndex = currentFields.findIndex(
      (v: string) => !v || !String(v).trim(),
    );
    const newFields = [...currentFields];
    if (firstEmptyIndex >= 0) {
      newFields[firstEmptyIndex] = value;
    } else {
      newFields.push(value);
    }
    form.setValue("esdian_fields", newFields);
  };

  const applyContextSuggestions = () => {
    const contextSuggestionsLocal = suggestions.filter((s: EsdianSuggestion) => s.contextMatches > 0);
    const source = contextSuggestionsLocal.length > 0 ? contextSuggestionsLocal : suggestions;
    if (source.length > 0) {
      const newFields = source.slice(0, Math.min(source.length, 5)).map((s: EsdianSuggestion) => s.value);
      form.setValue("esdian_fields", newFields);
    }
  };

  // Auto-population effect when suggestions load
  useEffect(() => {
    if (autoPopulate && autoPopulate.confidence === 'high') {
      const currentFields = form.getValues("esdian_fields") || [];
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

  // Helper function to get badge label for suggestion source/reason
  const getSuggestionBadgeLabel = (suggestion: EsdianSuggestion): string => {
    if (suggestion.contextMatches > 0) return "Σχετικό έργο";
    if (suggestion.frequency > 2) return "Συχνό";
    if (suggestion.source === "user") return "Δικό σας";
    return "Ομάδα";
  };

  // Helper function to get badge color for suggestion source
  const getSuggestionBadgeColor = (suggestion: EsdianSuggestion): string => {
    if (suggestion.contextMatches > 0) return "bg-green-50 text-green-700 border-green-200";
    if (suggestion.frequency > 2) return "bg-orange-50 text-orange-700 border-orange-200";
    if (suggestion.source === "user") return "bg-blue-50 text-blue-700 border-blue-200";
    return "bg-gray-50 text-gray-700 border-gray-200";
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Εσωτερική Διανομή</h3>
          <p className="text-xs text-gray-500">
            Τμήματα για διανομή εγγράφου • 
            <span className="text-green-600 font-medium"> 1. Χρονολογικό Αρχείο</span> συμπεριλαμβάνεται αυτόματα
          </p>
        </div>
        {suggestions.length > 0 && hasContext && (
          <Badge variant="secondary" className="text-xs h-fit whitespace-nowrap">
            <Lightbulb className="h-3 w-3 mr-1" />
            Σχετικό
          </Badge>
        )}
      </div>

      {/* Auto-Population Indicator - Compact */}
      {autoPopulate && autoPopulate.confidence === 'high' && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
            <span className="text-blue-800 font-medium">
              {autoPopulate.reason === 'context_match' 
                ? 'Συμπληρώθηκε βάσει παρόμοιων εγγράφων'
                : 'Συμπληρώθηκε βάσει της συνήθειας σας'}
            </span>
          </div>
        </div>
      )}

      {/* Side-by-Side Layout: Suggestions (Left) + Input Fields (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Suggested fields - Left side */}
        {displayedSuggestions.length > 0 && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded p-2 h-fit md:max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between gap-2 mb-2 sticky top-0 bg-gradient-to-r from-purple-50 to-indigo-50 pb-1 z-10">
              <div className="flex items-center gap-2 min-w-0">
                <Star className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-purple-800 truncate">
                  {contextSuggestions.length > 0 ? "Για αυτό το έργο:" : "Προτάσεις"}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-purple-700 hover:bg-purple-100 border-purple-300 h-7 text-xs px-2 flex-shrink-0"
                onClick={applyContextSuggestions}
              >
                Όλες
              </Button>
            </div>
            <div className="space-y-1">
              {displayedSuggestions.map((suggestion: EsdianSuggestion, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-white rounded p-1.5 text-xs border border-purple-100 hover:border-purple-300 transition-colors group"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <Badge variant="outline" className="text-xs max-w-[140px] truncate flex-shrink-0 text-purple-700 border-purple-200">
                      {suggestion.value}
                    </Badge>
                    <Badge variant="secondary" className={`text-xs h-fit whitespace-nowrap flex-shrink-0 border text-[10px] py-0.5 ${getSuggestionBadgeColor(suggestion)}`}>
                      {getSuggestionBadgeLabel(suggestion)}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-purple-700 hover:bg-purple-100 h-6 w-6 p-0 flex-shrink-0 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => applySuggestionToNext(suggestion.value)}
                    data-testid={`button-suggestion-apply-${index}`}
                    title="Προσθήκη στα πεδία"
                  >
                    +
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic ESDIAN Input Fields - Right side */}
        <div className="space-y-1.5">
          {esdianFields.length === 0 && displayedSuggestions.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              Προαιρετικά. Προσθέστε μόνο εάν χρειάζεται.
            </p>
          )}
          {esdianFields.map((field: string, index: number) => (
            <div key={index} className="flex items-end gap-1">
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name={`esdian_fields.${index}`}
                  render={({ field }) => (
                    <FormItem className="pb-1">
                      <FormLabel className="text-xs font-medium">Διανομή {index + 1}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Τμήμα/Μονάδα" 
                          className="h-8 text-xs"
                          data-testid={`input-esdian-field-${index + 1}`}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 text-red-600 hover:bg-red-50 hover:border-red-300 flex-shrink-0"
                onClick={() => removeEsdianField(index)}
                data-testid={`button-remove-esdian-field-${index + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-8 text-blue-600 hover:bg-blue-50 hover:border-blue-300 text-xs"
            onClick={addEsdianField}
            data-testid="button-add-esdian-field"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Προσθήκη
          </Button>
        </div>
      </div>
    </div>
  );
}
