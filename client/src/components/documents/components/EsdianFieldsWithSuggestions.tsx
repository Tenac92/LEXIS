import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Star } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

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

  const handleSuggestionClick = (value: string, fieldName: 'esdian_field1' | 'esdian_field2') => {
    form.setValue(fieldName, value);
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
              onClick={() => {
                const contextSuggestions = suggestions.filter(s => s.contextMatches > 0);
                if (contextSuggestions.length >= 2) {
                  form.setValue('esdian_field1', contextSuggestions[0].value);
                  form.setValue('esdian_field2', contextSuggestions[1].value);
                }
              }}
            >
              Αυτόματα
            </Button>
          </div>
          <div className="space-y-1">
            {suggestions
              .filter(s => s.contextMatches > 0)
              .slice(0, 3)
              .map((suggestion, index) => (
                <div key={index} className="flex items-center justify-between bg-white rounded p-2 text-xs">
                  <span className="text-gray-700 truncate flex-1 mr-2">{suggestion.value}</span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-green-600 hover:bg-green-100"
                      onClick={() => handleSuggestionClick(suggestion.value, 'esdian_field1')}
                      title="Πεδίο 1"
                    >
                      1
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-green-600 hover:bg-green-100"
                      onClick={() => handleSuggestionClick(suggestion.value, 'esdian_field2')}
                      title="Πεδίο 2"
                    >
                      2
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ESDIAN Input Fields */}
      <div className="space-y-4">
        <FormField
          control={form.control}
          name="esdian_field1"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Εσωτερική Διανομή 1</FormLabel>
              <FormControl>
                <Input {...field} placeholder="π.χ. ΤΜΗΜΑ ΔΙΑΧΕΙΡΙΣΗΣ ΚΡΙΣΕΩΝ" />
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
              <FormLabel>Εσωτερική Διανομή 2</FormLabel>
              <FormControl>
                <Input {...field} placeholder="π.χ. ΓΡΑΦΕΙΟ ΥΠΟΥΡΓΟΥ" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}