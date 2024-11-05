import { generateHandler } from "../util";
import { SlackOnboardPayload } from "../types";
import { Onboard } from "./Onboard";

export const handler = generateHandler<SlackOnboardPayload>(
  async (payload: SlackOnboardPayload) => {
    const onboard = new Onboard();
    await onboard.invoke(payload);
  }
);
