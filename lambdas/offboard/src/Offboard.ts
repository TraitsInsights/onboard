import { RDSData } from "@aws-sdk/client-rds-data";
import { S3 } from "@aws-sdk/client-s3";
import {
  CloudWatchClient,
  GetDashboardCommand,
  PutDashboardCommand,
} from "@aws-sdk/client-cloudwatch";
import { SlackOffboardPayload } from "@shared/types";
import axios from "axios";

const s3 = new S3();
const rdsData = new RDSData();
const cloudwatch = new CloudWatchClient();

export class Offboard {
  async invoke(input: SlackOffboardPayload) {
    const { token } = input;

    if (token !== process.env.SLACK_VERIFICATION_TOKEN) {
      throw new Error("Invalid verification token");
    }

    const tenantName = input.text;

    const results = await rdsData.executeStatement({
      secretArn: process.env.RDS_SECRET_ARN!,
      resourceArn: process.env.RDS_CLUSTER_ARN!,
      sql: `SELECT tenant_id, host FROM traitsproddb.ids WHERE host = :host`,
      parameters: [{ name: "host", value: { stringValue: tenantName } }],
    });

    if (
      !results ||
      !results.records ||
      results.records.length === 0 ||
      results.records[0].length === 0
    ) {
      await this.sendSlackErrorMessage(tenantName);
      return;
    }

    const tenantId = results.records[0][0].longValue;

    if (!tenantId) {
      await this.sendSlackErrorMessage(tenantName);
      return;
    }

    await rdsData.executeStatement({
      secretArn: process.env.RDS_SECRET_ARN!,
      resourceArn: process.env.RDS_CLUSTER_ARN!,
      sql: `DELETE FROM traitsproddb.ids WHERE host = :host`,
      parameters: [{ name: "host", value: { stringValue: tenantName } }],
    });

    await this.deleteS3Directory("traits-app", `deployments/${tenantId}`);
    await s3.deleteObject({
      Bucket: "traits-app",
      Key: `settings/weights/${tenantId}.csv`,
    });

    const workflowDispatchUrl = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/${process.env.GITHUB_ACTIONS_OFFBOARD_WORKFLOW_ID}/dispatches`;
    await axios.post(
      workflowDispatchUrl,
      {
        ref: "main",
        inputs: {
          clientName: tenantName,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const getDashboardCommand = new GetDashboardCommand({
      DashboardName: "production-usage",
    });
    const getDashboardResponse = await cloudwatch.send(getDashboardCommand);

    if (getDashboardResponse.DashboardBody) {
      const dashboardBody = JSON.parse(getDashboardResponse.DashboardBody);

      const tenantVariableIndex = dashboardBody.variables.findIndex(
        (variable: any) => variable.id === "tenant"
      );

      const tenantValues =
        tenantVariableIndex > -1
          ? dashboardBody.variables[tenantVariableIndex].values
          : [];

      const matchingTenantIndex = tenantValues.findIndex(
        (value: any) => value.value === `client_id = ${tenantId}`
      );

      const updatedTenantValues = [
        ...tenantValues.slice(0, matchingTenantIndex),
        ...tenantValues.slice(matchingTenantIndex + 1),
      ];

      const updatedDashboardBody = {
        ...dashboardBody,
        variables: [
          ...dashboardBody.variables.slice(0, tenantVariableIndex),
          {
            ...dashboardBody.variables[tenantVariableIndex],
            values: updatedTenantValues,
          },
          ...dashboardBody.variables.slice(tenantVariableIndex + 1),
        ],
      };

      const updatedDashboardCommand = new PutDashboardCommand({
        DashboardName: "production-usage",
        DashboardBody: JSON.stringify(updatedDashboardBody),
      });

      await cloudwatch.send(updatedDashboardCommand);
    }

    const slackMessage = {
      channel: "onboard",
      text: `🚮 *Client Offboarded!* 🚮\n\n*Name:* ${tenantName}\n*ID:* ${tenantId}\n\nThe client has been offboarded and all data has been deleted.`,
    };

    await axios.post("https://slack.com/api/chat.postMessage", slackMessage, {
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  }

  async deleteS3Directory(bucket: string, prefix: string) {
    const listedObjects = await s3.listObjectsV2({
      Bucket: bucket,
      Prefix: prefix,
    });

    if (
      !listedObjects ||
      !listedObjects.Contents ||
      listedObjects.Contents.length === 0
    )
      return;

    await s3.deleteObjects({
      Bucket: bucket,
      Delete: {
        Objects: listedObjects.Contents.filter(
          (value): value is { Key: string } => !!value
        ).map(({ Key }) => ({ Key })),
      },
    });

    if (listedObjects.IsTruncated) await this.deleteS3Directory(bucket, prefix);
  }

  async sendSlackErrorMessage(tenantName: string) {
    const slackMessage = {
      channel: "onboard",
      text: `⚠️ *Failed to offboard client ${tenantName}* ⚠️\n\nCould not find a client that matches the url https://${tenantName}.traitsinsights.app.`,
    };

    await axios.post("https://slack.com/api/chat.postMessage", slackMessage, {
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  }
}
