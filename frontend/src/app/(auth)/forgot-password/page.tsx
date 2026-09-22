import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPassword() {
  return (
    <div className="w-full">
      <h1 className="font-display text-4xl font-semibold">Forgot password.</h1>
      <p className="mb-8 mt-2 text-muted-foreground">
        Enter your email and we will print a 6-digit code in the backend console.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}
