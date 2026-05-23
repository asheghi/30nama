import { createServerFn } from "@tanstack/react-start";
import {
  type ActionBody,
  createInterfaceDirectTransport,
} from "@30nama/api";
import type {
  ProxyEnvelope,
  SerializableJson,
} from "./hana-api";

// interface.30nama.com is a separate backend from hana-api. We only need
// it for `full_search` right now — hana-api's search variants don't accept
// type/orderby filters, but the website's `full_search` does. Same envelope
// shape as hana-api, different headers + base URL (see
// `createInterfaceDirectTransport`).

const transport = createInterfaceDirectTransport();

export interface CallInterfaceInput {
  action: string;
  body?: ActionBody;
  token?: string | null;
}

export const callInterfaceApi = createServerFn({ method: "POST" })
  .inputValidator((input: CallInterfaceInput): CallInterfaceInput => {
    if (!input || typeof input.action !== "string" || !input.action) {
      throw new Error("callInterfaceApi: action is required");
    }
    return {
      action: input.action,
      body: input.body ?? {},
      token: input.token ?? null,
    };
  })
  .handler(async ({ data }): Promise<ProxyEnvelope> => {
    const env = await transport.call<SerializableJson>(
      data.action,
      data.body ?? {},
      { token: data.token },
    );
    return env as ProxyEnvelope;
  });
