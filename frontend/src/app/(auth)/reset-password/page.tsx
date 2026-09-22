import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPassword() {
  return (
    <div className="w-full">
      <h1 className="font-display text-4xl font-semibold">Reset password.</h1>
      <p className="mb-8 mt-2 text-muted-foreground">
        Use the 6-digit code from the backend console, then choose a new password.
      </p>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
