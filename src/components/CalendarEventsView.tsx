import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  MapPin,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react';
import { CalendarEvent, ClubSettings, EventCategory } from '../types';

interface CalendarEventsViewProps {
  events: CalendarEvent[];
  settings: ClubSettings;
  isOfficer: boolean;
  onUpdateEvents: (events: CalendarEvent[]) => void;
  onUpdateSettings: (settings: ClubSettings) => void;
  onRequestOfficerUnlock: () => void;
}

const EVENT_TYPES: EventCategory[] = [
  'Practice',
  'Meeting',
  'Tournament',
  'Social',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CalendarEventsView: React.FC<CalendarEventsViewProps> = ({
  events,
  settings,
  isOfficer,
  onUpdateEvents,
  onUpdateSettings,
  onRequestOfficerUnlock,
}) => {
  const [viewYear, setViewYear] = useState<number>(() =>
    new Date().getFullYear()
  );
  const [viewMonth, setViewMonth] = useState<number>(() =>
    new Date().getMonth()
  );
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );

  // Add/Edit Event modal state
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [evTitle, setEvTitle] = useState('');
  const [evDate, setEvDate] = useState(selectedDateStr);
  const [evTime, setEvTime] = useState('3:50 PM – 5:30 PM');
  const [evLocation, setEvLocation] = useState('BNHS Varsity Courts 1–6');
  const [evType, setEvType] = useState<EventCategory>('Practice');
  const [evDesc, setEvDesc] = useState('');

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const toggleRecurringDay = (dayIdx: number) => {
    if (!isOfficer) return;
    const exists = settings.recurringPractices.daysOfWeek.includes(dayIdx);
    const nextDays = exists
      ? settings.recurringPractices.daysOfWeek.filter((d) => d !== dayIdx)
      : [...settings.recurringPractices.daysOfWeek, dayIdx].sort();

    onUpdateSettings({
      ...settings,
      recurringPractices: {
        ...settings.recurringPractices,
        daysOfWeek: nextDays,
      },
    });
  };

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const getEventsForDate = (
    dateStr: string,
    dayOfWeek: number
  ): CalendarEvent[] => {
    const explicit = events.filter((e) => e.date === dateStr);
    const hasExplicitPractice = explicit.some((e) => e.type === 'Practice');

    if (
      settings.recurringPractices.enabled &&
      settings.recurringPractices.daysOfWeek.includes(dayOfWeek) &&
      !hasExplicitPractice
    ) {
      return [
        ...explicit,
        {
          id: `recurring-${dateStr}`,
          title: 'After-School Club Practice',
          date: dateStr,
          time: settings.recurringPractices.timeRange,
          location: settings.recurringPractices.location,
          type: 'Practice',
          description: 'Recurring club practice, drills, and ladder play.',
        },
      ];
    }
    return explicit;
  };

  const getTypeColorClasses = (type: EventCategory) => {
    switch (type) {
      case 'Practice':
        return 'bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-200 border-blue-200 dark:border-blue-800';
      case 'Tournament':
        return 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border-amber-200 dark:border-amber-800';
      case 'Meeting':
        return 'bg-purple-100 text-purple-900 dark:bg-purple-950/80 dark:text-purple-200 border-purple-200 dark:border-purple-800';
      case 'Social':
        return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800';
    }
  };

  const openAddEvent = (forDate: string = selectedDateStr) => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    setEditingEvent(null);
    setEvTitle('');
    setEvDate(forDate);
    setEvTime('3:50 PM – 5:30 PM');
    setEvLocation('BNHS Varsity Courts 1–6');
    setEvType('Practice');
    setEvDesc('');
    setShowEventForm(true);
  };

  const openEditEvent = (ev: CalendarEvent) => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    setEditingEvent(ev);
    setEvTitle(ev.title);
    setEvDate(ev.date);
    setEvTime(ev.time);
    setEvLocation(ev.location);
    setEvType(ev.type);
    setEvDesc(ev.description);
    setShowEventForm(true);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOfficer || !evTitle.trim()) return;

    if (editingEvent && !editingEvent.id.startsWith('recurring-')) {
      onUpdateEvents(
        events.map((x) =>
          x.id === editingEvent.id
            ? {
                ...x,
                title: evTitle.trim(),
                date: evDate,
                time: evTime.trim(),
                location: evLocation.trim(),
                type: evType,
                description: evDesc.trim(),
              }
            : x
        )
      );
    } else {
      const created: CalendarEvent = {
        id: `ev-${Date.now()}`,
        title: evTitle.trim(),
        date: evDate,
        time: evTime.trim(),
        location: evLocation.trim(),
        type: evType,
        description: evDesc.trim(),
      };
      onUpdateEvents([...events, created]);
    }
    setShowEventForm(false);
    setEditingEvent(null);
  };

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const selectedDayOfWeek = new Date(`${selectedDateStr}T12:00:00`).getDay();
  const selectedDayEvents = getEventsForDate(
    selectedDateStr,
    selectedDayOfWeek
  );

  return (
    <div className="space-y-6">
      {/* Recurring Practices Banner & Color Legend */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Club Calendar & Practice Schedule
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              View upcoming club practices, tournaments, meetings, and events
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isOfficer && (
              <button
                onClick={() => openAddEvent(selectedDateStr)}
                className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
                style={{ backgroundColor: 'var(--club-primary)' }}
              >
                <Plus className="w-4 h-4" />
                Add Calendar Event
              </button>
            )}
          </div>
        </div>

        {/* Recurring Practice Days Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5">
              <Repeat className="w-4 h-4 text-blue-600" />
              Recurring Practice Days ({settings.recurringPractices.timeRange}):
            </span>
            <div className="flex items-center gap-1">
              {DAY_NAMES.map((dayLabel, idx) => {
                const active =
                  settings.recurringPractices.daysOfWeek.includes(idx);
                return (
                  <button
                    key={dayLabel}
                    type="button"
                    disabled={!isOfficer}
                    onClick={() => toggleRecurringDay(idx)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                      isOfficer ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {dayLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="px-2 py-0.5 rounded border bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-200 border-blue-200 dark:border-blue-800 font-medium">
              Practice
            </span>
            <span className="px-2 py-0.5 rounded border bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border-amber-200 dark:border-amber-800 font-medium">
              Tournament
            </span>
            <span className="px-2 py-0.5 rounded border bg-purple-100 text-purple-900 dark:bg-purple-950/80 dark:text-purple-200 border-purple-200 dark:border-purple-800 font-medium">
              Meeting
            </span>
            <span className="px-2 py-0.5 rounded border bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800 font-medium">
              Social
            </span>
          </div>
        </div>
      </div>

      {/* Add/Edit Event Form */}
      {isOfficer && showEventForm && (
        <form
          onSubmit={handleSaveEvent}
          className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
        >
          <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {editingEvent ? 'Edit Event' : 'Add Club Event'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Event Title
              </label>
              <input
                type="text"
                value={evTitle}
                onChange={(e) => setEvTitle(e.target.value)}
                required
                className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Event Type
              </label>
              <select
                value={evType}
                onChange={(e) => setEvType(e.target.value as EventCategory)}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Date
              </label>
              <input
                type="date"
                value={evDate}
                onChange={(e) => setEvDate(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Time Range
              </label>
              <input
                type="text"
                value={evTime}
                onChange={(e) => setEvTime(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Location
              </label>
              <input
                type="text"
                value={evLocation}
                onChange={(e) => setEvLocation(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Details / Notes
              </label>
              <input
                type="text"
                value={evDesc}
                onChange={(e) => setEvDesc(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowEventForm(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-bold text-white cursor-pointer"
              style={{ backgroundColor: 'var(--club-primary)' }}
            >
              Save Event
            </button>
          </div>
        </form>
      )}

      {/* Main Calendar Month Grid + Selected Day Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Month View Calendar Grid */}
        <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {monthLabel}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
                aria-label="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
                aria-label="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-slate-500 pb-2">
            {DAY_NAMES.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="min-h-[82px] rounded-xl bg-slate-50/40 dark:bg-slate-900/20"
              />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(
                2,
                '0'
              )}-${String(dayNum).padStart(2, '0')}`;
              const dayOfWeek = new Date(viewYear, viewMonth, dayNum).getDay();
              const dayEvents = getEventsForDate(dateStr, dayOfWeek);
              const isSelected = selectedDateStr === dateStr;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDateStr(dateStr)}
                  className={`min-h-[56px] sm:min-h-[82px] p-1 sm:p-1.5 rounded-xl border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/30 dark:bg-blue-950/30'
                      : 'border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="w-full flex items-center justify-between">
                    <span className="font-mono-num text-xs font-bold text-slate-700 dark:text-slate-300">
                      {dayNum}
                    </span>
                  </div>

                  <div className="space-y-0.5 sm:space-y-1 w-full overflow-hidden">
                    {/* On mobile screens (<640px): compact colored indicator dots */}
                    <div className="flex sm:hidden items-center justify-center gap-1 mt-1">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <div
                          key={ev.id}
                          className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400"
                        />
                      ))}
                    </div>
                    {/* On sm and larger screens: full colored event badges */}
                    <div className="hidden sm:block space-y-1">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold truncate border ${getTypeColorClasses(
                            ev.type
                          )}`}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] text-slate-400 font-mono-num">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Schedule & QR Actions */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500">Selected Date</span>
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {selectedDateStr}
                </h3>
              </div>
              {isOfficer && (
                <button
                  onClick={() => openAddEvent(selectedDateStr)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  + Event on Day
                </button>
              )}
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="py-4 space-y-3">
                <p className="text-xs text-slate-500">
                  No scheduled practices or events on {selectedDateStr}.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getTypeColorClasses(
                          ev.type
                        )}`}
                      >
                        {ev.type}
                      </span>
                      {isOfficer && !ev.id.startsWith('recurring-') && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditEvent(ev)}
                            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              onUpdateEvents(
                                events.filter((x) => x.id !== ev.id)
                              )
                            }
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {ev.title}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      {ev.time}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {ev.location}
                    </div>
                    {ev.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 pt-1">
                        {ev.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
