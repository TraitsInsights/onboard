import axios from "axios";
import { RDSData } from "@aws-sdk/client-rds-data";
import { Upload } from "@aws-sdk/lib-storage";
import { S3 } from "@aws-sdk/client-s3";
import fs from "fs";
import { Config, SlackOnboardSubmitPayload } from "@shared/types";
import path from "path";

const s3 = new S3();
const rdsData = new RDSData();

const dbMappings = {
  wyscout: {
    all: 998,
    "wyscout-womens": 997,
    "wyscout-youth": 996,
    "wyscout-mens-youth": 999,
  },
  champion: {
    all: 101,
    "wyscout-womens": 101,
    "wyscout-youth": 101,
    "wyscout-mens": 101,
  },
};

export class InitS3 {
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

    const rawResponse = await rdsData.executeStatement({
      secretArn: process.env.RDS_SECRET_ARN!,
      resourceArn: process.env.RDS_CLUSTER_ARN!,
      sql: `SELECT MAX(tenant_id) as tenant_id FROM traitsproddb.ids;`,
      parameters: [],
      formatRecordsAs: "JSON",
    });

    if (!rawResponse.formattedRecords) {
      throw new Error("Could not get max tenant ID from RDS");
    }

    const response = JSON.parse(rawResponse.formattedRecords);

    const maxClientId = response[0].tenant_id;
    const clientId = maxClientId + 1;

    await this.uploadDirectory(
      `${__dirname}/../../../s3/${dataProvider}`,
      "traits-app",
      `deployments/${clientId}`
    );

    const defaultTeamOverride = values.default_team.default_team_input.value;
    const defaultCompetitionOverride =
      values.default_competition.default_competition_input.value;
    const defaultSeasonOverride =
      values.default_season.default_season_input.value;

    if (
      defaultTeamOverride ||
      defaultCompetitionOverride ||
      defaultSeasonOverride
    ) {
      const configFilePath = path.join(
        __dirname,
        `../../../s3/${dataProvider}/v2/config.json`
      );
      const configFileContent = fs.readFileSync(configFilePath, "utf-8");
      const config: Config = JSON.parse(configFileContent);

      const updatedConfig = {
        ...config,
        CUSTOMER: {
          ...config.CUSTOMER,
          DEFAULT_TEAM: defaultTeamOverride
            ? defaultTeamOverride.trim().replace(/\+/g, " ")
            : config.CUSTOMER.DEFAULT_TEAM,
          DEFAULT_LEAGUE: defaultCompetitionOverride
            ? defaultCompetitionOverride.trim().replace(/\+/g, " ")
            : config.CUSTOMER.DEFAULT_LEAGUE,
          CURRENT_SEASON: defaultSeasonOverride
            ? defaultSeasonOverride.trim().replace(/\+/g, " ")
            : config.CUSTOMER.CURRENT_SEASON,
        },
      };

      await new Upload({
        client: s3,

        params: {
          Bucket: "traits-app",
          Key: `deployments/${clientId}/v2/config.json`,
          Body: JSON.stringify(updatedConfig, null, 2),
          ContentType: "application/json",
        },
      }).done();
    }

    const logoResponse = await axios.get(
      values.logo.logo_upload.files[0].url_private,
      {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        },
        responseType: "arraybuffer",
      }
    );

    await new Upload({
      client: s3,

      params: {
        Bucket: "traits-app",
        Key: `deployments/${clientId}/assets/club_image.png`,
        Body: logoResponse.data,
        ContentType: "image/png",
      },
    }).done();

    const weightsFilePath = path.join(
      __dirname,
      `../../../s3/${dataProvider}/weights.csv`
    );
    const weightsFileContent = fs.readFileSync(weightsFilePath);

    await new Upload({
      client: s3,

      params: {
        Bucket: "traits-app",
        Key: `settings/weights/${clientId}.csv`,
        Body: weightsFileContent,
        ContentType: "text/csv",
      },
    }).done();

    const workflowDispatchUrl = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/${process.env.GITHUB_ACTIONS_WORKFLOW_ID}/dispatches`;
    await axios.post(
      workflowDispatchUrl,
      {
        ref: "main",
        inputs: {
          clientName: values.subdomain.subdomain_input.value,
          clientId: String(clientId),
          clientDbId: String(dbMappings[dataProvider][competitionScope]),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  }

  async uploadDirectory(dir: string, bucket: string, prefix: string) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const fileKey = path.join(prefix, file);

      if (fs.lstatSync(filePath).isDirectory()) {
        await this.uploadDirectory(filePath, bucket, fileKey);
      } else {
        const fileContent = fs.readFileSync(filePath);
        await new Upload({
          client: s3,

          params: {
            Bucket: bucket,
            Key: fileKey,
            Body: fileContent,
          },
        }).done();
      }
    }
  }
}
