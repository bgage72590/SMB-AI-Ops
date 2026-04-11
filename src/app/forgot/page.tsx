import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  if (getCurrentUser()) redirect("/");
  return <ForgotPasswordForm />;
}
