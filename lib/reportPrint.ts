export function printReport() {
  if (typeof window === "undefined") return;

  const source = document.querySelector<HTMLElement>(".report-print-root");
  if (!source) {
    window.setTimeout(() => window.print(), 80);
    return;
  }

  document.getElementById("report-print-host")?.remove();
  document.getElementById("report-print-style")?.remove();

  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".report-print-actions, .print-hidden").forEach((node) => node.remove());

  const host = document.createElement("div");
  host.id = "report-print-host";
  host.appendChild(clone);

  const style = document.createElement("style");
  style.id = "report-print-style";
  style.textContent = `
    @media print {
      body > :not(#report-print-host) {
        display: none !important;
      }

      #report-print-host,
      #report-print-host * {
        visibility: visible !important;
      }

      #report-print-host {
        display: block !important;
        position: static !important;
        width: 100% !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
    }
  `;

  document.documentElement.classList.add("printing-report");
  document.head.appendChild(style);
  document.body.appendChild(host);

  const cleanup = () => {
    document.documentElement.classList.remove("printing-report");
    host.remove();
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);
  window.setTimeout(() => {
    window.print();
    window.setTimeout(cleanup, 30000);
  }, 80);
}
