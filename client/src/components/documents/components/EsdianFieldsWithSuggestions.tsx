import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Star, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

// ESDIAN suggestion types
interface EsdianSuggestion {
  value: string;
  count: number;
  contextMatches: number;
}

interface EsdianSuggestionsResponse {
  status: string;
  suggestions: EsdianSuggestion[];
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
      if (!user?.id) return { status: 'error', suggestions: [], total: 0, hasContext: false };
      
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
      const newFields = currentFields.filter((_, i) => i !== index);
      form.setValue("esdian_fields", newFields);
    }
  };

  const applyContextSuggestions = () => {
    const contextSuggestions = suggestions.filter(s => s.contextMatches > 0);
    if (contextSuggestions.length > 0) {
      const newFields = contextSuggestions.slice(0, Math.min(contextSuggestions.length, 5)).map(s => s.value);
      form.setValue("esdian_fields", newFields);
    }
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

      {/* Smart Suggestions */}
      {suggestions.filter(s => s.contextMatches > 0).length > 0 && (
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
              .filter(s => s.contextMatches > 0)
              .slice(0, 5)
              .map((suggestion, index) => (
                <div key={index} className="flex items-center justify-between bg-white rounded p-2 text-xs">
                  <span className="text-gray-700 truncate flex-1 mr-2">{suggestion.value}</span>
                  <div className="flex gap-1">
                    {esdianFields.map((_, fieldIndex) => (
                      <Button
                        key={fieldIndex}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-green-600 hover:bg-green-100"
                        onClick={() => handleSuggestionClick(suggestion.value, fieldIndex)}
                        title={`Πεδίο ${fieldIndex + 1}`}
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