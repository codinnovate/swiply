"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { FormInput } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";

type Values = { email: string; otp: string; password: string; confirmPassword: string };

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Values>({
    defaultValues: { email: params.get("email") || "" },
  });

  const submit = handleSubmit(async (values) => {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          otp: values.otp,
          password: values.password,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Unable to reset password");
      toast.success("Password updated. You can log in now.");
      router.push("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reset password");
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
      <FormInput
        name="otp"
        label="Reset code"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="6-digit code"
        register={register}
        required
        rules={{
          required: "Enter the code from the backend console",
          pattern: { value: /^\d{6}$/, message: "Use the 6-digit code" },
        }}
        error={errors.otp?.message}
      />
      <FormInput
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 12 characters"
        register={register}
        required
        rules={{
          required: "Enter a new password",
          minLength: { value: 12, message: "Use at least 12 characters" },
        }}
        error={errors.password?.message}
      />
      <FormInput
        name="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        placeholder="Repeat the new password"
        register={register}
        required
        rules={{
          required: "Confirm the new password",
          validate: (value) => value === watch("password") || "Passwords do not match",
        }}
        error={errors.confirmPassword?.message}
      />
      <Button className="w-full" size="lg" disabled={busy}>
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <>
            Update password
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Need a new code?{" "}
        <Link className="font-semibold text-foreground hover:text-primary" href="/forgot-password">
          Request another
        </Link>
      </p>
    </form>
  );
}
