"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type {
  FieldPath,
  FieldValues,
  UseFormRegister,
  RegisterOptions,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface BaseProps<T extends FieldValues> {
  name: FieldPath<T>;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  register: UseFormRegister<T>;
  rules?: RegisterOptions<T>;
  className?: string;
}

export function FormInput<T extends FieldValues>({
  name,
  label,
  description,
  error,
  required,
  register,
  rules,
  className,
  type,
  ...props
}: BaseProps<T> & Omit<React.ComponentProps<typeof Input>, "name">) {
  const id = `field-${name}`;
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={isPassword && passwordVisible ? "text" : type}
          className={cn(isPassword && "pr-14")}
          aria-invalid={!!error}
          aria-describedby={description || error ? `${id}-help` : undefined}
          {...register(name, rules)}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            disabled={props.disabled}
            title={passwordVisible ? "Hide password" : "Show password"}
            aria-label={
              passwordVisible
                ? `Hide ${label.toLowerCase()}`
                : `Show ${label.toLowerCase()}`
            }
            aria-pressed={passwordVisible}
            className="absolute right-2 top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-md bg-background text-foreground shadow-sm ring-1 ring-border transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50"
          >
            {passwordVisible ? (
              <EyeOff className="size-5" aria-hidden="true" />
            ) : (
              <Eye className="size-5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {(error || description) && (
        <p
          id={`${id}-help`}
          className={cn(
            "text-xs text-muted-foreground",
            error && "text-destructive",
          )}
        >
          {error || description}
        </p>
      )}
    </div>
  );
}

export function FormTextarea<T extends FieldValues>({
  name,
  label,
  description,
  error,
  required,
  register,
  rules,
  className,
  ...props
}: BaseProps<T> & Omit<React.ComponentProps<typeof Textarea>, "name">) {
  const id = `field-${name}`;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </label>
        {props.maxLength && (
          <span className="text-xs text-muted-foreground">
            Max {props.maxLength}
          </span>
        )}
      </div>
      <Textarea
        id={id}
        aria-invalid={!!error}
        aria-describedby={description || error ? `${id}-help` : undefined}
        {...register(name, rules)}
        {...props}
      />
      {(error || description) && (
        <p
          id={`${id}-help`}
          className={cn(
            "text-xs text-muted-foreground",
            error && "text-destructive",
          )}
        >
          {error || description}
        </p>
      )}
    </div>
  );
}

export function FormSelect<T extends FieldValues>({
  name,
  label,
  description,
  error,
  required,
  register,
  rules,
  options,
  className,
  ...props
}: BaseProps<T> &
  React.ComponentProps<"select"> & {
    options: { label: string; value: string }[];
  }) {
  const id = `field-${name}`;
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      <select
        id={id}
        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        aria-invalid={!!error}
        {...register(name, rules)}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {(error || description) && (
        <p
          className={cn(
            "text-xs text-muted-foreground",
            error && "text-destructive",
          )}
        >
          {error || description}
        </p>
      )}
    </div>
  );
}
