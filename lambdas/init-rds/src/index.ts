import { generateHandler } from "@shared/util";
import { InitRDS } from "./InitRDS";
import { APIGatewayProxyEvent } from "aws-lambda";

export const handler = generateHandler(async (event: APIGatewayProxyEvent) => {
  if (!event.body) {
    throw new Error("no body present");
  }

  if (event.headers["x-api-key"] !== process.env.API_GATEWAY_TOKEN) {
    throw new Error("Not authorized");
  }

  const payload = JSON.parse(event.body);

  const initRDS = new InitRDS();
  await initRDS.invoke(payload);
});
