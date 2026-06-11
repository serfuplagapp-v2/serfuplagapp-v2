"use client";

import { LogOut } from "lucide-react";

import { signOut } from "@/app/(auth)/actions";

/** Botón "cerrar sesión" para la cabecera navy (estilo #btn-logout de la v1). */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="flex items-center gap-1.5 rounded-md border border-white/20 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/75 transition-colors hover:bg-white/15"
      >
        <LogOut className="size-3.5" aria-hidden />
        Cerrar sesión
      </button>
    </form>
  );
}
