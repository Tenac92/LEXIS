import { forwardRef, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { formatNumberWhileTyping, getCursorPositionAfterFormatting, parseEuropeanNumber } from "@/lib/number-format";
import { cn } from "@/lib/utils";

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value?: string | number;
  onChange?: (value: string, numericValue: number) => void;
  decimals?: number;
  allowNegative?: boolean;
}

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, decimals = 2, allowNegative = false, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const cursorPositionRef = useRef<number>(0);

    // Convert numeric value to formatted string
    const getDisplayValue = (val: string | number | undefined): string => {
      if (val === undefined || val === null || val === '') return '';
      
      const strVal = String(val);
      if (strVal === '0') return '';
      
      return formatNumberWhileTyping(strVal, decimals);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const newValue = input.value;
      const cursorPosition = input.selectionStart || 0;
      
      // Store cursor position
      if (cursorPositionRef.current !== null) {
        cursorPositionRef.current = cursorPosition;
      }
      
      // Handle negative sign
      let processedValue = newValue;
      const isNegative = processedValue.startsWith('-');
      if (isNegative && allowNegative) {
        processedValue = processedValue.substring(1);
      } else if (isNegative && !allowNegative) {
        processedValue = processedValue.substring(1);
      }
      
      // Format the value
      const formattedValue = formatNumberWhileTyping(processedValue, decimals);
      const finalValue = (isNegative && allowNegative) ? '-' + formattedValue : formattedValue;
      
      // Parse numeric value for callback
      const numericValue = parseEuropeanNumber(finalValue);
      
      // Call onChange with both formatted string and numeric value
      onChange?.(finalValue, numericValue);
    };

    // Restore cursor position after formatting
    useEffect(() => {
      if (inputRef.current && cursorPositionRef.current !== null) {
        const input = inputRef.current;
        const currentValue = input.value;
        
        // Calculate new cursor position
        const newCursorPos = getCursorPositionAfterFormatting(
          '', // We don't have the original value here, but the function handles it
          currentValue,
          cursorPositionRef.current
        );
        
        // Set cursor position
        input.setSelectionRange(newCursorPos, newCursorPos);
      }
    });

    const displayValue = getDisplayValue(value);

    return (
      <Input
        {...props}
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        type="text"
        value={displayValue}
        onChange={handleInputChange}
        className={cn(className)}
        inputMode="decimal"
        autoComplete="off"
      />
    );
  }
);

NumberInput.displayName = "NumberInput";

export { NumberInput };