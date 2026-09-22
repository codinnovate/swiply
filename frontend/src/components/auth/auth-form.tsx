"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { FormInput } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";

type Panel = "login" | "forgot" | "reset";
type Values = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  otp: string;
  timezone: string;
};

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<Panel>("login");
  const [otp, setOtp] = useState("");
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    defaultValues: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  });

  const submit = handleSubmit(async (values) => {
    setBusy(true);
    try {
      if (mode === "login" && panel === "forgot") {
        const response = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: values.email }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error?.message || "Unable to continue");
        const nextOtp = typeof body?.data?.otp === "string" ? body.data.otp : "";
        setOtp(nextOtp);
        setValue("otp", nextOtp);
        toast.success(nextOtp ? "Your reset code is on this page" : "If that email exists, a code was sent");
        setPanel("reset");
        return;
      }

      if (mode === "login" && panel === "reset") {
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
        setOtp("");
        setValue("password", "");
        setValue("confirmPassword", "");
        setValue("otp", "");
        setPanel("login");
        return;
      }

      const payload =
        mode === "login" ? { email: values.email, password: values.password } : values;
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Unable to continue");
      toast.success(mode === "login" ? "Welcome back" : "Your workspace is ready");
      router.push("/app");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to continue");
    } finally {
      setBusy(false);
    }
  });

  const loginPanel = mode === "login" ? panel : "register";

  return (
    <form onSubmit={submit} className="space-y-5">
      {mode === "register" && (
        <FormInput
          name="name"
          label="Your name"
          placeholder="Ada Lovelace"
          register={register}
          required
          rules={{ required: "Enter your name", maxLength: { value: 80, message: "Use 80 characters or fewer" } }}
          error={errors.name?.message}
        />
      )}
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
      {loginPanel === "reset" && (
        <>
          {otp && (
            <div className="rounded-2xl border bg-muted/60 px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reset code</p>
              <p className="mt-1 font-mono text-3xl font-semibold tracking-[0.3em]">{otp}</p>
              <p className="mt-2 text-xs text-muted-foreground">Also printed in the backend console. Valid for 15 minutes.</p>
            </div>
          )}
          <FormInput
            name="otp"
            label="Reset code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            register={register}
            required
            rules={{
              required: "Enter the 6-digit code",
              pattern: { value: /^\d{6}$/, message: "Use the 6-digit code" },
            }}
            error={errors.otp?.message}
          />
        </>
      )}
      {loginPanel !== "forgot" && (
        <FormInput
          name="password"
          label={loginPanel === "reset" ? "New password" : "Password"}
          type="password"
          autoComplete={loginPanel === "reset" || mode === "register" ? "new-password" : "current-password"}
          placeholder={loginPanel === "reset" || mode === "register" ? "At least 12 characters" : "Your password"}
          register={register}
          required
          rules={{
            required: loginPanel === "reset" ? "Enter a new password" : "Enter your password",
            minLength:
              loginPanel === "reset" || mode === "register"
                ? { value: 12, message: "Use at least 12 characters" }
                : undefined,
          }}
          error={errors.password?.message}
        />
      )}
      {loginPanel === "reset" && (
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
      )}
      {mode === "login" && loginPanel === "login" && (
        <p className="text-right text-sm">
          <button
            type="button"
            className="font-semibold text-foreground hover:text-primary"
            onClick={() => {
              setOtp("");
              setValue("otp", "");
              setPanel("forgot");
            }}
          >
            Forgot password?
          </button>
        </p>
      )}
      {mode === "register" && <input type="hidden" {...register("timezone")} />}
      <Button className="w-full" size="lg" disabled={busy}>
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <>
            {loginPanel === "forgot"
              ? "Send reset code"
              : loginPanel === "reset"
                ? "Update password"
                : mode === "login"
                  ? "Log in"
                  : "Create account"}
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
      {loginPanel === "login" || mode === "register" ? (
        <>
          <div className="relative py-2 text-center text-xs text-muted-foreground before:absolute before:left-0 before:right-0 before:top-1/2 before:border-t">
            <span className="relative bg-card px-3">or continue with</span>
          </div>
          <Button asChild type="button" variant="outline" className="w-full">
            <a href={`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000/api"}/auth/google`}>
              <svg viewBox="0 0 24 24" className="size-4">
                <path
                  fill="#4285F4"
                  d="M22 12.2c0-.7-.1-1.5-.2-2.2H12v4h5.6a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.5Z"
                />
                <path
                  fill="#34A853"
                  d="M12 22c2.8 0 5.2-.9 6.9-2.4l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10 10 0 0 0 12 22Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.2 13.7a6 6 0 0 1 0-3.4V7.6H2.7a10 10 0 0 0 0 8.8l3.5-2.7Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 6c1.5 0 2.9.5 4 1.6l3-3A10 10 0 0 0 2.7 7.6l3.5 2.7C7 7.8 9.3 6 12 6Z"
                />
              </svg>
              Google
            </a>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? "New to Swiply?" : "Already have an account?"}{" "}
            <Link
              className="font-semibold text-foreground hover:text-primary"
              href={mode === "login" ? "/register" : "/login"}
            >
              {mode === "login" ? "Create an account" : "Log in"}
            </Link>
          </p>
        </>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          <button
            type="button"
            className="font-semibold text-foreground hover:text-primary"
            onClick={() => {
              setOtp("");
              setValue("password", "");
              setValue("confirmPassword", "");
              setValue("otp", "");
              setPanel("login");
            }}
          >
            Back to log in
          </button>
          {loginPanel === "reset" && (
            <>
              {" · "}
              <button
                type="button"
                className="font-semibold text-foreground hover:text-primary"
                onClick={() => {
                  setOtp("");
                  setValue("otp", "");
                  setPanel("forgot");
                }}
              >
                Request another code
              </button>
            </>
          )}
        </p>
      )}
    </form>
  );
}
