import { Suspense } from "react";
import { AutomationSetup } from "@/components/app/automation-setup";

export default function AutomationSetupPage() {
  return (
    <Suspense fallback={null}>
      <AutomationSetup />
    </Suspense>
  );
}
