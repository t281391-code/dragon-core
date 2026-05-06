"use client";

import { usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { mutate as mutateSWR } from "swr";
import { useThemeMode } from "@/components/ThemeProvider";
import { useEscapeClose } from "@/hooks/useEscapeClose";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AccessibilityMode = "default" | "low-vision" | "color-blind";
type AccessibilityIntent = {
  mode: AccessibilityMode;
  response: string;
};

type AgentResponse = {
  message?: string;
  error?: string;
  toolResults?: { tool?: string; result?: unknown }[];
};

const SUGGESTED_PROMPTS = [
  "Minii heltsees KPI summary",
  "Baga uldegdultei material",
  "Unuudriin uildverlel",
];

const WAREHOUSE_WRITE_TOOLS = new Set(["add_material_transaction", "delete_material_transaction"]);
const PRODUCTION_WRITE_TOOLS = new Set(["add_production_log", "delete_production_log"]);

function refreshDashboardData(toolResults?: AgentResponse["toolResults"]) {
  if (!toolResults?.length) return;

  const touchedWarehouse = toolResults.some((item) => item.tool && WAREHOUSE_WRITE_TOOLS.has(item.tool));
  const touchedProduction = toolResults.some((item) => item.tool && PRODUCTION_WRITE_TOOLS.has(item.tool));

  if (touchedWarehouse) {
    void mutateSWR("/api/materials");
    void mutateSWR("/api/materials/transactions?limit=200");
    void mutateSWR("/api/materials/stats");
  }

  if (touchedProduction) {
    void mutateSWR("/api/production-logs?limit=180");
    void mutateSWR("/api/materials");
  }

  if (touchedWarehouse || touchedProduction) {
    window.dispatchEvent(new CustomEvent("dragon-ai-data-change", {
      detail: {
        warehouse: touchedWarehouse,
        production: touchedProduction,
      },
    }));
  }
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  "\u0430": "a",
  "\u0431": "b",
  "\u0432": "v",
  "\u0433": "g",
  "\u0434": "d",
  "\u0435": "e",
  "\u0451": "yo",
  "\u0436": "j",
  "\u0437": "z",
  "\u0438": "i",
  "\u0439": "i",
  "\u043a": "k",
  "\u043b": "l",
  "\u043c": "m",
  "\u043d": "n",
  "\u043e": "o",
  "\u04e9": "o",
  "\u043f": "p",
  "\u0440": "r",
  "\u0441": "s",
  "\u0442": "t",
  "\u0443": "u",
  "\u04af": "u",
  "\u0444": "f",
  "\u0445": "h",
  "\u0446": "ts",
  "\u0447": "ch",
  "\u0448": "sh",
  "\u0449": "sh",
  "\u044a": "",
  "\u044b": "i",
  "\u044c": "",
  "\u044d": "e",
  "\u044e": "yu",
  "\u044f": "ya",
};

function normalizeCommand(value: string) {
  return value
    .toLowerCase()
    .split("")
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectAccessibilityIntent(command: string): AccessibilityIntent | null {
  const text = normalizeCommand(command);
  const asksToReset =
    /\b(std|standard|standart|default|reset|hevii|heviin|hewi|hewiin|hewin|engiin|butsaa|bolio|off)\b/.test(text)
    || /\b(text|useg|font)\b.*\b(jijig|bagasga|bagasgah|huuchin|heviin|hewiin)\b/.test(text)
    || /\b(haraa|harah|ungu|ongo|color)\b.*\b(heviin|hewiin|reset|butsaa|bolio)\b/.test(text);

  if (asksToReset) {
    return { mode: "default", response: "Heviin mode ruu butsaalaa." };
  }

  const asksLowVision = (
    /\b(haraa|harah|haraanii|haragdahgui|unshigdahgui)\b/.test(text)
    && /\b(muu|tom|tomruul|tomruulaad|ihesge|useg|text|font)\b/.test(text)
  ) || /\b(text|useg|font)\b.*\b(tom|tomruul|ihesge)\b/.test(text);

  if (asksLowVision) {
    return { mode: "low-vision", response: "Haraa muu mode asaalaa. Text, table, tovchluuruud tom bolloo." };
  }

  const asksColorBlind = /\b(ungu yalgadaggui|ungu yalgadaggvi|ongo yalgadaggui|ongo yalgadaggvi|ungu yalga|ongo yalga|color blind|colorblind|dalton|e mongolia|emongolia)\b/.test(text);
  if (asksColorBlind) {
    return { mode: "color-blind", response: "Ungu yalgadaggui mode asaalaa. Palette-iig E-Mongolia shig ondor contrasttai bolgoloo." };
  }

  return null;
}

export function AiAgentWidget() {
  const pathname = usePathname();
  const { setAccessibilityMode } = useThemeMode();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Sain baina. Project deer yu hiilgeh ve? Write/delete action deer confirm code asuuna.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEscapeClose(open, () => setOpen(false));

  if (pathname.startsWith("/agent")) return null;

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || busy) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    const accessibilityIntent = detectAccessibilityIntent(trimmed);

    if (accessibilityIntent) {
      setAccessibilityMode(accessibilityIntent.mode);
      setMessages([...nextMessages, { role: "assistant", content: accessibilityIntent.response }]);
      setInput("");
      return;
    }

    setMessages(nextMessages);
    setInput("");
    setBusy(true);

    try {
      const response = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = (await response.json()) as AgentResponse;
      if (response.ok) refreshDashboardData(data.toolResults);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: response.ok ? data.message ?? "Done." : data.error ?? "AI Agent failed." },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: error instanceof Error ? error.message : "AI Agent failed." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="topbar-ai-widget">
      <button
        className={`topbar-ai-button${open ? " active" : ""}`}
        type="button"
        aria-label="AI Agent"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        AI
      </button>

      {open ? (
        <section className="topbar-ai-panel" aria-label="AI Agent">
          <div className="topbar-ai-panel__head">
            <div>
              <div className="topbar-ai-panel__title">AI Agent</div>
              <div className="topbar-ai-panel__sub">Dragon City project</div>
            </div>
            <button type="button" aria-label="Close AI Agent" onClick={() => setOpen(false)}>
              x
            </button>
          </div>

          <div className="topbar-ai-panel__messages">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`topbar-ai-msg topbar-ai-msg--${message.role}`}>
                <div className="topbar-ai-msg__role">{message.role === "assistant" ? "AI" : "You"}</div>
                <div className="topbar-ai-msg__body">{message.content}</div>
              </div>
            ))}
            {busy ? (
              <div className="topbar-ai-msg topbar-ai-msg--assistant">
                <div className="topbar-ai-msg__role">AI</div>
                <div className="topbar-ai-msg__body">Ajillaj baina...</div>
              </div>
            ) : null}
          </div>

          <div className="topbar-ai-suggestions" aria-label="Suggested AI prompts">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} disabled={busy}>
                {prompt}
              </button>
            ))}
          </div>

          <form className="topbar-ai-composer" onSubmit={submit}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="AI aas asuuh..."
              rows={2}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
            />
            <button type="submit" disabled={busy || input.trim().length === 0}>
              Send
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
