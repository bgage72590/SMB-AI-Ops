import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const dynamic = "force-dynamic";

interface Params {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage(props: Params) {
  const searchParams = await props.searchParams;
  const token = typeof searchParams.token === "string" ? searchParams.token : "";
  return <ResetPasswordForm token={token} />;
}
