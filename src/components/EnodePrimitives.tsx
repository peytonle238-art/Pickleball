import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from 'motion/react';

/**
 * Enode-inspired (enode.com) motion primitives.
 *
 * Designed for zero layout shift and butter-smooth scrolling:
 * - No persistent `filter: blur()` compositing layers on scroll containers
 * - No height-accordion animations that fight browser scroll anchoring
 * - Scroll-threshold hysteresis (`useScrolled`) to prevent top-of-page oscillation
 */

export const ENODE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ------------------------------------------------------------------------- */
/* Reveal — in-view fade + rise (transform/opacity only for 120fps scroll)    */
/* ------------------------------------------------------------------------- */
export const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'span';
}> = ({ children, delay = 0, y = 18, className = '', as = 'div' }) => {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;
  if (reduce) {
    const Tag = as as 'div';
    return <Tag className={className}>{children}</Tag>;
  }
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 0.75, delay, ease: ENODE_EASE }}
    >
      {children}
    </MotionTag>
  );
};

/** Staggers direct `RevealItem` children as the group scrolls into view. */
export const RevealGroup: React.FC<{
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}> = ({ children, className = '', stagger = 0.07, delay = 0 }) => {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
};

export const RevealItem: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <motion.div
    className={className}
    variants={{
      hidden: { opacity: 0, y: 16 },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.7, ease: ENODE_EASE },
      },
    }}
  >
    {children}
  </motion.div>
);

/* ------------------------------------------------------------------------- */
/* RollingNumber — odometer digits triggered when in view                     */
/* ------------------------------------------------------------------------- */
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const RollingDigit: React.FC<{ digit: number; active: boolean; index: number }> = ({
  digit,
  active,
  index,
}) => (
  <span
    className="relative inline-block overflow-hidden align-baseline"
    style={{ height: '1em', lineHeight: 1, width: '0.62em' }}
  >
    <motion.span
      className="absolute left-0 top-0 flex flex-col"
      initial={false}
      animate={{ y: active ? `-${digit}em` : '0em' }}
      transition={{ duration: 1.25, delay: index * 0.05, ease: ENODE_EASE }}
    >
      {DIGITS.map((d) => (
        <span key={d} style={{ height: '1em', lineHeight: 1 }} className="block text-center">
          {d}
        </span>
      ))}
    </motion.span>
  </span>
);

export const RollingNumber: React.FC<{
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  /** Insert thousands separators. */
  grouped?: boolean;
}> = ({ value, prefix = '', suffix = '', className = '', grouped = true }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -8% 0px' });
  const reduce = useReducedMotion();
  const safe = Math.max(0, Math.round(value || 0));
  const text = grouped ? safe.toLocaleString('en-US') : String(safe);

  if (reduce) {
    return (
      <span ref={ref} className={`tabular-nums ${className}`}>
        {prefix}
        {text}
        {suffix}
      </span>
    );
  }

  let digitIndex = 0;
  return (
    <span
      ref={ref}
      className={`inline-flex items-baseline tabular-nums ${className}`}
      aria-label={`${prefix}${text}${suffix}`}
    >
      {prefix && <span aria-hidden>{prefix}</span>}
      {text.split('').map((ch, i) => {
        if (ch < '0' || ch > '9') {
          return (
            <span key={`s-${i}`} aria-hidden>
              {ch}
            </span>
          );
        }
        const idx = digitIndex++;
        return (
          <span key={`d-${i}`} aria-hidden>
            <RollingDigit digit={Number(ch)} active={inView} index={idx} />
          </span>
        );
      })}
      {suffix && <span aria-hidden>{suffix}</span>}
    </span>
  );
};

/* ------------------------------------------------------------------------- */
/* FloatingWidget — glass card with slow idle drift                           */
/* ------------------------------------------------------------------------- */
export const FloatingWidget: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
  /** Seconds for one float cycle. Varying this per card avoids lock-step. */
  period?: number;
  amplitude?: number;
}> = ({ children, className = '', delay = 0, period = 6, amplitude = 4 }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay, ease: ENODE_EASE }}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -amplitude, 0] }}
        transition={
          reduce
            ? undefined
            : { duration: period, repeat: Infinity, ease: 'easeInOut', delay: delay + 0.8 }
        }
        className="glass-card rounded-2xl will-change-transform"
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

