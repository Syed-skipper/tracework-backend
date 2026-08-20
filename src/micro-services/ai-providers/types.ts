export type AiProviderId = "openrouter";

export type AiErrorCode =
  | "invalid_key"
  | "model_unavailable"
  | "rate_limit"
  | "unreachable"
  | "timeout"
  | "provider_error"
  | "not_configured"
  | "disabled";

export interface AiGenerateRequest {
  model: string;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiGenerateSuccess {
  success: true;
  content: string;
  provider: AiProviderId;
  model: string;
}

export interface AiGenerateFailure {
  success: false;
  errorCode: AiErrorCode;
  message: string;
  provider?: AiProviderId;
  model?: string;
}

export type AiGenerateResult = AiGenerateSuccess | AiGenerateFailure;

export interface AiProvider {
  readonly id: AiProviderId;
  generate(apiKey: string, request: AiGenerateRequest): Promise<AiGenerateResult>;
  testConnection(apiKey: string, model: string): Promise<AiGenerateResult>;
}
