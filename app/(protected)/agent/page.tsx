"use client";

import { useMemo, useState, type FormEvent } from "react";
import { DeptTopbar } from "@/components/DeptTopbar";
import { useThemeMode } from "@/components/ThemeProvider";

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
};

const SUGGESTED_PROMPTS = [
  "Minii heltsees harah KPI summary gargaarai",
  "Aguulahiin baga uldegdultei materialuudig haruul",
  "Unuudriin uildverleliin tovch dugnelt gargaarai",
  "Safety incident suuliin medeelel dugne",
];

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
    return {
      mode: "default",
      response: "Heviin mode ruu butsaalaa.",
    };
  }

  const asksLowVision = (
    /\b(haraa|harah|haraanii|haragdahgui|unshigdahgui)\b/.test(text)
    && /\b(muu|tom|tomruul|tomruulaad|ihesge|useg|text|font)\b/.test(text)
  ) || /\b(text|useg|font)\b.*\b(tom|tomruul|ihesge)\b/.test(text);

  if (asksLowVision) {
    return {
      mode: "low-vision",
      response: "Haraa muu mode asaalaa. Text, table, tovchluuruud tom bolloo.",
    };
  }

  const asksColorBlind = /\b(ungu yalgadaggui|ungu yalgadaggvi|ongo yalgadaggui|ongo yalgadaggvi|ungu yalga|ongo yalga|color blind|colorblind|dalton|e mongolia|emongolia)\b/.test(text);
  if (asksColorBlind) {
    return {
      mode: "color-blind",
      response: "Ungu yalgadaggui mode asaalaa. Palette-iig E-Mongolia shig ondor contrasttai bolgoloo.",
    };
  }

  return null;
}

export default function AgentPage() {
  const { setAccessibilityMode } = useThemeMode();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Sain baina. Bi Dragon City KPI data-g unshij tailbarlana. Warehouse/production deer bichih esvel ustgah action hiih bol zaaval confirm code asuuna.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const visibleMessages = useMemo(() => messages, [messages]);

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
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: response.ok ? data.message ?? "Done." : data.error ?? "AI Agent failed.",
        },
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
    <div className="department-warehouse">
      <DeptTopbar icon="AI" title="AI Agent" />
      <div className="agent-shell">
        <section className="agent-chat" aria-label="Dragon City AI Agent chat">
          <div className="agent-chat__messages">
            {visibleMessages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`agent-msg agent-msg--${message.role}`}>
                <div className="agent-msg__role">{message.role === "assistant" ? "AI Agent" : "You"}</div>
                <div className="agent-msg__body">{message.content}</div>
              </div>
            ))}
            {busy ? (
              <div className="agent-msg agent-msg--assistant">
                <div className="agent-msg__role">AI Agent</div>
                <div className="agent-msg__body">Ajillaj baina...</div>
              </div>
            ) : null}
          </div>

          <div className="agent-suggestions" aria-label="Suggested AI prompts">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} disabled={busy}>
                {prompt}
              </button>
            ))}
          </div>

          <form className="agent-composer" onSubmit={submit}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Project deer yu hiilgeh ve..."
              rows={3}
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
      </div>
    </div>
  );
}
