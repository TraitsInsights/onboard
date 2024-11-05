import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const generateHandler =
  <Payload = any>(func: (event: Payload) => Promise<any>) =>
  async (event: Payload): Promise<APIGatewayProxyResult> => {
    try {
      await func(event);

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "success",
        }),
      };
    } catch (e) {
      console.error(e);

      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "error",
        }),
      };
    }
  };
