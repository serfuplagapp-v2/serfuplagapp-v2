import { CheckCircle2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PanelPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inicio</h1>
        <p className="text-muted-foreground">Bienvenido a Serfuplagapp v2.</p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="text-success size-5" aria-hidden />
            Todo funcionando
          </CardTitle>
          <CardDescription>
            Tu inicio de sesión y la conexión con la base de datos están
            operativos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Esta es la <strong>Fase 0 (fundaciones)</strong>. Los módulos
            —planificador, comercial y servicios en terreno— se construirán en
            las próximas fases del plan.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
