import { redirect } from "next/navigation";

export default function Home() {
  // La raíz lleva al panel; si no hay sesión, el layout protegido redirige al login.
  redirect("/panel");
}
