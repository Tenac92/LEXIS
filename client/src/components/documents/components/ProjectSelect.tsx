import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  forwardRef,
  useRef,
  useImperativeHandle,
  useLayoutEffect,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Utility: Find the actual scrollable container (respects overflow:auto/scroll)
const getScrollableParent = (node: HTMLElement | null): HTMLElement | null => {
  if (!node) return null;
  const regex = /(auto|scroll)/;
  let current: HTMLElement | null = node;
  while (current && current !== document.body) {
    const { overflowY } = window.getComputedStyle(current);
    if (regex.test(overflowY)) return current;
    current = current.parentElement;
  }
  return null;
};

// Utility: Center element in scrollable container
interface CenterParams {
  containerEl: HTMLElement;
  targetEl: HTMLElement;
  offsetRatio?: number; // 0.4 = 40% down container (slightly above center)
  dropdownMaxHeight?: number;
  behavior?: ScrollBehavior;
}

const centerElementInScrollContainer = ({
  containerEl,
  targetEl,
  offsetRatio = 0.4,
  dropdownMaxHeight = 350,
  behavior = "smooth",
}: CenterParams): void => {
  const containerRect = containerEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  
  // Calculate target scroll position: place trigger at offsetRatio of container height
  const targetScrollTop =
    containerEl.scrollTop +
    (targetRect.top - containerRect.top) -
    (containerEl.clientHeight * offsetRatio);

  // Ensure dropdown has vertical space below trigger (approximate)
  const targetBottomInContainer =
    containerEl.scrollTop +
    (targetRect.bottom - containerRect.top) +
    dropdownMaxHeight;
  const containerBottomEdge = containerEl.scrollTop + containerEl.clientHeight;

  // If dropdown would extend past container bottom, adjust scroll up slightly
  let finalScrollTop = Math.max(0, targetScrollTop);
  if (targetBottomInContainer > containerBottomEdge) {
    finalScrollTop = Math.min(
      finalScrollTop,
      targetBottomInContainer - containerEl.clientHeight + 16
    );
  }

  // Clamp within valid bounds
  finalScrollTop = Math.max(
    0,
    Math.min(finalScrollTop, containerEl.scrollHeight - containerEl.clientHeight)
  );

  containerEl.scrollTo({ top: finalScrollTop, behavior });
};

// Project interface
interface Project {
  id: number; // Numeric project_id from database
  mis?: string;
  na853?: string; // NA853 enumeration code
  name: string;
  event_description?: string; // Preserve original event_description for other components
  expenditure_types: string[];
}

interface ProjectSelectProps {
  selectedUnit: string;
  onProjectSelect: (project: Project | null) => void;
  value?: string;
  placeholder?: string;
}

export interface ProjectSelectHandle {
  focusInput: () => void;
  getInputElement: () => HTMLInputElement | null;
  scrollIntoView: (options?: ScrollIntoViewOptions) => void;
}

