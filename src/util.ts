import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const generateHandler =
  (func: (event: APIGatewayProxyEvent) => Promise<any>) =>
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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
