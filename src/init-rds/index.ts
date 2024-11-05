import { generateHandler } from "../util";
import { InitRDSPayload } from "../types";
import { InitRDS } from "./InitRDS";

export const handler = generateHandler(async (input: InitRDSPayload) => {
  const initRDS = new InitRDS();
  await initRDS.invoke(input);
});
