/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
} from "lucide-react";
import { Card, IconButton, cn } from "./ui";
import { formatDate } from "../services/dateFormatters";

export type FinancialCalendarEventType =
  | "payable"
  | "receivable"
  | "approval";

export interface FinancialCalendarEvent {
  id: string;
  date: string;
  type: FinancialCalendarEventType;
  title: string;
  subtitle: string;
  amount: number;
  status: string;
  actionable?: boolean;
}

interface FinancialCalendarProps {
  events: FinancialCalendarEvent[];
  onEventClick?: (event: FinancialCalendarEvent) => void;
}

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const TYPE_META: Record<
  FinancialCalendarEventType,
  { label: string; dot: string; icon: typeof ArrowDownRight; amount: string }
> = {
  payable: {
    label: "Despesa",
    dot: "bg-brand-red-600",
    icon: ArrowDownRight,
    amount: "text-brand-red-600 dark:text-red-400",
  },
  receivable: {
    label: "Recebimento",
    dot: "bg-brand-green-600",
    icon: ArrowUpRight,
    amount: "text-brand-green-600 dark:text-emerald-400",
  },
  approval: {
    label: "Aprovação",
    dot: "bg-brand-gold-600",
    icon: Clock3,
    amount: "text-amber-700 dark:text-brand-gold-300",
  },
};

const parseDate = (value: string) => new Date(`${value}T12:00:00`);

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const monthKey = (date: Date) => dateKey(date).slice(0, 7);

const formatMoney = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

function getInitialDate(events: FinancialCalendarEvent[]) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayKey = dateKey(today);
  const currentMonth = todayKey.slice(0, 7);
  if (events.some((event) => event.date.startsWith(currentMonth))) {
    return todayKey;
  }
  if (events.length === 0) return todayKey;

  return [...events].sort(
    (a, b) =>
      Math.abs(parseDate(a.date).getTime() - today.getTime()) -
      Math.abs(parseDate(b.date).getTime() - today.getTime()),
  )[0].date;
}

