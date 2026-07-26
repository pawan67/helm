"use client";

import {
  Button,
  DatePicker,
  Icon,
  IconButton,
  Portal,
  parseDate,
} from "@chakra-ui/react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

/** Prev / title / next header shared by all three calendar views. */
function ViewHeader({ prevLabel, nextLabel }: { prevLabel: string; nextLabel: string }) {
  return (
    <DatePicker.ViewControl>
      <DatePicker.PrevTrigger asChild>
        <IconButton aria-label={prevLabel} variant="ghost" size="sm">
          <ChevronLeft />
        </IconButton>
      </DatePicker.PrevTrigger>
      <DatePicker.ViewTrigger asChild>
        <Button variant="ghost" size="sm" fontWeight="semibold">
          <DatePicker.RangeText />
        </Button>
      </DatePicker.ViewTrigger>
      <DatePicker.NextTrigger asChild>
        <IconButton aria-label={nextLabel} variant="ghost" size="sm">
          <ChevronRight />
        </IconButton>
      </DatePicker.NextTrigger>
    </DatePicker.ViewControl>
  );
}

/**
 * A themed range calendar built on Chakra's DatePicker (Ark UI) — not a native
 * `<input type="date">`. Speaks plain `YYYY-MM-DD` strings so callers stay
 * framework-agnostic: empty string means "unset". Selecting a range fires
 * `onChange(from, to)`; the built-in clear (✕) fires `onChange("", "")`.
 */
export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = "Any dates",
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  placeholder?: string;
}) {
  // Only feed the picker dates it can parse; drop empties.
  const value = [from, to].filter(Boolean).map((s) => parseDate(s));

  // Label the trigger from the props (source of truth), not the picker's
  // visible-range text — RangeText would show the open month ("July 2026").
  const fmtDay = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  const label =
    from && to
      ? `${fmtDay(from)} – ${fmtDay(to)}`
      : from
        ? fmtDay(from)
        : placeholder;

  return (
    <DatePicker.Root
      selectionMode="range"
      value={value}
      onValueChange={(e) => {
        // `value` holds CalendarDate objects whose toString() is ISO
        // (YYYY-MM-DD). `valueAsString` is locale-formatted (MM/DD/YYYY) — not
        // what parseDate or the API expect, so never use it here.
        const [f, t] = e.value.map((d) => d.toString());
        onChange(f ?? "", t ?? "");
      }}
      positioning={{ placement: "bottom-start" }}
      size="sm"
    >
      <DatePicker.Control>
        <DatePicker.Trigger asChild>
          <Button
            variant="outline"
            size="sm"
            fontWeight="medium"
            gap="2"
            color={from || to ? "fg" : "fg.muted"}
          >
            <Icon as={CalendarDays} boxSize="3.5" color="fg.subtle" />
            {label}
          </Button>
        </DatePicker.Trigger>
        {from || to ? (
          <DatePicker.ClearTrigger asChild>
            <IconButton
              aria-label="Clear date range"
              variant="ghost"
              size="sm"
              color="fg.muted"
              ms="1"
            >
              <X />
            </IconButton>
          </DatePicker.ClearTrigger>
        ) : null}
      </DatePicker.Control>

      <Portal>
        <DatePicker.Positioner>
          <DatePicker.Content>
            {/* Day view */}
            <DatePicker.View view="day">
              <DatePicker.Context>
                {(api) => (
                  <>
                    <ViewHeader prevLabel="Previous month" nextLabel="Next month" />
                    <DatePicker.Table>
                      <DatePicker.TableHead>
                        <DatePicker.TableRow>
                          {api.weekDays.map((day, i) => (
                            <DatePicker.TableHeader key={i}>
                              {day.narrow}
                            </DatePicker.TableHeader>
                          ))}
                        </DatePicker.TableRow>
                      </DatePicker.TableHead>
                      <DatePicker.TableBody>
                        {api.weeks.map((week, i) => (
                          <DatePicker.TableRow key={i}>
                            {week.map((day, j) => (
                              <DatePicker.TableCell key={j} value={day}>
                                <DatePicker.TableCellTrigger>
                                  {day.day}
                                </DatePicker.TableCellTrigger>
                              </DatePicker.TableCell>
                            ))}
                          </DatePicker.TableRow>
                        ))}
                      </DatePicker.TableBody>
                    </DatePicker.Table>
                  </>
                )}
              </DatePicker.Context>
            </DatePicker.View>

            {/* Month view */}
            <DatePicker.View view="month">
              <DatePicker.Context>
                {(api) => (
                  <>
                    <ViewHeader prevLabel="Previous year" nextLabel="Next year" />
                    <DatePicker.Table>
                      <DatePicker.TableBody>
                        {api
                          .getMonthsGrid({ columns: 4, format: "short" })
                          .map((row, i) => (
                            <DatePicker.TableRow key={i}>
                              {row.map((month, j) => (
                                <DatePicker.TableCell key={j} value={month.value}>
                                  <DatePicker.TableCellTrigger>
                                    {month.label}
                                  </DatePicker.TableCellTrigger>
                                </DatePicker.TableCell>
                              ))}
                            </DatePicker.TableRow>
                          ))}
                      </DatePicker.TableBody>
                    </DatePicker.Table>
                  </>
                )}
              </DatePicker.Context>
            </DatePicker.View>

            {/* Year view */}
            <DatePicker.View view="year">
              <DatePicker.Context>
                {(api) => (
                  <>
                    <ViewHeader prevLabel="Previous decade" nextLabel="Next decade" />
                    <DatePicker.Table>
                      <DatePicker.TableBody>
                        {api.getYearsGrid({ columns: 4 }).map((row, i) => (
                          <DatePicker.TableRow key={i}>
                            {row.map((year, j) => (
                              <DatePicker.TableCell key={j} value={year.value}>
                                <DatePicker.TableCellTrigger>
                                  {year.label}
                                </DatePicker.TableCellTrigger>
                              </DatePicker.TableCell>
                            ))}
                          </DatePicker.TableRow>
                        ))}
                      </DatePicker.TableBody>
                    </DatePicker.Table>
                  </>
                )}
              </DatePicker.Context>
            </DatePicker.View>
          </DatePicker.Content>
        </DatePicker.Positioner>
      </Portal>
    </DatePicker.Root>
  );
}
