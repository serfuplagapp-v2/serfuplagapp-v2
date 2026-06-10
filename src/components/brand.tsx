import { Bug } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Marca de la app (logo + nombre). Identidad heredada de la v1.
 * tone="dark"  → texto oscuro, para fondos claros (tarjeta de login).
 * tone="light" → texto claro, para fondos navy (barra lateral).
 */
export function Brand({
  tone = "dark",
  className,
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="bg-navy text-white inline-flex size-9 items-center justify-center rounded-lg shadow-sm">
        <Bug className="size-5" aria-hidden />
      </span>
      <span className="flex items-baseline gap-1">
        <span
          className={cn(
            "text-lg font-semibold tracking-tight",
            tone === "light" ? "text-white" : "text-foreground",
          )}
        >
          Serfuplagapp
        </span>
        <span
          className={cn(
            "text-xs font-medium",
            tone === "light" ? "text-white/60" : "text-muted-foreground",
          )}
        >
          v2
        </span>
      </span>
    </span>
  );
}
