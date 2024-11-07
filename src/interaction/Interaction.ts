import axios from "axios";
import { SlackOnboardSubmitPayload } from "../types";

export class Interaction {
  async invoke(input: SlackOnboardSubmitPayload) {
    const { token } = input.payload;

    if (token !== process.env.SLACK_VERIFICATION_TOKEN) {
      throw new Error("Invalid verification token");
    }

    const values = input.payload.view.state.values;

    if (
      values.data_provider.data_provider_selection.selected_option.value !==
      "wyscout"
    ) {
      throw new Error("Only Wyscout is supported");
    }

    // This may be better replaced with an SQS message for replayability, but for now we make the API request
    // and throw the request away so that the Slack modal will close
    axios.post(`${process.env.API_GATEWAY_ENDPOINT}/init-s3`, input, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return;
  }
}
