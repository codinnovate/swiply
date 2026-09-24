"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
  type UseFormRegister,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const EMPTY_SELECT_VALUE = "__empty__";

interface FieldShellProps {
  id: string;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  className?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

function FieldShell({
  id,
  label,
  description,
  error,
  required,
  className,
  action,
  children,
}: FieldShellProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </Label>
        {action}
      </div>
      {children}
      {(error || description) && (
        <p
          id={`${id}-help`}
          className={cn(
            "text-xs leading-5",
            error ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {error || description}
        </p>
      )}
    </div>
  );
}

interface RegisteredFieldProps<T extends FieldValues> {
  name: FieldPath<T>;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  register: UseFormRegister<T>;
  rules?: RegisterOptions<T, FieldPath<T>>;
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
}: RegisteredFieldProps<T> & Omit<React.ComponentProps<typeof Input>, "name">) {
  const id = `field-${String(name)}`;
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <FieldShell
      id={id}
      label={label}
      description={description}
      error={error}
      required={required}
      className={className}
    >
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
            className="absolute right-2 top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-lg bg-background text-foreground shadow-sm ring-1 ring-border transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50"
          >
            {passwordVisible ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    </FieldShell>
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
}: RegisteredFieldProps<T> &
  Omit<React.ComponentProps<typeof Textarea>, "name">) {
  const id = `field-${String(name)}`;
  return (
    <FieldShell
      id={id}
      label={label}
      description={description}
      error={error}
      required={required}
      className={className}
      action={
        props.maxLength ? (
          <span className="text-xs text-muted-foreground">
            Max {props.maxLength}
          </span>
        ) : null
      }
    >
      <Textarea
        id={id}
        aria-invalid={!!error}
        aria-describedby={description || error ? `${id}-help` : undefined}
        {...register(name, rules)}
        {...props}
      />
    </FieldShell>
  );
}

export type SelectOption = { label: string; value: string };

export function SelectControl({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  invalid,
  size = "default",
}: {
  id?: string;
  value?: string;
  onValueChange(value: string): void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  size?: "default" | "sm";
}) {
  const selectValue =
    value == null || value === "" ? EMPTY_SELECT_VALUE : value;
  return (
    <Select
      value={selectValue}
      onValueChange={(next) =>
        onValueChange(next === EMPTY_SELECT_VALUE ? "" : next)
      }
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        size={size}
        aria-invalid={invalid}
        disabled={disabled}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value || EMPTY_SELECT_VALUE}
            value={option.value || EMPTY_SELECT_VALUE}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FormSelect<T extends FieldValues>({
  name,
  label,
  description,
  error,
  required,
  control,
  rules,
  options,
  className,
  disabled,
  placeholder,
}: {
  name: FieldPath<T>;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  control: Control<T>;
  rules?: RegisterOptions<T, FieldPath<T>>;
  options: SelectOption[];
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const id = `field-${String(name)}`;
  const emptyLabel = options.find((option) => option.value === "")?.label;
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field }) => (
        <FieldShell
          id={id}
          label={label}
          description={description}
          error={error}
          required={required}
          className={className}
        >
          <SelectControl
            id={id}
            value={typeof field.value === "string" ? field.value : ""}
            onValueChange={field.onChange}
            options={options}
            placeholder={placeholder || emptyLabel || "Select an option"}
            disabled={disabled}
            invalid={!!error}
          />
        </FieldShell>
      )}
    />
  );
}
