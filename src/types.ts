export type SlackPayload = {
  type: string;
  user: {
    id: string;
  };
  api_app_id: string;
  token: string;
  trigger_id: string;
};

export type SlackOnboardPayload = SlackPayload;

export type SlackOnboardSubmitPayload = SlackPayload & {
  view: {
    state: {
      values: {
        data_provider: {
          data_provider_selection: {
            selected_option: {
              // value: "wyscout" | "statsbomb" | "champion";
              value: "wyscout";
            };
          };
        };
        competition_scope: {
          competition_scope_selection: {
            selected_option: {
              value:
                | "all"
                | "wyscout-mens"
                | "wyscout-womens"
                | "wyscout-youth";
            };
          };
        };
        logo: {
          logo_upload: {
            files: {
              url_private: string;
            }[];
          };
        };
        subdomain: {
          subdomain_input: {
            value: string;
          };
        };
        default_team: {
          default_team_input: {
            value: string | null;
          };
        };
        default_competition: {
          default_competition_input: {
            value: string | null;
          };
        };
        default_season: {
          default_season_input: {
            value: string | null;
          };
        };
      };
    };
  };
};

export type InitRDSPayload = {
  clientName: string;
  clientId: string;
  clientDbId: string;
  userPoolId: string;
};
