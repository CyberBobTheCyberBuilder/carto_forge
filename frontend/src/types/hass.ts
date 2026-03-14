export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  callService(domain: string, service: string, data?: Record<string, unknown>): void;
  connection: {
    subscribeEvents: (cb: (event: unknown) => void, eventType: string) => void;
  };
}
