import { generateHandler } from "@shared/util";
import { SlackOnboardSubmitPayload } from "@shared/types";
import { Interaction } from "./Interaction";
import { APIGatewayProxyEvent } from "aws-lambda";

export const handler = generateHandler(async (event: APIGatewayProxyEvent) => {
  if (!event.body) {
    throw new Error("no body present");
  }

  const body = decodeURIComponent(event.body);
  const payload = body
    ?.split("&")
    .reduce<SlackOnboardSubmitPayload>((acc, curr) => {
      const [property, value] = curr.split(/=(.+)/);

      const decodedValue = JSON.parse(decodeURIComponent(value));

      return {
        ...acc,
        [property]: decodedValue,
      };
    }, {} as SlackOnboardSubmitPayload);

  const interaction = new Interaction();
  await interaction.invoke(payload);
});
