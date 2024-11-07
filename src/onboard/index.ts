import { generateHandler } from "../util";
import { SlackOnboardPayload } from "../types";
import { Onboard } from "./Onboard";
import { APIGatewayProxyEvent } from "aws-lambda";

export const handler = generateHandler(async (event: APIGatewayProxyEvent) => {
  if (!event.body) {
    throw new Error("no body present");
  }

  const body = decodeURIComponent(event.body);
  const payload = body?.split("&").reduce<SlackOnboardPayload>((acc, curr) => {
    const [property, value] = curr.split(/=(.+)/);

    return {
      ...acc,
      [property]: value,
    };
  }, {} as SlackOnboardPayload);

  if (!payload) {
    throw new Error("payload could not be decoded");
  }

  const onboard = new Onboard();
  await onboard.invoke(payload);
});
