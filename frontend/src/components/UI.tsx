import type { ReactNode } from "react";
import {
  AudioLines,
  ArrowUpRight,
  LoaderCircle,
  Inbox,
  Languages,
} from "lucide-react";
import { languages, type Language } from "../../../shared/types";
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={"brand " + (small ? "small" : "")}>
      <span className="brand-mark">
        <AudioLines size={23} />
      </span>
      <span>
        meetmind<span className="brand-ai">AI</span>
      </span>
    </div>
  );
}
export function Button({
  children,
  onClick,
  variant = "",
  disabled = false,
  type = "button",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  return (
    <button
      type={type}
      title={title}
      className={"btn " + variant}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function LanguageSelect({
  value,
  onChange,
}: {
  value: Language;
  onChange: (v: Language) => void;
}) {
  return (
    <label className="lang">
      <Languages size={16} />
      <select
        aria-label="Display language"
        value={value}
        onChange={(e) => onChange(e.target.value as Language)}
      >
        {Object.entries(languages).map(([key, name]) => (
          <option key={key} value={key}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Loading({
  text = "Getting everything ready…",
}: {
  text?: string;
}) {
  return (
    <div className="loading">
      <LoaderCircle className="spin" />
      {text}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div className="error" role="alert">
      {message}
    </div>
  ) : null;
}
export function SectionTitle({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}
export function Pill({
  children,
  kind = "",
}: {
  children: ReactNode;
  kind?: string;
}) {
  return <span className={"pill " + kind}>{children}</span>;
}
export function duration(seconds: number) {
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}
export function date(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
export function TextList({
  items,
  empty = "Nothing recorded yet.",
}: {
  items: string[];
  empty?: string;
}) {
  return items.length ? (
    <ul className="text-list">
      {items.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ul>
  ) : (
    <p className="muted small-text">{empty}</p>
  );
}
export function GoIcon() {
  return <ArrowUpRight size={17} />;
}
