import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { formatNumberWhileTyping, parseEuropeanNumber } from "@/lib/number-format";
import { cn } from "@/lib/utils";

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value?: string | number;
  onChange?: (value: string, numericValue: number) => void;
  decimals?: number;
  allowNegative?: boolean;
}

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, decimals = 2, allowNegative = false, ...props }, ref) => {

    // Convert numeric value to formatted string
    const getDisplayValue = (val: string | number | undefined): string => {
      if (val === undefined || val === null || val === '') return '';
      
      const strVal = String(val);
      if (strVal === '0' || strVal === '0.00' || strVal === '0,00') return '';
      
      return formatNumberWhileTyping(strVal, decimals);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      
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

    const displayValue = getDisplayValue(value);

    return (
      <Input
        {...props}
        ref={ref}
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