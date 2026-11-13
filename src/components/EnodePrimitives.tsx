import React, { useEffect, useState } from 'react';

/**
 * Layout primitives. These used to drive scroll-reveal choreography; they now
 * render plain, static markup so content appears immediately.
 */

export const ENODE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'span';
}> = ({ children, className = '', as = 'div' }) => {
  const Tag = as as 'div';
  return <Tag className={className}>{children}</Tag>;
};

export const RevealGroup: React.FC<{
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}> = ({ children, className = '' }) => <div className={className}>{children}</div>;

export const RevealItem: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => <div className={className}>{children}</div>;

/* ------------------------------------------------------------------------- */
/* RollingNumber — plain tabular number (name kept for existing call sites)   */
/* ------------------------------------------------------------------------- */
export const RollingNumber: React.FC<{
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  /** Insert thousands separators. */
  grouped?: boolean;
}> = ({ value, prefix = '', suffix = '', className = '', grouped = true }) => {
  const safe = Math.max(0, Math.round(value || 0));
  const text = grouped ? safe.toLocaleString('en-US') : String(safe);
  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
};

/** Renders a value; kept as a simple pass-through for existing call sites. */
export const TickingValue: React.FC<{
  value: React.ReactNode;
  valueKey: string | number;
  className?: string;
}> = ({ value, className = '' }) => (
  <span className={`inline-flex ${className}`}>{value}</span>
);

/* ------------------------------------------------------------------------- */
/* AutoTabs — simple click-to-select feature tabs (no auto-advance)           */
/* ------------------------------------------------------------------------- */
export interface AutoTabItem {
  id: string;
  label: string;
  title: string;
  description: string;
  panel: React.ReactNode;
}

export const AutoTabs: React.FC<{
  items: AutoTabItem[];
  intervalMs?: number;
  layoutIdPrefix?: string;
}> = ({ items }) => {
  const [active, setActive] = useState(0);
  const current = items[active];
  if (!current) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      <div
        className="lg:col-span-5 flex flex-col gap-1"
        role="tablist"
        aria-orientation="vertical"
      >
        {items.map((item, i) => {
          const isActive = i === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(i)}
              className={`text-left py-3 px-4 rounded-lg border-l-4 transition-colors cursor-pointer ${
                isActive
                  ? 'border-blue-700 bg-white dark:bg-slate-900 shadow-sm'
                  : 'border-transparent hover:bg-white/60 dark:hover:bg-slate-900/60'
              }`}
            >
              <div
                className={`text-sm font-semibold ${
                  isActive ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {item.title}
              </div>
              <p className="text-xs sm:text-sm leading-relaxed pt-1 text-slate-500 dark:text-slate-400">
                {item.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="lg:col-span-7 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-[var(--hairline)] p-5 sm:p-8 flex items-center justify-center min-h-[320px]">
        <div className="w-full max-w-md">{current.panel}</div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* useScrolled — hysteresis-protected scroll detector (no threshold jitter)   */
/* ------------------------------------------------------------------------- */
export function useScrolled(enterThreshold = 24, exitThreshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let rafId = 0;
    const update = () => {
      rafId = 0;
      const y = window.scrollY;
      setScrolled((prev) => {
        if (!prev && y > enterThreshold) return true;
        if (prev && y < exitThreshold) return false;
        return prev;
      });
    };
    const onScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [enterThreshold, exitThreshold]);
  return scrolled;
}
