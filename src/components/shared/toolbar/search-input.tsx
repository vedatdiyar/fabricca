"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SearchInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  wrapperClassName?: string;
  iconClassName?: string;
  rightElement?: React.ReactNode;
}

/**
 * Reusable search input with leading magnifier icon. Preserves the
 * `relative` wrapper + `absolute left-2.5 top-1/2 -translate-y-1/2`
 * layout used across toolbars.
 *
 * @param props - Input props plus wrapper styling.
 * @returns Search input markup.
 */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, wrapperClassName, iconClassName, rightElement, ...props }, ref) => {
    return (
      <div className={cn("relative", wrapperClassName)}>
        <Search
          className={cn(
            "absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground",
            iconClassName,
          )}
        />
        <Input
          ref={ref}
          className={cn("pl-8", rightElement ? "pr-8" : "", className)}
          {...props}
        />
        {rightElement}
      </div>
    );
  },
);
SearchInput.displayName = "SearchInput";
