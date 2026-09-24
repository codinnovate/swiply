"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { FormInput } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";

type Values = { email: string };

export function ForgotPasswordForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>();

  const submit = handleSubmit(async (values) => {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Unable to continue");
      toast.success("Check the backend console for your 6-digit code");
      router.push(`/reset-password?email=${encodeURIComponent(values.email.trim())}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to continue");
    } finally {
      setBusy(false);
    }
  });

  return (
    <form onSubmit={submit} className="space-y-5">
      <FormInput
        name="email"
        label="Email address"
        type="email"
        placeholder="you@company.com"
        autoComplete="email"
        register={register}
        required
        rules={{ required: "Enter your email" }}
        error={errors.email?.message}
      />
      <Button className="w-full" size="lg" disabled={busy}>
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <>
            Send reset code
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link className="font-semibold text-foreground hover:text-primary" href="/login">
          Log in
        </Link>
      </p>
    </form>
  );
}
