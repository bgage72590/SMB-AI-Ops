import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  if (getCurrentUser()) redirect("/");
  return <AuthForm mode="signup" />;
}
