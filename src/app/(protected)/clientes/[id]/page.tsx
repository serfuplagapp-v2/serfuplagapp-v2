import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Mail, MapPin, Phone, Trash2 } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  deleteBranch,
  deleteClient,
  deleteContact,
  updateClient,
  createBranch,
  createContact,
} from "../actions";
import { ClientForm } from "../client-form";
import { BranchForm } from "../branch-form";
import { ContactForm } from "../contact-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireEnabledProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, rut, type, notes")
    .eq("id", id)
    .maybeSingle();

  if (!client) notFound();

  const [{ data: branches }, { data: contacts }] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name, address")
      .eq("client_id", id)
      .order("name"),
    supabase
      .from("contacts")
      .select(
        "id, name, role, phone, email, branch_id, es_destinatario, es_cc, recibe_whatsapp",
      )
      .eq("client_id", id)
      .order("orden")
      .order("name"),
  ]);

  const branchList = branches ?? [];
  const contactList = contacts ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link href="/clientes">
            <ChevronLeft className="size-4" />
            Volver a clientes
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
      </div>

      {/* Datos del cliente */}
      <Card>
        <CardHeader>
          <CardTitle>Datos del cliente</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ClientForm
            action={updateClient.bind(null, client.id)}
            defaultValues={client}
            submitLabel="Guardar cambios"
          />
          <div className="border-t pt-4">
            <form action={deleteClient.bind(null, client.id)}>
              <ConfirmSubmit
                variant="outline"
                size="sm"
                message="¿Eliminar este cliente? Se borrarán también sus sucursales y contactos. Esta acción no se puede deshacer."
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4" />
                Eliminar cliente
              </ConfirmSubmit>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Sucursales */}
      <Card>
        <CardHeader>
          <CardTitle>Sucursales</CardTitle>
          <CardDescription>
            Direcciones donde se ejecuta el servicio ({branchList.length}).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {branchList.length > 0 && (
            <ul className="flex flex-col divide-y rounded-lg border">
              {branchList.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{b.name}</p>
                    {b.address && (
                      <p className="text-muted-foreground flex items-center gap-1 text-sm">
                        <MapPin className="size-3.5" />
                        {b.address}
                      </p>
                    )}
                  </div>
                  <form action={deleteBranch.bind(null, b.id, client.id)}>
                    <ConfirmSubmit
                      variant="ghost"
                      size="icon"
                      message={`¿Eliminar la sucursal "${b.name}"?`}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-4" />
                    </ConfirmSubmit>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <BranchForm action={createBranch.bind(null, client.id)} />
        </CardContent>
      </Card>

      {/* Contactos */}
      <Card>
        <CardHeader>
          <CardTitle>Contactos</CardTitle>
          <CardDescription>
            Personas con quienes se coordina ({contactList.length}).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {contactList.length > 0 && (
            <ul className="flex flex-col divide-y rounded-lg border">
              {contactList.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">
                      {c.name}
                      {c.role && (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · {c.role}
                        </span>
                      )}
                    </p>
                    <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="size-3.5" />
                          {c.phone}
                        </span>
                      )}
                      {c.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="size-3.5" />
                          {c.email}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.es_destinatario && <Badge variant="secondary">Destinatario</Badge>}
                      {c.es_cc && <Badge variant="muted">CC</Badge>}
                      {c.recibe_whatsapp && <Badge variant="success">WhatsApp</Badge>}
                    </div>
                  </div>
                  <form action={deleteContact.bind(null, c.id, client.id)}>
                    <ConfirmSubmit
                      variant="ghost"
                      size="icon"
                      message={`¿Eliminar el contacto "${c.name}"?`}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-4" />
                    </ConfirmSubmit>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <ContactForm
            action={createContact.bind(null, client.id)}
            branches={branchList.map((b) => ({ id: b.id, name: b.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
