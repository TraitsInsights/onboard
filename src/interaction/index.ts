import { generateHandler } from "../util";
import { SlackOnboardSubmitPayload } from "../types";
import { Interaction } from "./Interaction";

export const handler = generateHandler<{ payload: string }>(
  async (input: { payload: string }) => {
    const payload = JSON.parse(input.payload) as SlackOnboardSubmitPayload;
    const interaction = new Interaction();
    await interaction.invoke(payload);
  }
);
