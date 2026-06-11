import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  FileCheck2,
  FileText,
  LayoutTemplate,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Trash2,
} from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { santiagoDate, santiagoTime } from "@/lib/datetime";
import {
  deleteBranch,
  deleteClient,
  deleteContact,
  saveEmailTemplate,
  updateBranch,
  updateClient,
  updateContact,
  createBranch,
  createContact,
} from "../actions";
import { ClientForm } from "../client-form";
import { BranchForm } from "../branch-form";
import { ContactForm } from "../contact-form";
import { EmailTemplateForm } from "../email-template-form";
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

  const nowISO = new Date().toISOString();
  const [
    { data: branches },
    { data: contacts },
    { data: contracts },
    { data: proximas },
    { data: certs },
    { data: layouts },
    { data: movs },
    typesRes,
    { data: emailTpl },
  ] = await Promise.all([
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
    supabase
      .from("contracts")
      .select("id, frequency, status, current_price, service_type_id")
      .eq("client_id", id)
      .order("status")
      .limit(20),
    supabase
      .from("services")
      .select("id, scheduled_at, field_status")
      .eq("client_id", id)
      .gte("scheduled_at", nowISO)
      .order("scheduled_at")
      .limit(5),
    supabase
      .from("certificates")
      .select("id, folio, issued_at")
      .eq("client_id", id)
      .order("folio", { ascending: false })
      .limit(5),
    supabase
      .from("layouts")
      .select("id, name, branch_id")
      .eq("client_id", id)
      .limit(10),
    supabase
      .from("movements")
      .select("id, date, amount, status")
      .eq("client_id", id)
      .order("date", { ascending: false })
      .limit(5),
    supabase.from("service_types").select("id, name"),
    supabase
      .from("email_templates")
      .select("to_emails, cc_emails, subject, body")
      .eq("client_id", id)
      .maybeSingle(),
  ]);

  const branchList = branches ?? [];
  const contactList = contacts ?? [];
  const typeName = new Map((typesRes.data ?? []).map((t) => [t.id, t.name]));
  const clp = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });

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

      {/* Resumen operativo (pestañas clave de la ficha v1) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Contratos */}
        <div className="bg-card rounded-xl border p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <FileText className="text-primary size-4" aria-hidden />
            Contratos ({(contracts ?? []).length})
          </h2>
          {(contracts ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin contratos registrados.</p>
          ) : (
            <ul className="divide-y text-sm">
              {(contracts ?? []).map((ct) => (
                <li key={ct.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span>
                    {typeName.get(ct.service_type_id) ?? "Servicio"}
                    {ct.frequency ? ` · ${ct.frequency}` : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {ct.current_price ? clp.format(ct.current_price) : ""}{" "}
                    <Badge variant={ct.status === "vigente" ? "success" : "muted"}>{ct.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Próximas visitas */}
        <div className="bg-card rounded-xl border p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="text-primary size-4" aria-hidden />
            Próximas visitas
          </h2>
          {(proximas ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin visitas agendadas a futuro.</p>
          ) : (
            <ul className="divide-y text-sm">
              {(proximas ?? []).map((s) => (
                <li key={s.id} className="py-1.5">
                  <Link href={`/ordenes/${s.id}`} className="hover:text-primary flex justify-between gap-2 hover:underline">
                    <span>
                      {s.scheduled_at
                        ? `${santiagoDate(s.scheduled_at)} ${santiagoTime(s.scheduled_at)}`
                        : "(sin fecha)"}
                    </span>
                    <span className="text-muted-foreground">{s.field_status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Certificados */}
        <div className="bg-card rounded-xl border p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <FileCheck2 className="text-primary size-4" aria-hidden />
            Últimos certificados
          </h2>
          {(certs ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin certificados emitidos.</p>
          ) : (
            <ul className="divide-y text-sm">
              {(certs ?? []).map((c) => (
                <li key={c.id} className="py-1.5">
                  <Link href={`/terreno/${c.id}`} className="hover:text-primary flex justify-between gap-2 hover:underline">
                    <span className="font-medium">Folio {c.folio}</span>
                    <span className="text-muted-foreground">
                      {c.issued_at ? santiagoDate(c.issued_at) : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Facturación + layouts */}
        <div className="bg-card rounded-xl border p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Receipt className="text-primary size-4" aria-hidden />
            Últimos movimientos
          </h2>
          {(movs ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin movimientos.</p>
          ) : (
            <ul className="divide-y text-sm">
              {(movs ?? []).map((m) => (
                <li key={m.id} className="py-1.5">
                  <Link href={`/comercial/${m.id}`} className="hover:text-primary flex justify-between gap-2 hover:underline">
                    <span>
                      {m.date} · <span className="text-muted-foreground">{m.status}</span>
                    </span>
                    <span className={m.amount < 0 ? "text-destructive font-medium" : "font-medium"}>
                      {clp.format(m.amount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {(layouts ?? []).length > 0 && (
            <p className="text-muted-foreground mt-2 border-t pt-2 text-xs">
              <LayoutTemplate className="mr-1 inline size-3.5" aria-hidden />
              {(layouts ?? []).length} {(layouts ?? []).length === 1 ? "layout" : "layouts"} de este
              cliente en{" "}
              <Link href="/layouts" className="text-primary underline">
                Layouts
              </Link>
              .
            </p>
          )}
        </div>
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
                <li key={b.id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
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
                  </div>
                  <details>
                    <summary className="text-primary cursor-pointer text-xs font-medium select-none">
                      Editar sucursal
                    </summary>
                    <div className="mt-2">
                      <BranchForm
                        action={updateBranch.bind(null, b.id, client.id)}
                        defaultValues={{ name: b.name, address: b.address }}
                      />
                    </div>
                  </details>
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
                  <div className="flex flex-col items-end gap-1">
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
                  </div>
                </li>
              ))}
            </ul>
          )}
          {contactList.length > 0 && (
            <details>
              <summary className="text-primary cursor-pointer text-xs font-medium select-none">
                Editar un contacto existente
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {contactList.map((c) => (
                  <details key={`edit-${c.id}`} className="rounded-lg border px-3 py-2">
                    <summary className="cursor-pointer text-sm select-none">{c.name}</summary>
                    <div className="mt-2">
                      <ContactForm
                        action={updateContact.bind(null, c.id, client.id)}
                        branches={branchList.map((b) => ({ id: b.id, name: b.name }))}
                        defaultValues={{
                          name: c.name,
                          role: c.role,
                          phone: c.phone,
                          email: c.email,
                          branch_id: c.branch_id,
                          es_destinatario: c.es_destinatario,
                          es_cc: c.es_cc,
                          recibe_whatsapp: c.recibe_whatsapp,
                        }}
                      />
                    </div>
                  </details>
                ))}
              </div>
            </details>
          )}
          <ContactForm
            action={createContact.bind(null, client.id)}
            branches={branchList.map((b) => ({ id: b.id, name: b.name }))}
          />
        </CardContent>
      </Card>

      {/* Plantilla de correo (réplica pestaña "Correo" v1) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="text-primary size-4" aria-hidden />
            Plantilla de correo
          </CardTitle>
          <CardDescription>
            A quién y con qué texto se envían los correos de este cliente (certificados y
            avisos de servicio). Si está vacía, se usa el contacto marcado como
            destinatario.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailTemplateForm
            action={saveEmailTemplate.bind(null, client.id)}
            defaultValues={emailTpl}
          />
        </CardContent>
      </Card>
    </div>
  );
}
