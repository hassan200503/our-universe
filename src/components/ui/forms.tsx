"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import type { ActionState } from "@/lib/actions/util";

/**
 * Submits a form to its action without React's automatic reset, so what was
 * typed survives an error message. (`action` stays on the form too, so it
 * still works before the page has hydrated.)
 */
export function useKeepTyped(run: (fd: FormData) => void) {
  const [, start] = useTransition();
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    start(() => run(fd));
  };
}

/** A form bound to a server action, showing its error or success message and resetting on success. */
export function ActionForm({
  action,
  children,
  className = "",
  submit = "Save",
  resetOnSuccess = true,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  submit?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, run, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const onSubmit = useKeepTyped(run);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={run} onSubmit={onSubmit} className={className}>
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn" disabled={pending}>
          {pending ? "Saving…" : submit}
        </button>
        {state?.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        {state?.ok && state.message && (
          <p role="status" className="text-sm text-accent">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

export function Field({ label, name, children, hint, className = "" }: { label: string; name: string; children?: React.ReactNode; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-sm font-semibold">
        {label}
        {hint && <span className="ml-1 font-normal text-muted">{hint}</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function VisibilitySelect({ name = "visibility", defaultValue = "shared" }: { name?: string; defaultValue?: string }) {
  return (
    <select id={name} name={name} defaultValue={defaultValue} className="field">
      <option value="private">🔒 Private — only me</option>
      <option value="shared">💞 Shared — the two of us</option>
      <option value="public">🌍 Public — on my public profile</option>
    </select>
  );
}

export function VisibilityBadge({ v }: { v: string }) {
  const label = v === "private" ? "🔒 Private" : v === "public" ? "🌍 Public" : "💞 Shared";
  return <span className="text-xs text-muted">{label}</span>;
}

/** Runs a server action after confirmation. */
export function ConfirmButton({ onConfirm, label = "Delete", question = "Delete this?", className = "" }: { onConfirm: () => Promise<unknown>; label?: string; question?: string; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(question)) start(async () => void (await onConfirm()));
      }}
      className={`text-xs text-muted hover:text-red-600 ${className}`}
    >
      {pending ? "…" : label}
    </button>
  );
}

export function ActionButton({ onClick, children, className = "" }: { onClick: () => Promise<unknown>; children: React.ReactNode; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => void (await onClick()))} className={className} aria-busy={pending}>
      {children}
    </button>
  );
}
