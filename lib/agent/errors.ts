
export class AgentQuotaError extends Error {
  readonly upgrade = true;
  constructor(message: string) {
    super(message);
    this.name = "AgentQuotaError";
  }
}

export function isAgentQuotaError(err: unknown): err is AgentQuotaError {
  return err instanceof AgentQuotaError;
}
