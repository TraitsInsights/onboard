import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export type SubsetApiGatewayProxyEvent = Pick<
  APIGatewayProxyEvent,
  "headers" | "body"
>;

export const generateHandler =
  (func: (event: SubsetApiGatewayProxyEvent) => Promise<any>) =>
  async (event: SubsetApiGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      await func(event);

      return {
        statusCode: 200,
        body: "",
      };
    } catch (e) {
      console.error(e);

      return {
        statusCode: 500,
        body: "",
      };
    }
  };

export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
