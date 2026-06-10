"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

/**
 * Botón de envío que pide confirmación antes de ejecutar la acción (para
 * borrados). Si el usuario cancela, no envía el formulario.
 */
export function ConfirmSubmit({
  message,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { message: string }) {
  return (
    <Button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
