import { ShieldAlert } from "lucide-react";

import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Pantalla para usuarios autenticados que aún NO tienen empresa ni rol asignado.
 * Corrige por diseño el error de la v1 (todo usuario nuevo terminaba siendo admin):
 * aquí, sin asignación explícita, no hay acceso a ningún dato.
 */
export function CuentaNoHabilitada({
  email,
  name,
}: {
  email: string;
  name: string | null;
}) {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
      <Brand />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Tu cuenta aún no está habilitada</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert>
            <ShieldAlert />
            <AlertTitle>Falta un paso</AlertTitle>
            <AlertDescription>
              Hola{name ? ` ${name}` : ""}, tu cuenta ({email}) se creó
              correctamente, pero todavía no tiene acceso a ninguna empresa. Un
              administrador debe habilitarla. Si crees que es un error, contacta
              a tu administrador.
            </AlertDescription>
          </Alert>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
