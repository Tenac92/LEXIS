import { forwardRef, useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { parseEuropeanNumber } from "@/lib/number-format";
import { cn } from "@/lib/utils";

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value?: string | number;
  onChange?: (value: string, numericValue: number) => void;
  decimals?: number;
  allowNegative?: boolean;
}

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, decimals = 2, allowNegative = false, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initialize display value when value prop changes
    useEffect(() => {
      if (!isFocused) {
        const val = value;
        if (val === undefined || val === null || val === '' || val === 0) {
          setDisplayValue('');
        } else {
          // Convert numeric value to European format when not focused
          const numValue = typeof val === 'number' ? val : parseEuropeanNumber(String(val));
          if (!isNaN(numValue) && numValue !== 0) {
            setDisplayValue(formatForDisplay(numValue));
          } else {
            setDisplayValue('');
          }
        }
      }
    }, [value, isFocused]);

    // Format number for display (European format)
    const formatForDisplay = (num: number): string => {
      return num.toLocaleString('el-GR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
      });
    };

    // Clean input value - allow only digits and comma for decimals
    const cleanInput = (input: string): string => {
      // Remove everything except digits and comma
      let cleaned = input.replace(/[^\d,-]/g, '');
      
      // Handle negative sign
      if (!allowNegative) {
        cleaned = cleaned.replace(/-/g, '');
      } else if (cleaned.indexOf('-') > 0) {
        cleaned = cleaned.replace(/-/g, '');
      }
      
      // Remove any existing dots from input since we'll add them as formatters
      cleaned = cleaned.replace(/\./g, '');
      
      return cleaned;
    };

    // Validate decimal input
    const validateDecimalInput = (input: string): boolean => {
      // Allow empty input
      if (!input) return true;
      
      // Count commas (decimal separators)
      const commaCount = (input.match(/,/g) || []).length;
      if (commaCount > 1) return false;
      
      // Check decimal places
      const commaIndex = input.indexOf(',');
      if (commaIndex !== -1) {
        const decimalPart = input.substring(commaIndex + 1);
        if (decimalPart.length > decimals) return false;
      }
      
      return true;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const cleanedValue = cleanInput(rawValue);
      
      // Validate the input
      if (!validateDecimalInput(cleanedValue)) {
        return; // Don't update if invalid
      }
      
      // For live formatting, we need to be careful with cursor position
      // Only format if we're not in the middle of typing
      let displayVal = cleanedValue;
      
      // Add thousand separators only if the input doesn't end with comma
      // This prevents formatting interference while typing decimals
      if (!cleanedValue.endsWith(',')) {
        const parts = cleanedValue.split(',');
        let integerPart = parts[0] || '';
        const decimalPart = parts[1];
        
        // Add dots as thousand separators to integer part
        if (integerPart.length > 3) {
          integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }
        
        // Combine parts
        displayVal = decimalPart !== undefined ? `${integerPart},${decimalPart}` : integerPart;
      }
      
      setDisplayValue(displayVal);
      
      // Parse numeric value for callback (use cleaned value without dots)
      const numericValue = parseEuropeanNumber(cleanedValue);
      
      // Call onChange with display value and numeric value
      onChange?.(displayVal, numericValue);
    };

    const handleFocus = () => {
      setIsFocused(true);
      // Convert to raw input format when focusing
      if (displayValue && !displayValue.includes(',') && !displayValue.includes('.')) {
        // If it's a formatted number, convert back to editable format
        const numValue = parseEuropeanNumber(displayValue);
        if (!isNaN(numValue) && numValue !== 0) {
          const editableFormat = String(numValue).replace('.', ',');
          setDisplayValue(editableFormat);
        }
      }
    };

    const handleBlur = () => {
      setIsFocused(false);
      // Format for display when losing focus
      if (displayValue) {
        const numValue = parseEuropeanNumber(displayValue);
        if (!isNaN(numValue) && numValue !== 0) {
          setDisplayValue(formatForDisplay(numValue));
        } else if (numValue === 0) {
          setDisplayValue('');
        }
      }
    };

    return (
      <Input
        {...props}
        ref={ref || inputRef}
        type="text"
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(className)}
        inputMode="decimal"
        autoComplete="off"
      />
    );
  }
);

NumberInput.displayName = "NumberInput";

export { NumberInput };