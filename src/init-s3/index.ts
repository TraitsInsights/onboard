import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { generateHandler } from "../util";
import { InitS3 } from "./InitS3";
import { SlackOnboardSubmitPayload } from "../types";

export const handler = generateHandler(
  async (event: APIGatewayProxyEvent) => {
    if (!event.body) {
        throw new Error("no body present");
      }

    const payload = JSON.parse(event.body)

    const initS3 = new InitS3();
    await initS3.invoke(payload);
  }
);
