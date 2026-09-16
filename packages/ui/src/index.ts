import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "quiet";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function buttonClassName(variant: ButtonVariant = "primary") {
  const variants = {
    primary: "button button-primary",
    secondary: "button button-secondary",
    quiet: "button button-quiet"
  };

  return variants[variant];
}
