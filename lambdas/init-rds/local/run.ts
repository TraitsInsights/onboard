import dotenv from "dotenv";
import { handler } from "../src/index";

dotenv.config({ path: `${__dirname}/../../../.env` });

handler({
  headers: {
    ["x-api-key"]: process.env.SLACK_VERIFICATION_TOKEN,
  },
  body: JSON.stringify({
    clientName: "testClient",
    clientId: 999999,
    clientDbId: 999999,
    userPoolId: "eu-west-1_999999",
  }),
});
