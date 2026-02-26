import * as React from "react";
import { format, parseISO, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/shadcn/button";
import { Calendar } from "@/components/shadcn/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shadcn/popover";

type DateRangePickerProps = {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
};

function DateRangePicker({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: DateRangePickerProps) {
  const from =
    dateFrom && isValid(parseISO(dateFrom)) ? parseISO(dateFrom) : undefined;
  const to = dateTo && isValid(parseISO(dateTo)) ? parseISO(dateTo) : undefined;

  const date: DateRange | undefined = from ? { from, to } : undefined;

  function handleSelect(selected: DateRange | undefined) {
    onDateFromChange(selected?.from ? format(selected.from, "yyyy-MM-dd") : "");
    onDateToChange(selected?.to ? format(selected.to, "yyyy-MM-dd") : "");
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          id="date-picker-range"
          className="justify-start px-2.5 font-normal w-56"
        >
          <CalendarIcon />
          {date?.from ? (
            date.to ? (
              <>
                {format(date.from, "LLL dd, y")} –{" "}
                {format(date.to, "LLL dd, y")}
              </>
            ) : (
              format(date.from, "LLL dd, y")
            )
          ) : (
            <span>Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={handleSelect}
          numberOfMonths={2}
          className="[--cell-size:--spacing(7)]"
        />
      </PopoverContent>
    </Popover>
  );
}

export { DateRangePicker };
