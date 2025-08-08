export const prefix = process.env.NEXT_PUBLIC_BASE_PATH ?? "/auto_pricing_ui";

export const withPrefix = (p: string) => `${prefix}${p}`;
