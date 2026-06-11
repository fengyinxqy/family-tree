"use client";

import { useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
}

export function DatePicker({ value, onChange, placeholder = "选择日期" }: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const date = value ? (() => {
    const d = value.length === 7 ? parseISO(value + "-01") : parseISO(value);
    return isValid(d) ? d : undefined;
  })() : undefined;

  const handleSelect = (d: Date | undefined) => {
    if (d) {
      onChange(format(d, "yyyy-MM-dd"));
    }
    setOpen(false);
  };

  const displayText = value || "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground",
          !value && "text-muted-foreground",
        )}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        {value ? (
          <span>{displayText}</span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        {value && (
          <X
            className="ml-auto h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              e.preventDefault();
              onChange(null);
            }}
          />
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          locale={zhCN}
        />
      </PopoverContent>
    </Popover>
  );
}
