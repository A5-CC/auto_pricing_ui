export const prefix = process.env.NEXT_PUBLIC_BASE_PATH ?? "/auto_analyst_ui";

export const withPrefix = (p: string) => `${prefix}${p}`;
