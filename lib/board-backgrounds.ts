export const DEFAULT_BG = "linear-gradient(135deg, #1e40af, #2563eb)";

export interface BgPreset {
  label: string;
  value: string;
}

export const GRADIENT_PRESETS: BgPreset[] = [
  { label: "Océano",      value: "linear-gradient(135deg, #1e3a8a, #0ea5e9)" },
  { label: "Aurora",      value: "linear-gradient(135deg, #4c1d95, #7c3aed, #2563eb)" },
  { label: "Amanecer",    value: "linear-gradient(135deg, #7c2d12, #ea580c, #fbbf24)" },
  { label: "Bosque",      value: "linear-gradient(135deg, #14532d, #16a34a, #4ade80)" },
  { label: "Crepúsculo",  value: "linear-gradient(135deg, #831843, #be185d, #f97316)" },
  { label: "Medianoche",  value: "linear-gradient(135deg, #0f172a, #1e293b, #334155)" },
  { label: "Esmeralda",   value: "linear-gradient(135deg, #064e3b, #0f766e, #2dd4bf)" },
  { label: "Rosa",        value: "linear-gradient(135deg, #500724, #be123c, #fb7185)" },
  { label: "Índigo",      value: "linear-gradient(135deg, #1e1b4b, #4338ca, #818cf8)" },
  { label: "Dorado",      value: "linear-gradient(135deg, #451a03, #b45309, #fcd34d)" },
  { label: "Ciruela",     value: "linear-gradient(135deg, #3b0764, #7e22ce, #c084fc)" },
  { label: "Antártico",   value: "linear-gradient(135deg, #0c4a6e, #0369a1, #38bdf8)" },
];

export const SOLID_PRESETS: BgPreset[] = [
  { label: "Pizarra",    value: "#334155" },
  { label: "Gris",       value: "#4b5563" },
  { label: "Rojo",       value: "#b91c1c" },
  { label: "Naranja",    value: "#c2410c" },
  { label: "Ámbar",      value: "#b45309" },
  { label: "Lima",       value: "#3f6212" },
  { label: "Verde",      value: "#15803d" },
  { label: "Esmeralda",  value: "#0f766e" },
  { label: "Cielo",      value: "#0369a1" },
  { label: "Azul",       value: "#1d4ed8" },
  { label: "Índigo",     value: "#4338ca" },
  { label: "Violeta",    value: "#6d28d9" },
  { label: "Púrpura",    value: "#7e22ce" },
  { label: "Rosa",       value: "#be185d" },
  { label: "Negro",      value: "#111827" },
  { label: "Marino",     value: "#1e3a5f" },
];
