export function printReport() {
  if (typeof window === "undefined") return;
  window.setTimeout(() => window.print(), 80);
}
