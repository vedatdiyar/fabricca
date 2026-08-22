"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropdownContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

/** Props for DropdownMenu root component. */
export interface DropdownMenuProps {
  children: React.ReactNode;
}

/**
 * Root container for dropdown menu component.
 *
 * @param props - Component props.
 * @returns Root element.
 */
export function DropdownMenu(props: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block text-left">{props.children}</div>
    </DropdownContext.Provider>
  );
}

/** Props for DropdownMenuTrigger. */
export interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

/**
 * Dropdown trigger button.
 *
 * @param props - Component props.
 * @returns Trigger markup.
 */
export const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuTriggerProps
>((props, ref) => {
  const { className, children, onClick, ...rest } = props;
  const ctx = React.useContext(DropdownContext);

  return (
    <button
      ref={ref}
      type="button"
      onClick={(e) => {
        ctx?.setOpen((prev) => !prev);
        onClick?.(e);
      }}
      className={cn("outline-hidden", className)}
      {...rest}
    >
      {children}
    </button>
  );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

/** Props for DropdownMenuContent. */
export interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end" | "center";
}

/**
 * Dropdown content menu popup.
 *
 * @param props - Content props.
 * @returns Content markup.
 */
export const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  DropdownMenuContentProps
>((props, ref) => {
  const { className, align = "end", children, ...rest } = props;
  const ctx = React.useContext(DropdownContext);

  if (!ctx?.open) return null;

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="fixed inset-0 z-40"
        onClick={() => ctx.setOpen(false)}
      />
      <div
        ref={ref}
        role="menu"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            ctx?.setOpen(false);
          }
        }}
        className={cn(
          "absolute mt-1 z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md backdrop-blur-md animate-in fade-in-80",
          align === "end" ? "right-0" : "left-0",
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    </>
  );
});
DropdownMenuContent.displayName = "DropdownMenuContent";

/** Props for DropdownMenuItem. */
export interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
}

/**
 * Action item inside dropdown menu.
 *
 * @param props - Item props.
 * @returns Item markup.
 */
export const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  DropdownMenuItemProps
>((props, ref) => {
  const { className, children, disabled, onClick, ...rest } = props;
  const ctx = React.useContext(DropdownContext);

  return (
    <div
      ref={ref}
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (disabled) return;
          ctx?.setOpen(false);
          onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
        } else if (e.key === "Escape") {
          ctx?.setOpen(false);
        }
      }}
      onClick={(e) => {
        if (disabled) return;
        ctx?.setOpen(false);
        onClick?.(e);
      }}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground [&_svg]:size-3.5",
        disabled && "opacity-50 pointer-events-none cursor-not-allowed",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

/** Props for DropdownMenuLabel. */
export type DropdownMenuLabelProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Menu section header label.
 *
 * @param props - Component props.
 * @returns Label markup.
 */
export function DropdownMenuLabel(props: DropdownMenuLabelProps) {
  const { className, ...rest } = props;
  return (
    <div
      className={cn(
        "px-2 py-1.5 text-xs font-semibold text-foreground",
        className,
      )}
      {...rest}
    />
  );
}

/** Props for DropdownMenuSeparator. */
export type DropdownMenuSeparatorProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Divider line inside dropdown menu.
 *
 * @param props - Component props.
 * @returns Separator markup.
 */
export function DropdownMenuSeparator(props: DropdownMenuSeparatorProps) {
  const { className, ...rest } = props;
  return (
    <div className={cn("-mx-1 my-1 h-px bg-border/60", className)} {...rest} />
  );
}

/** Submenu context. */
interface SubContextValue {
  subOpen: boolean;
  setSubOpen: React.Dispatch<React.SetStateAction<boolean>>;
}
const SubContext = React.createContext<SubContextValue | null>(null);

/** Props for DropdownMenuSub component. */
export interface DropdownMenuSubProps {
  children: React.ReactNode;
}

/**
 * Root container for dropdown sub-menu.
 *
 * @param props - Submenu container props.
 * @returns Submenu root markup.
 */
export function DropdownMenuSub(props: DropdownMenuSubProps) {
  const [subOpen, setSubOpen] = React.useState(false);

  return (
    <SubContext.Provider value={{ subOpen, setSubOpen }}>
      <div className="relative">{props.children}</div>
    </SubContext.Provider>
  );
}

/** Submenu trigger. */
export const DropdownMenuSubTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const { className, children, ...rest } = props;
  const ctx = React.useContext(SubContext);

  return (
    <div
      ref={ref}
      role="menuitem"
      tabIndex={0}
      aria-haspopup="true"
      aria-expanded={ctx?.subOpen ?? false}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          ctx?.setSubOpen((prev) => !prev);
        } else if (e.key === "Escape") {
          ctx?.setSubOpen(false);
        }
      }}
      onClick={() => ctx?.setSubOpen((prev) => !prev)}
      className={cn(
        "flex cursor-pointer select-none items-center justify-between rounded-sm px-2 py-1.5 text-xs outline-hidden hover:bg-accent hover:text-accent-foreground [&_svg]:size-3.5",
        className,
      )}
      {...rest}
    >
      <span>{children}</span>
      <ChevronRight className="size-3.5 ml-auto text-muted-foreground" />
    </div>
  );
});
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

/** Submenu popup content. */
export const DropdownMenuSubContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const { className, children, ...rest } = props;
  const ctx = React.useContext(SubContext);

  if (!ctx?.subOpen) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "absolute left-full top-0 ml-1 z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md backdrop-blur-md animate-in fade-in-80",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";
