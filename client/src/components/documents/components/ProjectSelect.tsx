import React, { useState, useEffect, useMemo, useCallback, forwardRef, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { useDebounce } from "../hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Project interface
interface Project {
  id: number; // Numeric project_id from database
  mis?: string;
  na853?: string; // NA853 enumeration code
  name: string;
  expenditure_types: string[];
}

interface ProjectSelectProps {
  selectedUnit: string;
  onProjectSelect: (project: Project | null) => void;
  value?: string;
  placeholder?: string;
}

export const ProjectSelect = forwardRef<HTMLDivElement, ProjectSelectProps>(
  function ProjectSelect({ selectedUnit, onProjectSelect, value, placeholder }, ref) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const { toast } = useToast();
    const prevSelectedUnitRef = useRef<string>("");

    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // Reset search when unit actually changes (not when function reference changes)
    useEffect(() => {
      if (prevSelectedUnitRef.current !== selectedUnit) {
        console.log("[ProjectSelect] Unit changed from", prevSelectedUnitRef.current, "to", selectedUnit);
        setSearchQuery("");
        // Only clear selection if unit actually changed and we're not just initializing
        if (prevSelectedUnitRef.current !== "" || !selectedUnit) {
          onProjectSelect(null);
        }
        prevSelectedUnitRef.current = selectedUnit;
      }
    }, [selectedUnit]);

    const normalizeText = useCallback((text: string) => {
      return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/gi, "");
    }, []);

    const extractNA853Info = useCallback((name: string) => {
      const na853Match = name.match(/ΝΑ853[:\s]*([^,\s]+)/i);
      const yearMatch = name.match(/20\d{2}/);
      const budgetMatch = name.match(/([\d.,]+)\s*€?/);
      
      return {
        na853: na853Match?.[1] || "",
        year: yearMatch?.[0] || "",
        budget: budgetMatch?.[1] || "",
      };
    }, []);

    // Fetch projects query
    const { data: projects = [], isLoading, error } = useQuery({
      queryKey: ['projects-working', selectedUnit],
      queryFn: async (): Promise<Project[]> => {
        if (!selectedUnit) {
          console.log("[ProjectSelect] No selectedUnit, returning empty array");
          return [];
        }
        
        console.log("[ProjectSelect] Fetching projects for unit:", selectedUnit);
        const url = `/api/projects-working/${encodeURIComponent(selectedUnit)}?t=${Date.now()}`;
        const response = await apiRequest(url);
        console.log("[ProjectSelect] API response:", response);
        
        if (!Array.isArray(response)) {
          console.error("[ProjectSelect] Invalid response format:", response);
          throw new Error('Invalid response format');
        }

        const validProjects = response.filter((item: any) => 
          item && typeof item === 'object' && item.mis
        );
        console.log("[ProjectSelect] Valid projects filtered:", validProjects.length);

        return validProjects.map((item: any): Project => {
          // Process expenditure types - handle both legacy and optimized schema
          let expenditureTypes: string[] = [];
          
          if (item.expenditure_types && Array.isArray(item.expenditure_types)) {
            expenditureTypes = item.expenditure_types;
          } else if (item.expenditure_type) {
            try {
              if (typeof item.expenditure_type === "string") {
                expenditureTypes = JSON.parse(item.expenditure_type);
              } else if (Array.isArray(item.expenditure_type)) {
                expenditureTypes = item.expenditure_type;
              }
            } catch (e) {
              expenditureTypes = [];
            }
          }

          const name = item.project_title || item.event_description || `Project ${item.mis}`;

          return {
            id: item.id, // Use the numeric project_id from database
            mis: String(item.mis),
            na853: String(item.na853 || ''), // Include NA853 enumeration code
            name,
            expenditure_types: expenditureTypes || [],
          };
        });
      },
      enabled: Boolean(selectedUnit),
      staleTime: 5 * 60 * 1000,
    });

    // Handle query errors
    useEffect(() => {
      if (error) {
        console.error("[ProjectSelect] Query error:", error);
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία φόρτωσης έργων. Παρακαλώ δοκιμάστε ξανά.",
          variant: "destructive",
        });
      }
    }, [error, toast]);

    // Add debug logging for state changes
    useEffect(() => {
      console.log("[ProjectSelect] State update - selectedUnit:", selectedUnit, "projects:", projects?.length, "isLoading:", isLoading, "isFocused:", isFocused);
    }, [selectedUnit, projects, isLoading, isFocused]);

    const selectedProject = useMemo(() => 
      projects?.find((p: Project) => p.id === Number(value)) || null,
      [projects, value]
    );

    const filteredProjects = useMemo(() => {
      if (!projects || projects.length === 0) return [];
      if (!debouncedSearchQuery.trim()) return projects.slice(0, 20);

      const normalizedQuery = normalizeText(debouncedSearchQuery);
      
      if (normalizedQuery.length < 2) return projects.slice(0, 20);

      setIsSearching(true);
      
      try {
        console.log("[ProjectSelect] Searching for:", debouncedSearchQuery, "normalized:", normalizedQuery);
        
        const results = projects.filter((project: Project) => {
          const normalizedName = normalizeText(project.name);
          const normalizedMis = normalizeText(String(project.mis) || "");
          const normalizedId = normalizeText(String(project.id));
          
          // Also check raw values without normalization for exact number matches
          const rawMisMatch = String(project.mis).includes(debouncedSearchQuery);
          const rawIdMatch = String(project.id).includes(debouncedSearchQuery);
          
          const matches = (
            normalizedName.includes(normalizedQuery) ||
            normalizedMis.includes(normalizedQuery) ||
            normalizedId.includes(normalizedQuery) ||
            rawMisMatch ||
            rawIdMatch
          );
          
          // Debug log for the specific project we're looking for
          if (String(project.mis) === "5222801") {
            console.log("[ProjectSelect] Found target project 5222801:", {
              project,
              normalizedQuery,
              normalizedName,
              normalizedMis,
              normalizedId,
              rawMisMatch,
              rawIdMatch,
              matches
            });
          }
          
          return matches;
        });

        console.log("[ProjectSelect] Search results count:", results.length, "showing first 50");
        console.log("[ProjectSelect] Results include 5222801:", results.some(p => String(p.mis) === "5222801"));
        return results.slice(0, 50);
      } catch (error) {
        return projects.slice(0, 20);
      } finally {
        setIsSearching(false);
      }
    }, [projects, debouncedSearchQuery, normalizeText]);

    const handleFocus = () => {
      console.log("[ProjectSelect] Focus activated, selectedUnit:", selectedUnit, "projects count:", projects?.length);
      setIsFocused(true);
    };

    const handleBlur = () => {
      console.log("[ProjectSelect] Blur triggered");
      setTimeout(() => setIsFocused(false), 500);
    };

    const handleProjectSelect = (project: Project) => {
      onProjectSelect(project);
      setSearchQuery("");
      setIsFocused(false);
    };

    if (!selectedUnit) {
      return (
        <div className="text-sm text-gray-500 p-3 border rounded-md bg-gray-50">
          Παρακαλώ επιλέξτε πρώτα μονάδα
        </div>
      );
    }

    return (
      <div ref={ref} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 z-10" />
          <Input
            type="text"
            placeholder={placeholder || "Αναζήτηση έργου (MIS, τίτλος, κωδικός)..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="pl-10"
            disabled={isLoading}
          />
        </div>

        {/* Selected Project Display */}
        {selectedProject && !isFocused && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-medium text-blue-900">
                  {selectedProject.name}
                </div>
                <div className="text-sm text-blue-600 mt-1">
                  ΝΑ853: {selectedProject.na853 || selectedProject.mis || 'N/A'} | ID: {selectedProject.id}
                </div>
                {selectedProject.expenditure_types?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedProject.expenditure_types.map((type, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search Results */}
        {isFocused && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-96 overflow-hidden">
            <Command className="rounded-lg border-none shadow-none" shouldFilter={false}>
              <div className="p-2">
                <CommandInput 
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  placeholder="Αναζήτηση έργου..."
                  className="border-none focus:ring-0"
                />
              </div>
              
              <div className="border-t">
                {isLoading ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Φόρτωση έργων...
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <CommandEmpty className="py-6 text-center text-sm">
                    Δεν βρέθηκαν έργα.
                  </CommandEmpty>
                ) : (
                  <CommandGroup className="max-h-[300px] overflow-y-auto">
                    {filteredProjects.map((project) => {
                      const na853Info = extractNA853Info(project.name);
                      
                      return (
                        <CommandItem
                          key={project.id}
                          value={String(project.id)}
                          onSelect={() => {
                            console.log("[ProjectSelect] Project selected:", project);
                            onProjectSelect(project);
                            setIsFocused(false);
                            setSearchQuery("");
                          }}
                          className="flex flex-col items-start p-3 cursor-pointer hover:bg-gray-50"
                        >
                          <div className="flex justify-between w-full items-start">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 line-clamp-2">
                                {project.name}
                              </div>
                              <div className="text-sm text-gray-500 mt-1">
                                ΝΑ853: {project.na853 || project.mis || 'N/A'} | ID: {project.id}
                              </div>
                              {project.expenditure_types?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {project.expenditure_types.slice(0, 3).map((type, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {type}
                                    </Badge>
                                  ))}
                                  {project.expenditure_types.length > 3 && (
                                    <span className="text-xs text-gray-400">
                                      +{project.expenditure_types.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </div>
            </Command>
          </div>
        )}
      </div>
    );
  }
);