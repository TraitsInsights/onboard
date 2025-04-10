import axios from "axios";
import {
  ExecuteStatementCommandInput,
  RDSData,
} from "@aws-sdk/client-rds-data";
import { Upload } from "@aws-sdk/lib-storage";
import { S3 } from "@aws-sdk/client-s3";
import fs from "fs";
import { SlackOnboardSubmitPayload } from "@shared/types";
import path from "path";

const s3 = new S3();
const rdsData = new RDSData();

const competitionCategory: {
  wyscout: { [key: string]: string[] };
  champion: { [key: string]: string[] };
} = {
  wyscout: {
    all: ["default", "mens-seniors", "mens-youth", "womens"],
    "wyscout-mens-youth": ["mens-seniors", "mens-youth"],
    "wyscout-youth": ["mens-youth"],
    "wyscout-womens": ["womens"],
  },
  champion: {
    all: ["default"],
  },
};

const defaultTeam: {
  wyscout: { [key: string]: string };
  champion: { [key: string]: string };
} = {
  wyscout: {
    all: "Chelsea FC",
    "wyscout-mens-youth": "Chelsea FC",
    "wyscout-youth": "Chelsea FC Under 21",
    "wyscout-womens": "Chelsea LFC",
  },
  champion: {
    all: "AFC",
  },
};

const minimumMinutes: {
  wyscout: number;
  champion: number;
} = {
  wyscout: 300,
  champion: 240,
};

const executeStatement = (
  parameters: Omit<
    ExecuteStatementCommandInput,
    "secretArn" | "resourceArn" | "formatRecordsAs"
  >
) => {
  return rdsData.executeStatement({
    secretArn: process.env.RDS_SECRET_ARN!,
    resourceArn: process.env.RDS_CLUSTER_ARN!,
    database: process.env.RDS_DATABASE!,
    formatRecordsAs: "JSON",
    ...parameters,
  });
};

export class InitS3 {
  async invoke(input: SlackOnboardSubmitPayload) {
    try {
      const { token } = input.payload;

      if (token !== process.env.SLACK_VERIFICATION_TOKEN) {
        throw new Error("Invalid verification token");
      }

      const values = input.payload.view.state.values;

      const name = values.subdomain.subdomain_input.value;

      await this.sendSlackMessage(this.getInProgressMessage(name));

      const dataProvider =
        values.data_provider.data_provider_selection.selected_option.value;
      const competitionScope =
        dataProvider === "champion"
          ? "all"
          : values.competition_scope.competition_scope_selection.selected_option
              .value;
      const defaultTeamOverride = values.default_team.default_team_input.value;

      const { transactionId } = await rdsData.beginTransaction({
        secretArn: process.env.RDS_SECRET_ARN!,
        resourceArn: process.env.RDS_CLUSTER_ARN!,
        database: process.env.RDS_DATABASE!,
      });

      const tenant = await executeStatement({
        transactionId,
        sql: `
          INSERT INTO public.tenant (name, data_provider_id)
          VALUES (:name, :data_provider_id)
          RETURNING id
        `,
        parameters: [
          { name: "name", value: { stringValue: name } },
          { name: "data_provider_id", value: { stringValue: dataProvider } },
        ],
      });

      if (!tenant.formattedRecords) {
        throw new Error("Failed to insert public tenant");
      }

      const response = JSON.parse(tenant.formattedRecords);

      if (response.length === 0) {
        throw new Error("Failed to insert public tenant");
      }

      const tenantId = response[0].id;

      await executeStatement({
        transactionId,
        sql: `
          INSERT INTO ${dataProvider}.tenant (id, default_team_id, framework_id, participation_minimum_minutes)
          SELECT :id, team.id, framework.id, :participation_minimum_minutes
          FROM ${dataProvider}.team, ${dataProvider}.framework
          WHERE team.name = :default_team_name AND framework.name = 'default'
          RETURNING id
        `,
        parameters: [
          { name: "id", value: { stringValue: tenantId } },
          {
            name: "default_team_name",
            value: {
              stringValue:
                defaultTeamOverride ||
                defaultTeam[dataProvider][competitionScope],
            },
          },
          {
            name: "participation_minimum_minutes",
            value: { longValue: minimumMinutes[dataProvider] },
          },
        ],
      });

      await executeStatement({
        transactionId,
        sql: `
          INSERT INTO ${dataProvider}.tenant_competition_category_permission (tenant_id, competition_category_id)
          SELECT :tenant_id, competition_category.id
          FROM ${dataProvider}.competition_category
          WHERE competition_category.name = ANY(string_to_array(:competition_category_names, ','))
        `,
        parameters: [
          {
            name: "tenant_id",
            value: { stringValue: tenantId },
          },
          {
            name: "competition_category_names",
            value: {
              stringValue:
                competitionCategory[dataProvider][competitionScope].join(","),
            },
          },
        ],
      });

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
          Key: `deployments/${tenantId}/assets/club_image.png`,
          Body: logoResponse.data,
          ContentType: "image/png",
        },
      }).done();

      const workflowDispatchUrl = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/${process.env.GITHUB_ACTIONS_WORKFLOW_ID}/dispatches`;

      await axios.post(
        workflowDispatchUrl,
        {
          ref: "main",
          inputs: {
            tenantId: String(tenantId),
            tenantName: values.subdomain.subdomain_input.value,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      await rdsData.commitTransaction({
        secretArn: process.env.RDS_SECRET_ARN!,
        resourceArn: process.env.RDS_CLUSTER_ARN!,
        transactionId,
      });
    } catch (error: any) {
      console.error(error);
      await this.sendSlackMessage(
        this.getErrorMessage(
          input.payload.view.state.values.subdomain.subdomain_input.value,
          error.message
        )
      );
    }
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

  getErrorMessage(tenantName: string, error: string) {
    return `⚠️ *Failed to onboard tenant ${tenantName}* ⚠️\n\n*Error:* ${error}`;
  }

  getInProgressMessage(tenantName: string) {
    return `🔄 *Client onboarding in Progress* 🔄\n\n*Name:* ${tenantName}\n\nThe tenant onboarding process has started. Please wait for the confirmation message.`;
  }

  async sendSlackMessage(text: string) {
    const slackMessage = {
      channel: "onboard",
      text,
    };

    await axios.post("https://slack.com/api/chat.postMessage", slackMessage, {
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  }
}
