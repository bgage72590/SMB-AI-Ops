import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { OnboardingWizard } from "@/components/OnboardingWizard";

export default async function OnboardingPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  if (!user.inboundAddress) {
    redirect("/");
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <OnboardingWizard
        inboundAddress={user.inboundAddress}
        userName={user.name}
      />
    </main>
  );
}
