import axios from "axios";
import { SlackOnboardSubmitPayload } from "@shared/types";
import { sleep } from "@shared/util";

export class Interaction {
  async invoke(input: SlackOnboardSubmitPayload) {
    const { token } = input.payload;

    if (token !== process.env.SLACK_VERIFICATION_TOKEN) {
      throw new Error("Invalid verification token");
    }

    const values = input.payload.view.state.values;
    const dataProvider =
      values.data_provider.data_provider_selection.selected_option.value;
    const competitionScope =
      values.competition_scope.competition_scope_selection.selected_option
        .value;

    if (!["wyscout", "champion"].some((value) => value === dataProvider)) {
      throw new Error("wyscout and champion are supported");
    }

    if (dataProvider === "champion") {
      if (competitionScope !== "all") {
        throw new Error("champion only supports all competitions");
      }
    }

    // This may be better replaced with an SQS message for replayability, but for now we make the API request
    // and throw the request away so that the Slack modal will close
    axios.post(`${process.env.API_GATEWAY_ENDPOINT}/init-s3`, input, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    await sleep(500);

    return;
  }
}
