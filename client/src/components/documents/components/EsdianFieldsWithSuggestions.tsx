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

      {/* Suggested fields (purple) */}
      {displayedSuggestions.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-800">
                {contextSuggestions.length > 0 ? "Για αυτό το έργο συνήθως:" : "Προτεινόμενα πεδία"}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-purple-700 hover:bg-purple-100 border-purple-200"
              onClick={applyContextSuggestions}
            >
              Συμπλήρωση όλων
            </Button>
          </div>
          <div className="space-y-2">
            {displayedSuggestions.map((suggestion: EsdianSuggestion, index: number) => (
              <div
                key={index}
                className="flex items-center justify-between bg-white rounded p-2 text-sm border border-purple-100"
              >
                <div className="flex items-center gap-2 truncate">
                  <Badge variant="secondary" className="text-xs max-w-[240px] truncate">
                    {suggestion.value}
                  </Badge>
                  {suggestion.contextMatches > 0 && <span className="text-green-600 text-xs">✨</span>}
                  {suggestion.frequency > 2 && <span className="text-orange-500 text-xs">🔥</span>}
                  {suggestion.source === "user" && <span className="text-blue-600 text-xs">👤</span>}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-purple-700 hover:bg-purple-50"
                  onClick={() => applySuggestionToNext(suggestion.value)}
                  data-testid={`button-suggestion-apply-${index}`}
                >
                  Εισαγωγή
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Dynamic ESDIAN Input Fields */}
      <div className="space-y-4">
        {esdianFields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Τα πεδία εσωτερικής διανομής είναι προαιρετικά. Προσθέστε νέο μόνο αν χρειάζεται.
          </p>
        )}
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
