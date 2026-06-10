export type CardColorKey =
  | "none" | "slate" | "red" | "orange" | "amber"
  | "lime" | "emerald" | "sky" | "violet" | "pink" | "rose";

interface ColorConfig {
  label: string;
  dot: string;
  border: string;
  bg: string;
}

// All classes must be fully static strings — never template-interpolated — so Tailwind includes them.
export const CARD_COLORS: Record<CardColorKey, ColorConfig> = {
  none:    { label: "Sin color",  dot: "bg-gray-300 dark:bg-gray-600",   border: "",                  bg: "" },
  slate:   { label: "Gris",       dot: "bg-slate-400",                   border: "border-l-slate-400",  bg: "bg-slate-200 dark:bg-slate-700/70" },
  red:     { label: "Rojo",       dot: "bg-red-400",                     border: "border-l-red-400",    bg: "bg-red-100 dark:bg-red-900/60" },
  orange:  { label: "Naranja",    dot: "bg-orange-400",                  border: "border-l-orange-400", bg: "bg-orange-100 dark:bg-orange-900/60" },
  amber:   { label: "Ámbar",      dot: "bg-amber-400",                   border: "border-l-amber-400",  bg: "bg-amber-100 dark:bg-amber-900/60" },
  lime:    { label: "Lima",       dot: "bg-lime-500",                    border: "border-l-lime-500",   bg: "bg-lime-100 dark:bg-lime-900/60" },
  emerald: { label: "Verde",      dot: "bg-emerald-400",                 border: "border-l-emerald-400",bg: "bg-emerald-100 dark:bg-emerald-900/60" },
  sky:     { label: "Cielo",      dot: "bg-sky-400",                     border: "border-l-sky-400",    bg: "bg-sky-100 dark:bg-sky-900/60" },
  violet:  { label: "Violeta",    dot: "bg-violet-500",                  border: "border-l-violet-500", bg: "bg-violet-100 dark:bg-violet-900/60" },
  pink:    { label: "Rosa",       dot: "bg-pink-400",                    border: "border-l-pink-400",   bg: "bg-pink-100 dark:bg-pink-900/60" },
  rose:    { label: "Carmesí",    dot: "bg-rose-400",                    border: "border-l-rose-400",   bg: "bg-rose-100 dark:bg-rose-900/60" },
};

export const COLOR_KEYS = Object.keys(CARD_COLORS) as CardColorKey[];
