"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { AuthState } from "./auth-state";

/** Traduce los mensajes de error de Supabase (en inglés) a español de Chile. */
function traducirError(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed"))
    return "Debes confirmar tu correo antes de entrar. Revisa tu bandeja de entrada.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Ya existe una cuenta con este correo.";
  if (m.includes("password should be at least"))
    return "La contraseña es demasiado corta.";
  if (m.includes("unable to validate email") || m.includes("invalid format"))
    return "El correo no tiene un formato válido.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  if (m.includes("for security purposes"))
    return "Por seguridad, espera unos segundos antes de volver a intentarlo.";
  return "Ocurrió un error. Inténtalo nuevamente en unos momentos.";
}

/** URL base del sitio, para construir los enlaces de los correos. */
async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Iniciar sesión con correo y contraseña. */
export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y tu contraseña.", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: traducirError(error.message), success: null };
  }

  revalidatePath("/", "layout");
  redirect("/panel");
}

/** Crear una cuenta nueva. */
export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!fullName || !email || !password) {
    return { error: "Completa todos los campos.", success: null };
  }
  if (password.length < 8) {
    return {
      error: "La contraseña debe tener al menos 8 caracteres.",
      success: null,
    };
  }
  if (password !== confirm) {
    return { error: "Las contraseñas no coinciden.", success: null };
  }

  const supabase = await createClient();
  const base = await getBaseUrl();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${base}/auth/callback`,
    },
  });

  if (error) {
    return { error: traducirError(error.message), success: null };
  }

  // Si la confirmación por correo está desactivada, ya hay sesión: entrar directo.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/panel");
  }

  return {
    error: null,
    success:
      "¡Cuenta creada! Te enviamos un correo para confirmarla. Ábrelo y haz clic en el enlace para activar tu cuenta.",
  };
}

/** Cerrar sesión. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/** Enviar correo para recuperar la contraseña. */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Ingresa tu correo.", success: null };
  }

  const supabase = await createClient();
  const base = await getBaseUrl();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/auth/callback?next=/actualizar-clave`,
  });

  // No revelamos si el correo existe o no (buena práctica de seguridad).
  return {
    error: null,
    success:
      "Si el correo está registrado, te enviamos un enlace para crear una nueva contraseña. Revisa tu bandeja de entrada.",
  };
}

/** Guardar la nueva contraseña (tras abrir el enlace del correo de recuperación). */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return {
      error: "La contraseña debe tener al menos 8 caracteres.",
      success: null,
    };
  }
  if (password !== confirm) {
    return { error: "Las contraseñas no coinciden.", success: null };
  }

  const supabase = await createClient();

  // El enlace de recuperación debe haber creado una sesión. Si no, avisamos claro.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error:
        "El enlace expiró o no es válido. Solicita uno nuevo desde “Recuperar contraseña”.",
      success: null,
    };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: traducirError(error.message), success: null };
  }

  revalidatePath("/", "layout");
  redirect("/panel");
}
