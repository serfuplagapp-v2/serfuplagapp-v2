"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export interface FotoItem {
  path: string;
  url: string; // URL firmada para mostrar
}

/**
 * Captura/sube fotos de la visita al bucket privado `terreno`.
 * Comprime en el teléfono (máx 1600 px, JPEG 80%) antes de subir: rápido
 * incluso con señal mala. Ruta: {tenant}/{service}/{timestamp}.jpg
 */
export function PhotoUpload({
  tenantId,
  serviceId,
  initial,
  onChange,
}: {
  tenantId: string;
  serviceId: string;
  initial: FotoItem[];
  onChange: (paths: string[]) => void;
}) {
  const [fotos, setFotos] = useState<FotoItem[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function compress(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const MAX = 1600;
    const ratio = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.8),
    );
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const nuevas: FotoItem[] = [];
    try {
      for (const file of Array.from(files).slice(0, 10)) {
        const blob = await compress(file);
        const path = `${tenantId}/${serviceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("terreno")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("terreno")
          .createSignedUrl(path, 3600);
        nuevas.push({ path, url: signed?.signedUrl ?? "" });
      }
      const todas = [...fotos, ...nuevas];
      setFotos(todas);
      onChange(todas.map((f) => f.path));
    } catch {
      setError("No se pudo subir la foto. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(path: string) {
    const supabase = createClient();
    await supabase.storage.from("terreno").remove([path]);
    const rest = fotos.filter((f) => f.path !== path);
    setFotos(rest);
    onChange(rest.map((f) => f.path));
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {fotos.map((f) => (
          <div key={f.path} className="group relative aspect-square overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element -- URLs firmadas temporales */}
            <img src={f.url} alt="Foto de la visita" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(f.path)}
              className="bg-destructive absolute top-1 right-1 rounded-full p-1 text-white opacity-80"
              aria-label="Eliminar foto"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="text-muted-foreground hover:border-primary hover:text-primary flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs"
        >
          {busy ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
          {busy ? "Subiendo…" : "Agregar foto"}
        </button>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
