import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const urlError =
    error === "enlace_invalido"
      ? "El enlace no es válido o expiró. Solicítalo de nuevo."
      : null;

  return <LoginForm urlError={urlError} />;
}
