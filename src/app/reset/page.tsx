import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const dynamic = "force-dynamic";

interface Params {
  searchParams: { token?: string };
}

export default function ResetPasswordPage({ searchParams }: Params) {
  const token = typeof searchParams.token === "string" ? searchParams.token : "";
  return <ResetPasswordForm token={token} />;
}
