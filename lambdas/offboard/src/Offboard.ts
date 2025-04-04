import {
  ExecuteStatementCommandInput,
  RDSData,
} from "@aws-sdk/client-rds-data";
import { S3 } from "@aws-sdk/client-s3";
import { SlackOffboardPayload } from "@shared/types";
import axios from "axios";

const s3 = new S3();
const rdsData = new RDSData();

const executeStatement = (
  schema: string,
  parameters: Omit<
    ExecuteStatementCommandInput,
    "secretArn" | "resourceArn" | "formatRecordsAs" | "schema"
  >
) => {
  return rdsData.executeStatement({
    secretArn: process.env.RDS_SECRET_ARN!,
    resourceArn: process.env.RDS_CLUSTER_ARN!,
    formatRecordsAs: "JSON",
    schema,
    ...parameters,
  });
};

export class Offboard {
  async invoke(input: SlackOffboardPayload) {
    try {
      const { token } = input;

      if (token !== process.env.SLACK_VERIFICATION_TOKEN) {
        throw new Error("Invalid verification token");
      }

      await this.sendSlackMessage(this.getInProgressMessage(input.text));

      const tenantName = input.text;

      const { transactionId } = await rdsData.beginTransaction({
        secretArn: process.env.RDS_SECRET_ARN!,
        resourceArn: process.env.RDS_CLUSTER_ARN!,
      });

      const tenant = await executeStatement("public", {
        transactionId,
        sql: `
        DELETE FROM tenant
        WHERE name = :tenant_name
        RETURNING id, data_provider_id
      `,
        parameters: [
          { name: "tenant_name", value: { stringValue: tenantName } },
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
      const dataProviderId = response[0].data_provider_id;

      await executeStatement(dataProviderId, {
        transactionId,
        sql: `
        DELETE FROM tenant
        WHERE id = :tenant_id
      `,
        parameters: [{ name: "tenant_id", value: { stringValue: tenantId } }],
      });

      await this.deleteS3Directory("traits-app", `deployments/${tenantId}`);

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

      await rdsData.commitTransaction({
        secretArn: process.env.RDS_SECRET_ARN!,
        resourceArn: process.env.RDS_CLUSTER_ARN!,
        transactionId,
      });

      await this.sendSlackMessage(this.getSuccessMessage(tenantName, tenantId));
    } catch (e) {
      console.error(e);
      await this.sendSlackMessage(this.getErrorMessage(input.text));
    }
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

  getErrorMessage(tenantName: string) {
    return `⚠️ *Failed to offboard tenant ${tenantName}* ⚠️`;
  }

  getInProgressMessage(tenantName: string) {
    return `🔄 *Client offboarding in Progress* 🔄\n\n*Name:* ${tenantName}\n\nThe tenant offboarding process has started. Please wait for the confirmation message.`;
  }

  getSuccessMessage(tenantName: string, tenantId: string) {
    return `🎉 *Client offboarded!* 🎉\n\n*Name:* ${tenantName}\n*ID:* ${tenantId}\n\nThe tenant has been offboarded and all data has been deleted.`;
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
