const DEV_JWT_SECRET = "kpi-dashboard-dev-secret-change-in-prod";
const DEFAULT_OPENAI_MODEL = "gpt-5.4-nano";

const SECRET_ENV_NAMES = ["DATABASE_URL", "JWT_SECRET", "OPENAI_API_KEY"] as const;

function assertNoPublicSecretEnv() {
  for (const name of SECRET_ENV_NAMES) {
    if (process.env[`NEXT_PUBLIC_${name}`]) {
      throw new Error(`Security misconfiguration: NEXT_PUBLIC_${name} must not be set.`);
    }
  }
}

export function assertDatabaseEnv() {
  assertNoPublicSecretEnv();

  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production.");
  }
}

export function getJwtSecret() {
  assertNoPublicSecretEnv();

  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret === DEV_JWT_SECRET || secret.includes("replace-with")) {
      throw new Error("JWT_SECRET is required in production.");
    }
    return secret;
  }

  return secret || DEV_JWT_SECRET;
}

export function getOpenAiApiKey() {
  assertNoPublicSecretEnv();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("your-openai-api-key")) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  return apiKey;
}

export function getOpenAiModel() {
  assertNoPublicSecretEnv();

  const model = process.env.OPENAI_MODEL?.trim();
  if (!model) return DEFAULT_OPENAI_MODEL;

  if (model.startsWith("sk-")) {
    console.warn("OPENAI_MODEL appears to contain an API key; using the default OpenAI model.");
    return DEFAULT_OPENAI_MODEL;
  }

  return model;
}
