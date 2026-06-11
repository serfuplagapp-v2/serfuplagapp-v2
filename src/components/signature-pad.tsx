"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Lienzo de firma (dedo o lápiz, pensado para el celular del técnico).
 * Entrega la firma como PNG base64 vía onChange; null si está vacío.
 */
export function SignaturePad({
  initial,
  onChange,
}: {
  initial?: string | null;
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(!initial);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Ajustar el tamaño interno al CSS (nitidez en pantallas retina).
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1A1F2C";
    if (initial) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = initial;
    }
    // El canvas se inicializa una sola vez (la firma previa solo al montar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (empty) setEmpty(false);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && !empty) onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="h-40 w-full touch-none rounded-lg border-2 border-dashed bg-white"
        aria-label="Firma del cliente"
      />
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">
          {empty ? "El cliente firma aquí con el dedo." : "Firma registrada."}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          <Eraser className="size-4" />
          Borrar
        </Button>
      </div>
    </div>
  );
}
