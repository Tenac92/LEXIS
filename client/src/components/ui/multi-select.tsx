import { useState } from "react";
import { XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl } from "@/components/ui/form";

interface Option {
  id: string;
  name: string;
}

interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}

export function MultiSelect({
  options,
  value = [],
  onChange,
  placeholder = "Select...",
  addLabel = "Add item"
}: MultiSelectProps) {
  // Only show options that haven't been selected yet
  const availableOptions = options.filter(option => !value.includes(option.id));

  return (
    <div className="space-y-2">
      {/* Display selected values as badges */}
      <div className="flex flex-wrap gap-2">
        {value.map((selectedId) => {
          const option = options.find(opt => opt.id === selectedId);
          return option ? (
            <Badge 
              key={option.id} 
              className="flex items-center gap-1"
              variant="outline"
            >
              {option.name}
              <button 
                type="button"
                className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={() => {
                  const newValue = value.filter(id => id !== option.id);
                  onChange(newValue);
                }}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </Badge>
          ) : null;
        })}
      </div>
      
      {/* Dropdown to add new options */}
      <Select
        onValueChange={(selectedId) => {
          if (!value.includes(selectedId)) {
            onChange([...value, selectedId]);
          }
        }}
        value=""
      >
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder={value.length > 0 ? addLabel : placeholder} />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {availableOptions.length > 0 ? (
            availableOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))
          ) : (
            <div className="p-2 text-center text-muted-foreground">
              All options have been selected
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}