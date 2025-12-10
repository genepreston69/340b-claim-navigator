import * as React from "react";
import { CalendarIcon, X } from "lucide-react";
import { addDays, addMonths, format, startOfMonth, endOfMonth, startOfYear, subDays, subMonths } from "date-fns";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
  showPresets?: boolean;
  disabled?: boolean;
}

type PresetKey =
  | "last7days"
  | "last30days"
  | "last90days"
  | "thisMonth"
  | "lastMonth"
  | "last3months"
  | "last6months"
  | "thisYear"
  | "lastYear"
  | "ytd";

interface Preset {
  label: string;
  getValue: () => DateRange;
}

const presets: Record<PresetKey, Preset> = {
  last7days: {
    label: "Last 7 days",
    getValue: () => ({
      from: subDays(new Date(), 6),
      to: new Date(),
    }),
  },
  last30days: {
    label: "Last 30 days",
    getValue: () => ({
      from: subDays(new Date(), 29),
      to: new Date(),
    }),
  },
  last90days: {
    label: "Last 90 days",
    getValue: () => ({
      from: subDays(new Date(), 89),
      to: new Date(),
    }),
  },
  thisMonth: {
    label: "This month",
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: new Date(),
    }),
  },
  lastMonth: {
    label: "Last month",
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      };
    },
  },
  last3months: {
    label: "Last 3 months",
    getValue: () => ({
      from: startOfMonth(subMonths(new Date(), 2)),
      to: new Date(),
    }),
  },
  last6months: {
    label: "Last 6 months",
    getValue: () => ({
      from: startOfMonth(subMonths(new Date(), 5)),
      to: new Date(),
    }),
  },
  thisYear: {
    label: "This year",
    getValue: () => ({
      from: startOfYear(new Date()),
      to: new Date(),
    }),
  },
  lastYear: {
    label: "Last year",
    getValue: () => {
      const lastYear = subMonths(new Date(), 12);
      return {
        from: startOfYear(lastYear),
        to: new Date(lastYear.getFullYear(), 11, 31),
      };
    },
  },
  ytd: {
    label: "Year to date",
    getValue: () => ({
      from: startOfYear(new Date()),
      to: new Date(),
    }),
  },
};

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  className,
  align = "start",
  showPresets = true,
  disabled = false,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handlePresetSelect = (presetKey: string) => {
    const preset = presets[presetKey as PresetKey];
    if (preset) {
      onChange?.(preset.getValue());
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(undefined);
  };

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) return placeholder;
    if (!range.to) return format(range.from, "MMM d, yyyy");
    return `${format(range.from, "MMM d, yyyy")} - ${format(range.to, "MMM d, yyyy")}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className="flex-1 truncate">{formatDateRange(value)}</span>
          {value?.from && (
            <X
              className="ml-2 h-4 w-4 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <div className="flex">
          {showPresets && (
            <div className="border-r p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Quick Select
              </p>
              {Object.entries(presets).map(([key, preset]) => (
                <Button
                  key={key}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => {
                    handlePresetSelect(key);
                    setOpen(false);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          )}
          <div className="p-3">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={value?.from}
              selected={value}
              onSelect={(range) => {
                onChange?.(range);
                if (range?.from && range?.to) {
                  setOpen(false);
                }
              }}
              numberOfMonths={2}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Simple single preset selector for compact layouts
export function DateRangePresetSelect({
  value,
  onChange,
  className,
}: {
  value?: PresetKey;
  onChange?: (preset: PresetKey) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange?.(v as PresetKey)}>
      <SelectTrigger className={cn("w-[180px]", className)}>
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(presets).map(([key, preset]) => (
          <SelectItem key={key} value={key}>
            {preset.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Hook to manage date range state with URL sync
export function useDateRange(defaultPreset: PresetKey = "last30days") {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(
    presets[defaultPreset].getValue()
  );
  const [preset, setPreset] = React.useState<PresetKey | undefined>(defaultPreset);

  const handlePresetChange = React.useCallback((newPreset: PresetKey) => {
    setPreset(newPreset);
    setDateRange(presets[newPreset].getValue());
  }, []);

  const handleRangeChange = React.useCallback((range: DateRange | undefined) => {
    setDateRange(range);
    setPreset(undefined); // Clear preset when manually selecting
  }, []);

  const clear = React.useCallback(() => {
    setDateRange(undefined);
    setPreset(undefined);
  }, []);

  return {
    dateRange,
    preset,
    setDateRange: handleRangeChange,
    setPreset: handlePresetChange,
    clear,
    fromDate: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
    toDate: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
  };
}
