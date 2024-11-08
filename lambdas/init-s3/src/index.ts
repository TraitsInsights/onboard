import { APIGatewayProxyEvent } from "aws-lambda";
import { generateHandler } from "@shared/util";
import { InitS3 } from "./InitS3";

export const handler = generateHandler(async (event: APIGatewayProxyEvent) => {
  console.log("1");
  if (!event.body) {
    throw new Error("no body present");
  }

  const payload = JSON.parse(event.body);

  console.log("2");
  const initS3 = new InitS3();
  console.log("3");
  await initS3.invoke(payload);
});
