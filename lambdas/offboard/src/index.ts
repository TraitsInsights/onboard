import { generateHandler, SubsetApiGatewayProxyEvent } from "@shared/util";
import { SlackOffboardPayload } from "@shared/types";
import { Offboard } from "./Offboard";

export const handler = generateHandler(
  async (event: SubsetApiGatewayProxyEvent) => {
    if (!event.body) {
      throw new Error("no body present");
    }

    const body = decodeURIComponent(event.body);
    const payload = body
      ?.split("&")
      .reduce<SlackOffboardPayload>((acc, curr) => {
        const [property, value] = curr.split(/=(.+)/);

        return {
          ...acc,
          [property]: value,
        };
      }, {} as SlackOffboardPayload);
    
    if (!payload) {
      throw new Error("payload could not be decoded");
    }

    const onboard = new Offboard();
    await onboard.invoke(payload);
  }
);