export const ProjectSelect = forwardRef<ProjectSelectHandle, ProjectSelectProps>(
  function ProjectSelect(
    { selectedUnit, onProjectSelect, value, placeholder },
    ref,
  ) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number>(-1);
    const [listScrollTop, setListScrollTop] = useState(0);
    const { toast } = useToast();
    const prevSelectedUnitRef = useRef<string>("");
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
    const scrollableParentRef = useRef<HTMLElement | null>(null);
    const isClickingDropdownRef = useRef(false);
    const dropdownOpenTimerRef = useRef<NodeJS.Timeout | null>(null);

    const ensureTriggerInView = () => {
      const trigger = inputRef.current;
      if (!trigger) return;
      const scrollable = scrollableParentRef.current || getScrollableParent(trigger.parentElement as HTMLElement);
      scrollableParentRef.current = scrollable;
      if (!scrollable) return;
      const triggerRect = trigger.getBoundingClientRect();
      const parentRect = scrollable.getBoundingClientRect();
      const isOutOfView = triggerRect.top < parentRect.top || triggerRect.bottom > parentRect.bottom;
      if (isOutOfView) {
        trigger.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    };

    const scrollActiveItemIntoView = (index: number) => {
      const listEl = listRef.current;
      const itemEl = itemRefs.current[index];
      if (!listEl || !itemEl) return;
      itemEl.scrollIntoView({ block: "nearest" });
    };

    // Reset search when unit actually changes (not when function reference changes)
    useEffect(() => {
      if (prevSelectedUnitRef.current !== selectedUnit) {
        setSearchQuery("");
        // Only clear selection if unit actually changed and we're not just initializing
        if (prevSelectedUnitRef.current !== "" || !selectedUnit) {
          onProjectSelect(null);
        }
        prevSelectedUnitRef.current = selectedUnit;
        setIsFocused(false);
      }
    }, [selectedUnit, onProjectSelect]);

    const normalizeText = useCallback((text: string) => {
      return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/gi, "");
    }, []);

    // Fetch projects query
    const {
      data: projects = [],
      isLoading,
      error,
    } = useQuery({
      queryKey: ["projects-working", selectedUnit],
      queryFn: async (): Promise<Project[]> => {
        if (!selectedUnit) {
          return [];
        }

        const url = `/api/projects-working/${encodeURIComponent(selectedUnit)}?t=${Date.now()}`;
        const response = await apiRequest(url);

        if (!Array.isArray(response)) {
          throw new Error("Invalid response format");
        }

        const validProjects = response.filter(
          (item: any) => item && typeof item === "object" && item.mis,
        );

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

          const name =
            item.event_description ||
            item.project_title ||
            `Project ${item.mis}`;

          return {
            id: item.id, // Use the numeric project_id from database
            mis: String(item.mis),
            na853: String(item.na853 || ""), // Use NA853 code directly from database
            name,
            event_description: item.event_description || "", // Preserve original for other components
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
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία φόρτωσης έργων. Παρακαλώ δοκιμάστε ξανά.",
          variant: "destructive",
        });
      }
    }, [error, toast]);

    const selectedProject = useMemo(
      () => projects?.find((p: Project) => p.id === Number(value)) || null,
      [projects, value],
    );

    const filteredProjects = useMemo(() => {
      if (!projects || projects.length === 0) return [];
      if (!searchQuery.trim()) return projects.slice(0, 50);

      const normalizedQuery = normalizeText(searchQuery);

      if (normalizedQuery.length < 1) return projects.slice(0, 50);

      const results = projects.filter((project: Project) => {
        const normalizedName = normalizeText(project.name);
        const normalizedNA853 = normalizeText(String(project.na853) || "");

        // Raw exact matches for NA853 code
        const rawNA853Match = String(project.na853).includes(searchQuery);

        // Normalized substring matches
        const nameMatch = normalizedName.includes(normalizedQuery);
        const na853Match = normalizedNA853.includes(normalizedQuery);

        // Word-based matching: split by whitespace and match any word
        const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
        const nameWords = normalizedName.split(/\s+/).filter(w => w.length > 0);
        const wordMatch = queryWords.some(queryWord =>
          nameWords.some(nameWord => nameWord.includes(queryWord))
        );

        return rawNA853Match || nameMatch || na853Match || wordMatch;
      });

      return results.slice(0, 50);
    }, [projects, searchQuery, normalizeText]);

    useLayoutEffect(() => {
      if (isFocused) {
        ensureTriggerInView();
        if (listRef.current && listScrollTop && filteredProjects.length > 0) {
          listRef.current.scrollTop = listScrollTop;
        }
      }
    }, [isFocused, filteredProjects.length, listScrollTop]);

    // When dropdown opens, center the trigger in the modal scroll container
    useEffect(() => {
      if (!isFocused) {
        if (dropdownOpenTimerRef.current) {
          clearTimeout(dropdownOpenTimerRef.current);
        }
        return;
      }

      // Defer scroll until after dropdown renders
      dropdownOpenTimerRef.current = setTimeout(() => {
        const trigger = inputRef.current;
        const container = containerRef.current;
        if (!trigger || !container) return;

        // Find the modal scroll container (typically parent of the ProjectSelect container)
        const modalScroll = getScrollableParent(container);
        if (!modalScroll || modalScroll === document.body) {
          // Not in a modal or at document root—skip modal-specific scrolling
          return;
        }

        // Center the trigger in the modal's scroll container
        centerElementInScrollContainer({
          containerEl: modalScroll,
          targetEl: trigger,
          offsetRatio: 0.35,
          dropdownMaxHeight: 350,
          behavior: "smooth",
        });

        // Focus input with scroll prevention to avoid jump
        const inputEl = inputRef.current;
        if (inputEl && "focus" in inputEl) {
          try {
            inputEl.focus({ preventScroll: true });
          } catch {
            // Older browsers don't support preventScroll option
            inputEl.focus();
          }
        }
      }, 0);

      return () => {
        if (dropdownOpenTimerRef.current) {
          clearTimeout(dropdownOpenTimerRef.current);
        }
      };
    }, [isFocused]);

    useEffect(() => {
      if (!isFocused) {
        setActiveIndex(-1);
        return;
      }
      setActiveIndex(filteredProjects.length > 0 ? 0 : -1);
      if (filteredProjects.length > 0) {
        requestAnimationFrame(() => scrollActiveItemIntoView(0));
      }
    }, [filteredProjects, isFocused]);

    const focusInput = () => {
      setIsFocused(true);
      // Let the dropdown-open effect handle centering and focus
    };

    useImperativeHandle(ref, () => ({
      focusInput,
      getInputElement: () => inputRef.current,
      scrollIntoView: (options) => {
        const target = inputRef.current || containerRef.current;
        if (!target) return;
        target.scrollIntoView(
          options || { behavior: "smooth", block: "center", inline: "nearest" },
        );
      },
    }));

    const handleFocus = () => {
      focusInput();
    };

    const handleDropdownMouseDown = () => {
      isClickingDropdownRef.current = true;
    };

    const handleBlur = () => {
      if (isClickingDropdownRef.current) {
        isClickingDropdownRef.current = false;
        return;
      }
      setTimeout(() => setIsFocused(false), 150);
    };

    const handleClearSelection = (e: React.MouseEvent) => {
      e.stopPropagation();
      onProjectSelect(null);
      setSearchQuery("");
      setIsFocused(true);
      inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isFocused && (e.key === "ArrowDown" || e.key === "Enter")) {
        setIsFocused(true);
        return;
      }
      if (e.key === "Escape") {
        setIsFocused(false);
        setSearchQuery("");
        inputRef.current?.focus();
        return;
      }
      if (!isFocused) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (filteredProjects.length === 0) return;
        const next = activeIndex < filteredProjects.length - 1 ? activeIndex + 1 : 0;
        setActiveIndex(next);
        scrollActiveItemIntoView(next);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (filteredProjects.length === 0) return;
        const prev = activeIndex > 0 ? activeIndex - 1 : filteredProjects.length - 1;
        setActiveIndex(prev);
        scrollActiveItemIntoView(prev);
      }
      if (e.key === "Enter" && activeIndex >= 0 && activeIndex < filteredProjects.length) {
        e.preventDefault();
        const selected = filteredProjects[activeIndex];
        onProjectSelect(selected);
        setSearchQuery("");
        setIsFocused(false);
        inputRef.current?.focus();
      }
      if (listRef.current) {
        setListScrollTop(listRef.current.scrollTop);
      }
    };

    if (!selectedUnit) {
      return (
        <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/20">
          Παρακαλώ επιλέξτε πρώτα μονάδα υπηρεσίας
        </div>
      );
    }

    return (
      <div ref={containerRef} className="relative w-full">
        {/* Selected Project Display */}
        {selectedProject && !isFocused && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-blue-900 flex items-baseline gap-2">
                <span className="font-mono text-sm bg-blue-100 px-2 py-1 rounded">
                  {selectedProject.na853 || selectedProject.mis || "N/A"}
                </span>
                <span className="truncate">{selectedProject.name}</span>
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
              {selectedProject.mis && (
                <div className="text-xs text-blue-600 mt-2">
                  MIS: {selectedProject.mis}
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
              className="ml-2 flex-shrink-0 h-8 w-8 p-0"
              title="Αλλαγή έργου"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Search Input */}
        {!selectedProject || isFocused ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
            <Input
              ref={inputRef}
              type="text"
              placeholder={
                placeholder || "Αναζήτηση (ΝΑ853, τίτλος)..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="pl-10 pr-10"
              disabled={isLoading}
              autoComplete="off"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-muted-foreground border-t-foreground" />
              </div>
            )}
          </div>
        ) : null}

        {/* Results Dropdown */}
        {isFocused && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg"
            onMouseDown={handleDropdownMouseDown}
          >
            <Command className="rounded-none border-none shadow-none">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-muted-foreground border-t-foreground" />
                  Φόρτωση έργων...
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {searchQuery.trim()
                    ? "Δεν βρέθηκαν έργα με αυτά τα κριτήρια"
                    : "Δεν υπάρχουν διαθέσιμα έργα"}
                </div>
              ) : (
                <CommandGroup
                  ref={listRef}
                  className="max-h-[350px] overflow-y-auto"
                  style={{ maxHeight: "min(350px, calc(80vh - 200px))" }}
                  onScroll={(e) => setListScrollTop((e.target as HTMLDivElement).scrollTop)}
                >
                  {filteredProjects.map((project, idx) => (
                    <CommandItem
                      key={project.id}
                      value={String(project.id)}
                      onSelect={(value) => {
                        const selected = filteredProjects.find(p => String(p.id) === value);
                        if (selected) {
                          onProjectSelect(selected);
                          setSearchQuery("");
                          setIsFocused(false);
                        }
                      }}
                      className={
                        "flex flex-col items-start p-3 cursor-pointer hover:bg-muted/50 border-b last:border-b-0" +
                        (activeIndex === idx ? " bg-muted/50" : "")
                      }
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                    >
                      <div className="w-full">
                        {/* NA853 + Title on first line */}
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-mono font-semibold text-sm bg-gray-100 px-2 py-1 rounded flex-shrink-0">
                            {project.na853 || project.mis || "N/A"}
                          </span>
                          <span className="text-sm font-medium truncate">
                            {project.name}
                          </span>
                        </div>

                        {/* Secondary info: expenditure types */}
                        {project.expenditure_types?.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <div className="flex gap-1 flex-wrap">
                              {project.expenditure_types
                                .slice(0, 2)
                                .map((type, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {type}
                                  </Badge>
                                ))}
                              {project.expenditure_types.length > 2 && (
                                <span className="text-xs text-muted-foreground">
                                  +{project.expenditure_types.length - 2}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {project.mis && (
                          <div className="text-xs text-muted-foreground mt-1">
                            MIS: {project.mis}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </Command>
          </div>
        )}
      </div>
    );
  },
);

ProjectSelect.displayName = "ProjectSelect";
