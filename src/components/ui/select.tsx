import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Selector simple basado en el <select> nativo (funciona perfecto dentro de
 * formularios y es liviano). Estilizado al tema v1.
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          "border-input flex h-11 w-full appearance-none rounded-md border bg-card px-3 pr-9 text-base shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        aria-hidden
      />
    </div>
  );
}

export { Select };