export default function FinancialCalendar({
  events,
  onEventClick,
}: FinancialCalendarProps) {
  const initialDate = getInitialDate(events);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = parseDate(initialDate);
    return new Date(date.getFullYear(), date.getMonth(), 1, 12);
  });
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, FinancialCalendarEvent[]>();
    events.forEach((event) => {
      grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    });
    return grouped;
  }, [events]);

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDayOffset = new Date(year, month, 1, 12).getDay();
    const daysInMonth = new Date(year, month + 1, 0, 12).getDate();
    const cellCount = Math.ceil((firstDayOffset + daysInMonth) / 7) * 7;
    const gridStart = new Date(year, month, 1 - firstDayOffset, 12);

    return Array.from({ length: cellCount }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      return day;
    });
  }, [visibleMonth]);

  const visibleMonthEvents = events.filter((event) =>
    event.date.startsWith(monthKey(visibleMonth)),
  );
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const upcomingEvents =
    selectedEvents.length > 0
      ? selectedEvents
      : visibleMonthEvents.filter((event) => event.date >= selectedDate).slice(0, 4);
  const displayedEvents =
    upcomingEvents.length > 0 ? upcomingEvents : visibleMonthEvents.slice(0, 4);
  const monthPayables = visibleMonthEvents
    .filter(
      (event) =>
        event.type === "payable" &&
        !["Paga", "Rejeitada"].includes(event.status),
    )
    .reduce((sum, event) => sum + event.amount, 0);
  const monthReceivables = visibleMonthEvents
    .filter(
      (event) =>
        event.type === "receivable" && event.status !== "Recebido",
    )
    .reduce((sum, event) => sum + event.amount, 0);
  const todayKey = dateKey(new Date());

  const changeMonth = (offset: number) => {
    const nextMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + offset,
      1,
      12,
    );
    const firstEvent = events.find((event) =>
      event.date.startsWith(monthKey(nextMonth)),
    );
    setVisibleMonth(nextMonth);
    setSelectedDate(firstEvent?.date ?? dateKey(nextMonth));
  };

  return (
    <Card className="h-full overflow-hidden p-0 shadow-[0_22px_48px_rgba(6,20,37,0.11)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-4 dark:border-line-dark">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-navy-900 text-white shadow-[0_8px_18px_rgba(11,44,82,0.28)]">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-ink dark:text-ink-dark">
              Agenda financeira
            </h3>
            <p className="text-[10px] text-ink-soft dark:text-ink-soft-dark">
              Compromissos do mês
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            icon={<ChevronLeft />}
            label="Mês anterior"
            size="sm"
            onClick={() => changeMonth(-1)}
          />
          <IconButton
            icon={<ChevronRight />}
            label="Próximo mês"
            size="sm"
            onClick={() => changeMonth(1)}
          />
        </div>
      </div>

      <div className="p-4">
        <h4 className="mb-3 text-xs font-bold capitalize text-ink dark:text-ink-dark">
          {visibleMonth.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          })}
        </h4>

        <div className="grid grid-cols-7">
          {WEEKDAYS.map((weekday, index) => (
            <span
              key={`${weekday}-${index}`}
              className="pb-2 text-center text-[8px] font-bold text-ink-soft dark:text-ink-soft-dark"
            >
              {weekday}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {calendarDays.map((day) => {
            const key = dateKey(day);
            const dayEvents = eventsByDate.get(key) ?? [];
            const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
            const isSelected = selectedDate === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedDate(key);
                  if (!isCurrentMonth) {
                    setVisibleMonth(
                      new Date(day.getFullYear(), day.getMonth(), 1, 12),
                    );
                  }
                }}
                aria-label={`${formatDate(day)}, ${dayEvents.length} eventos`}
                className={cn(
                  "relative mx-auto flex h-8 w-8 cursor-pointer flex-col items-center justify-center rounded-lg text-[10px] font-semibold transition-colors",
                  isCurrentMonth
                    ? "text-ink hover:bg-brand-blue-50 dark:text-ink-dark dark:hover:bg-white/5"
                    : "text-ink-soft/35 dark:text-ink-soft-dark/35",
                  isSelected &&
                    "bg-brand-navy-900 text-white shadow-[0_6px_14px_rgba(11,44,82,0.3)] hover:bg-brand-navy-900 dark:bg-brand-navy-700 dark:text-white",
                  key === todayKey && !isSelected && "ring-1 ring-brand-red-600/60",
                )}
              >
                {day.getDate()}
                {dayEvents.length > 0 && (
                  <span className="absolute bottom-0.5 flex gap-0.5">
                    {Array.from(new Set(dayEvents.map((event) => event.type)))
                      .slice(0, 3)
                      .map((type) => (
                        <span
                          key={type}
                          className={cn(
                            "h-1 w-1 rounded-full",
                            isSelected ? "bg-white" : TYPE_META[type].dot,
                          )}
                        />
                      ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-brand-red-50 px-3 py-2 dark:bg-brand-red-600/10">
            <span className="block text-[8px] font-bold uppercase text-brand-red-600 dark:text-red-300">
              A pagar
            </span>
            <span className="text-[11px] font-bold text-ink dark:text-ink-dark">
              {formatMoney(monthPayables)}
            </span>
          </div>
          <div className="rounded-xl bg-brand-green-50 px-3 py-2 dark:bg-brand-green-600/10">
            <span className="block text-[8px] font-bold uppercase text-brand-green-600 dark:text-emerald-300">
              A receber
            </span>
            <span className="text-[11px] font-bold text-ink dark:text-ink-dark">
              {formatMoney(monthReceivables)}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-line bg-canvas/55 p-4 dark:border-line-dark dark:bg-white/[0.02]">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink dark:text-ink-dark">
            {selectedEvents.length > 0 ? "Eventos do dia" : "Próximos eventos"}
          </h4>
          <span className="text-[9px] text-ink-soft dark:text-ink-soft-dark">
            {displayedEvents.length} itens
          </span>
        </div>

        {displayedEvents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line py-7 text-center text-[10px] text-ink-soft dark:border-line-dark dark:text-ink-soft-dark">
            Nenhum evento neste mês.
          </p>
        ) : (
          <div className="space-y-2">
            {displayedEvents.slice(0, 4).map((event) => {
              const meta = TYPE_META[event.type];
              const Icon = meta.icon;
              return (
                <button
                  key={`${event.type}-${event.id}`}
                  type="button"
                  disabled={!event.actionable || !onEventClick}
                  onClick={() => onEventClick?.(event)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface p-2.5 text-left shadow-sm transition-all enabled:cursor-pointer enabled:hover:border-brand-navy-700/30 enabled:hover:shadow-md disabled:cursor-default dark:border-line-dark dark:bg-surface-dark"
                >
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-canvas dark:bg-white/5", meta.amount)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] font-bold text-ink dark:text-ink-dark">
                      {event.title}
                    </span>
                    <span className="block truncate text-[9px] text-ink-soft dark:text-ink-soft-dark">
                      {parseDate(event.date).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                      })}{" "}
                      · {meta.label}
                    </span>
                  </span>
                  <span className={cn("shrink-0 text-[10px] font-bold", meta.amount)}>
                    {formatMoney(event.amount)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
