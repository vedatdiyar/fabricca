import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      aria-label={props["aria-label"] ?? "Textarea"}
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs placeholder:text-muted-foreground hover:border-primary/20 focus-visible:outline-none focus-visible:border-primary/30 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