/** Swaps a value with a soft vertical crossfade whenever it changes. */
export const TickingValue: React.FC<{
  value: React.ReactNode;
  valueKey: string | number;
  className?: string;
}> = ({ value, valueKey, className = '' }) => (
  <span className={`relative inline-flex overflow-hidden ${className}`}>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={valueKey}
        initial={{ y: '55%', opacity: 0 }}
        animate={{ y: '0%', opacity: 1 }}
        exit={{ y: '-55%', opacity: 0 }}
        transition={{ duration: 0.5, ease: ENODE_EASE }}
        className="inline-block"
      >
        {value}
      </motion.span>
    </AnimatePresence>
  </span>
);

/* ------------------------------------------------------------------------- */
/* Marquee — infinite strip, pauses on hover                                  */
/* ------------------------------------------------------------------------- */
export const Marquee: React.FC<{
  children: React.ReactNode;
  durationSec?: number;
  className?: string;
}> = ({ children, durationSec = 40, className = '' }) => (
  <div
    className={`marquee ${className}`}
    style={{ ['--marquee-duration' as string]: `${durationSec}s` } as React.CSSProperties}
  >
    <div className="marquee-track">
      <div className="flex shrink-0 items-center">{children}</div>
      <div className="flex shrink-0 items-center" aria-hidden>
        {children}
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------------- */
/* AutoTabs — auto-advancing tabs with constant height (zero scroll shift)    */
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
}> = ({ items, intervalMs = 6500 }) => {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { margin: '-15% 0px -15% 0px' });

  const running = !paused && !reduce && inView && items.length > 1;

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => {
      setActive((a) => (a + 1) % items.length);
      setCycle((c) => c + 1);
    }, intervalMs);
    return () => clearTimeout(t);
  }, [running, active, cycle, intervalMs, items.length]);

  const select = (i: number) => {
    setActive(i);
    setCycle((c) => c + 1);
  };

  const current = items[active];

  return (
    <div
      ref={containerRef}
      className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-stretch"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="lg:col-span-5 flex flex-col justify-between" role="tablist" aria-orientation="vertical">
        {items.map((item, i) => {
          const isActive = i === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => select(i)}
              className={`relative text-left py-4 pl-5 pr-4 rounded-r-2xl transition-colors cursor-pointer ${
                isActive
                  ? 'bg-white/75 dark:bg-white/[0.04]'
                  : 'hover:bg-white/40 dark:hover:bg-white/[0.02]'
              }`}
            >
              {/* progress rail */}
              <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--hairline)] overflow-hidden">
                {isActive && (
                  <motion.span
                    key={`${item.id}-${cycle}`}
                    className="absolute left-0 top-0 w-full bg-slate-900 dark:bg-court"
                    initial={{ height: running ? '0%' : '100%' }}
                    animate={{ height: '100%' }}
                    transition={
                      running
                        ? { duration: intervalMs / 1000, ease: 'linear' }
                        : { duration: 0.3 }
                    }
                  />
                )}
              </span>
              <div
                className={`text-xs font-medium mb-1 transition-colors ${
                  isActive ? 'text-olive dark:text-court' : 'text-slate-400'
                }`}
              >
                {item.label}
              </div>
              <div
                className={`text-base sm:text-lg font-semibold tracking-tight transition-colors ${
                  isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500'
                }`}
              >
                {item.title}
              </div>
              <p
                className={`text-xs sm:text-sm leading-relaxed pt-1.5 max-w-sm transition-colors ${
                  isActive
                    ? 'text-slate-600 dark:text-slate-300'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {item.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="lg:col-span-7 relative rounded-3xl bg-slate-100/70 dark:bg-slate-900/60 border border-[var(--hairline)] overflow-hidden min-h-[360px] flex items-center justify-center p-6 sm:p-10">
        <div className="dot-grid absolute inset-0 pointer-events-none" />
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.45, ease: ENODE_EASE }}
            className="relative w-full max-w-md"
          >
            {current.panel}
          </motion.div>
        </AnimatePresence>
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
