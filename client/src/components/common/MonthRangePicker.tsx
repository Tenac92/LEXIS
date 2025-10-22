import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GREEK_MONTHS } from "@/components/documents/constants";

interface MonthRangePickerProps {
  value: string;
  onChange: (value: string) => void;
  testIdPrefix?: string;
}

export function MonthRangePicker({ value, onChange, testIdPrefix = "month-picker" }: MonthRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState("");
  const [startYear, setStartYear] = useState("");
  const [endMonth, setEndMonth] = useState("");
  const [endYear, setEndYear] = useState("");
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);

  // Get current month and year for validation
  const now = new Date();
  const currentMonth = GREEK_MONTHS[now.getMonth()];
  const currentYear = now.getFullYear();

  // Sync internal state when value prop changes (but not during active range selection)
  useEffect(() => {
    // Don't sync if we're in the middle of selecting a range
    if (isSelectingEnd) return;
    
    if (value) {
      if (value.includes(" - ")) {
        // Range format: "ΙΑΝΟΥΑΡΙΟΣ 2024 - ΜΑΡΤΙΟΣ 2024"
        const [start, end] = value.split(" - ");
        const startParts = start.trim().split(" ");
        const endParts = end.trim().split(" ");
        const sMonth = startParts[0] || "";
        const sYear = startParts[1] || new Date().getFullYear().toString();
        const eMonth = endParts[0] || "";
        const eYear = endParts[1] || new Date().getFullYear().toString();
        
        setStartMonth(sMonth);
        setStartYear(sYear);
        setEndMonth(eMonth);
        setEndYear(eYear);
        setDisplayYear(parseInt(sYear));
      } else if (value.includes(" ")) {
        // Single month format: "ΙΑΝΟΥΑΡΙΟΣ 2024"
        const parts = value.split(" ");
        const sMonth = parts[0] || "";
        const sYear = parts[1] || new Date().getFullYear().toString();
        
        setStartMonth(sMonth);
        setStartYear(sYear);
        setEndMonth(sMonth);
        setEndYear(sYear);
        setDisplayYear(parseInt(sYear));
      }
    } else {
      // Reset when value is empty
      setStartMonth("");
      setStartYear("");
      setEndMonth("");
      setEndYear("");
    }
  }, [value, isSelectingEnd]);

  // Check if a month is in the future
  const isMonthInFuture = (month: string, year: number) => {
    if (year > currentYear) return true;
    if (year === currentYear) {
      const monthIdx = GREEK_MONTHS.indexOf(month);
      const currentMonthIdx = GREEK_MONTHS.indexOf(currentMonth);
      return monthIdx > currentMonthIdx;
    }
    return false;
  };

  const handleMonthClick = (month: string) => {
    // Don't allow clicking on future months
    if (isMonthInFuture(month, displayYear)) {
      return;
    }

    if (!startMonth || (startMonth && endMonth && !isSelectingEnd)) {
      // Start new selection
      setStartMonth(month);
      setStartYear(displayYear.toString());
      setEndMonth("");
      setEndYear("");
      setIsSelectingEnd(true);
      onChange(`${month} ${displayYear}`);
    } else if (isSelectingEnd) {
      // Complete the range
      const sMonthIdx = GREEK_MONTHS.indexOf(startMonth);
      const eMonthIdx = GREEK_MONTHS.indexOf(month);
      const sYear = parseInt(startYear);
      const eYear = displayYear;

      // Ensure end is after start
      if (eYear > sYear || (eYear === sYear && eMonthIdx >= sMonthIdx)) {
        setEndMonth(month);
        setEndYear(displayYear.toString());
        setIsSelectingEnd(false);
        
        // Format output
        if (startMonth === month && startYear === displayYear.toString()) {
          onChange(`${month} ${displayYear}`);
        } else {
          onChange(`${startMonth} ${startYear} - ${month} ${displayYear}`);
        }
        
        // Close popover only after completing the range selection
        setTimeout(() => setOpen(false), 100);
      } else {
        // User clicked before start, make it the new start
        setStartMonth(month);
        setStartYear(displayYear.toString());
        setEndMonth("");
        setEndYear("");
        onChange(`${month} ${displayYear}`);
      }
    }
  };

  const isMonthInRange = (month: string) => {
    if (!startMonth) return false;
    
    const monthIdx = GREEK_MONTHS.indexOf(month);
    const sMonthIdx = GREEK_MONTHS.indexOf(startMonth);
    const eMonthIdx = endMonth ? GREEK_MONTHS.indexOf(endMonth) : -1;
    const sYear = parseInt(startYear);
    const eYear = endMonth ? parseInt(endYear) : -1;
    
    if (!endMonth) {
      // Only start selected
      return month === startMonth && displayYear === sYear;
    }
    
    // Check if current month/year is in range
    if (displayYear < sYear || displayYear > eYear) return false;
    if (displayYear > sYear && displayYear < eYear) return true;
    if (displayYear === sYear && displayYear === eYear) {
      return monthIdx >= sMonthIdx && monthIdx <= eMonthIdx;
    }
    if (displayYear === sYear) {
      return monthIdx >= sMonthIdx;
    }
    if (displayYear === eYear) {
      return monthIdx <= eMonthIdx;
    }
    
    return false;
  };

  const isStartMonth = (month: string) => {
    return month === startMonth && displayYear === parseInt(startYear);
  };

  const isEndMonth = (month: string) => {
    return endMonth && month === endMonth && displayYear === parseInt(endYear);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-left font-normal text-xs h-9 px-2"
          data-testid={`${testIdPrefix}-trigger`}
        >
          <Calendar className="mr-1.5 h-3.5 w-3.5" />
          <span className="truncate">{value || "Επιλέξτε περίοδο"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-3">
          {/* Year Navigation */}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDisplayYear(displayYear - 1)}
              className="h-8 w-8 p-0"
              data-testid={`${testIdPrefix}-prev-year`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-base font-semibold">{displayYear}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDisplayYear(displayYear + 1)}
              disabled={displayYear >= currentYear}
              className="h-8 w-8 p-0"
              data-testid={`${testIdPrefix}-next-year`}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-3 gap-2">
            {GREEK_MONTHS.map((month) => {
              const inRange = isMonthInRange(month);
              const isStart = isStartMonth(month);
              const isEnd = isEndMonth(month);
              const isFuture = isMonthInFuture(month, displayYear);
              
              return (
                <Button
                  key={month}
                  type="button"
                  variant={inRange ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleMonthClick(month)}
                  disabled={isFuture}
                  className={`h-10 text-xs px-2 ${
                    isStart || isEnd ? "ring-2 ring-blue-500 ring-offset-1" : ""
                  } ${isFuture ? "opacity-40 cursor-not-allowed" : ""}`}
                  data-testid={`${testIdPrefix}-month-${month}`}
                >
                  {month.slice(0, 3)}
                </Button>
              );
            })}
          </div>

          {/* Selected Range Display */}
          {startMonth && (
            <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
              <p className="text-xs text-blue-700 font-medium">
                {isSelectingEnd ? (
                  <>Επιλέξτε τέλος περιόδου</>
                ) : (
                  <>Επιλεγμένη περίοδος: {value}</>
                )}
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
