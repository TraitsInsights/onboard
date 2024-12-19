import dotenv from "dotenv";
import { handler } from "../src/index";

dotenv.config({ path: `${__dirname}/../../../.env` });

handler({
  headers: {
    ["x-api-key"]: process.env.SLACK_VERIFICATION_TOKEN,
  },
  body: `text=lewis-test&token=${process.env.SLACK_VERIFICATION_TOKEN}`,
});
