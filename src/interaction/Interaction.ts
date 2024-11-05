import axios from "axios";
import { SlackOnboardSubmitPayload } from "../types";

export class Interaction {
  async invoke(input: SlackOnboardSubmitPayload) {
    const { token } = input;

    if (token !== process.env.SLACK_VERIFICATION_TOKEN) {
      throw new Error("Invalid verification token");
    }

    const values = input.view.state.values;

    if (
      values.data_provider.data_provider_selection.selected_option.value !==
      "wyscout"
    ) {
      throw new Error("Only Wyscout is supported");
    }

    await axios.post(
      `${process.env.API_GATEWAY_ENDPOINT}/onboard/init-s3`,
      input,
      {
        headers: {
          Authorization: `Bearer ${process.env.API_GATEWAY_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    return;
  }
}
