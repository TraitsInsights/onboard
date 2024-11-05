import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { generateHandler } from "../util";
import { InitS3 } from "./InitS3";
import { SlackOnboardSubmitPayload } from "../types";

export const handler = generateHandler<SlackOnboardSubmitPayload>(
  async (input: SlackOnboardSubmitPayload) => {
    const initS3 = new InitS3();
    await initS3.invoke(input);
  }
);
