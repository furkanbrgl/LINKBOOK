"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type AccordionContextValue = {
  open: string[];
  toggle: (value: string) => void;
  type: "single" | "multiple";
};

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

function useAccordion() {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) throw new Error("Accordion components must be used within Accordion");
  return ctx;
}

type AccordionProps = {
  type?: "single" | "multiple";
  defaultValue?: string | string[];
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  children: React.ReactNode;
  className?: string;
};

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  (
    {
      type = "single",
      defaultValue,
      value: controlledValue,
      onValueChange,
      children,
      className,
    },
    ref
  ) => {
    const initial = React.useMemo(() => {
      const v = defaultValue ?? (type === "multiple" ? [] : "");
      return Array.isArray(v) ? v : v ? [v] : [];
    }, [defaultValue, type]);

    const [uncontrolledOpen, setUncontrolledOpen] = React.useState<string[]>(initial);
    const isControlled = controlledValue !== undefined;
    const open = isControlled
      ? (Array.isArray(controlledValue) ? controlledValue : controlledValue ? [controlledValue] : [])
      : uncontrolledOpen;

    const toggle = React.useCallback(
      (itemValue: string) => {
        const next =
          type === "single"
            ? open.includes(itemValue)
              ? []
              : [itemValue]
            : open.includes(itemValue)
              ? open.filter((v) => v !== itemValue)
              : [...open, itemValue];
        if (!isControlled) setUncontrolledOpen(next);
        onValueChange?.(type === "single" ? (next[0] ?? "") : next);
      },
      [type, open, isControlled, onValueChange]
    );

    const ctx: AccordionContextValue = React.useMemo(
      () => ({ open, toggle, type }),
      [open, toggle, type]
    );

    return (
      <AccordionContext.Provider value={ctx}>
        <div ref={ref} className={cn("space-y-1", className)} data-state="">
          {children}
        </div>
      </AccordionContext.Provider>
    );
  }
);
Accordion.displayName = "Accordion";

const AccordionItemContext = React.createContext<string>("");

const AccordionItemWithValue = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ value, className, ...props }, ref) => (
  <AccordionItemContext.Provider value={value}>
    <div
      ref={ref}
      data-state={useAccordion().open.includes(value) ? "open" : "closed"}
      className={cn("rounded-lg border border-neutral-200 dark:border-neutral-700", className)}
      {...props}
    />
  </AccordionItemContext.Provider>
));
AccordionItemWithValue.displayName = "AccordionItem";

const AccordionTriggerWithCtx = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const value = React.useContext(AccordionItemContext);
  const ctx = useAccordion();
  const isOpen = ctx.open.includes(value);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => ctx.toggle(value)}
      className={cn(
        "flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium transition-all hover:bg-neutral-50 dark:hover:bg-neutral-800 [&[data-state=open]>svg]:rotate-180",
        className
      )}
      data-state={isOpen ? "open" : "closed"}
      aria-expanded={isOpen}
      {...props}
    >
      {children}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 transition-transform duration-200"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
});
AccordionTriggerWithCtx.displayName = "AccordionTrigger";

const AccordionContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const value = React.useContext(AccordionItemContext);
  const open = useAccordion().open.includes(value);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={cn("overflow-hidden px-4 pb-4 pt-0 text-sm", className)}
      data-state={open ? "open" : "closed"}
      {...props}
    >
      {children}
    </div>
  );
});
AccordionContent.displayName = "AccordionContent";

export {
  Accordion,
  AccordionItemWithValue as AccordionItem,
  AccordionTriggerWithCtx as AccordionTrigger,
  AccordionContent,
};
