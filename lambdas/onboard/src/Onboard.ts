import axios from "axios";
import { SlackOnboardPayload } from "@shared/types";
export class Onboard {
  async invoke(input: SlackOnboardPayload) {
    const { token, trigger_id } = input;

    if (token !== process.env.SLACK_VERIFICATION_TOKEN) {
      throw new Error("Invalid verification token");
    }

    await axios.post(
      "https://slack.com/api/views.open",
      {
        trigger_id,
        view: {
          type: "modal",
          callback_id: "data_provider_modal",
          title: {
            type: "plain_text",
            text: "Onboard Tenant",
          },
          submit: {
            type: "plain_text",
            text: "Onboard",
          },
          blocks: [
            {
              type: "input",
              block_id: "data_provider",
              element: {
                type: "static_select",
                action_id: "data_provider_selection",
                placeholder: {
                  type: "plain_text",
                  text: "Select a data provider",
                },
                options: [
                  {
                    text: {
                      type: "plain_text",
                      text: "Wyscout",
                    },
                    value: "wyscout",
                  },
                  {
                    text: {
                      type: "plain_text",
                      text: "Champion",
                    },
                    value: "champion",
                  },
                ],
              },
              label: {
                type: "plain_text",
                text: "Data Provider",
              },
            },
            {
              type: "input",
              block_id: "competition_scope",
              element: {
                type: "static_select",
                action_id: "competition_scope_selection",
                placeholder: {
                  type: "plain_text",
                  text: "Select a competition scope",
                },
                options: [
                  {
                    text: {
                      type: "plain_text",
                      text: "All",
                    },
                    value: "all",
                  },
                  {
                    text: {
                      type: "plain_text",
                      text: "Wyscout Mens and Youth Leagues",
                    },
                    value: "wyscout-mens-youth",
                  },
                  {
                    text: {
                      type: "plain_text",
                      text: "Wyscout Womens Leagues",
                    },
                    value: "wyscout-womens",
                  },
                  {
                    text: {
                      type: "plain_text",
                      text: "Wyscout Youth Leagues",
                    },
                    value: "wyscout-youth",
                  },
                ],
              },
              label: {
                type: "plain_text",
                text: "Competition Scope",
              },
            },
            {
              type: "input",
              block_id: "subdomain",
              element: {
                type: "plain_text_input",
                action_id: "subdomain_input",
                placeholder: {
                  type: "plain_text",
                  text: "Enter subdomain",
                },
              },
              label: {
                type: "plain_text",
                text: "Subdomain",
              },
            },
            {
              type: "input",
              block_id: "logo",
              label: {
                type: "plain_text",
                text: "Upload logo",
              },
              element: {
                type: "file_input",
                action_id: "logo_upload",
                filetypes: ["png"],
                max_files: 1,
              },
            },
            {
              type: "input",
              block_id: "default_team",
              optional: true,
              element: {
                type: "plain_text_input",
                action_id: "default_team_input",
                placeholder: {
                  type: "plain_text",
                  text: "Enter default team",
                },
              },
              label: {
                type: "plain_text",
                text: "Default Team",
              },
            },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  }
}
