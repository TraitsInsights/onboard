import { RDSData } from "@aws-sdk/client-rds-data";
import { S3 } from "@aws-sdk/client-s3";
import { SlackOffboardPayload } from "@shared/types";
import axios from "axios";

const s3 = new S3();
const rdsData = new RDSData();

export class Offboard {
  async invoke(input: SlackOffboardPayload) {
    const { token, trigger_id } = input;

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

    if (!results || !results.records) {
      const slackMessage = {
        channel: "test",
        text: `⚠️ *Failed to offboard client ${tenantName}*\n\nCould not find a client that matches the url https://${tenantName}.traitsinsights.app.`,
      };

      await axios.post("https://slack.com/api/chat.postMessage", slackMessage, {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      return;
    }

    const tenantId = results.records[0][0].stringValue;

    // await rdsData.executeStatement({
    //   secretArn: process.env.RDS_SECRET_ARN!,
    //   resourceArn: process.env.RDS_CLUSTER_ARN!,
    //   sql: `DELETE FROM traitsproddb.ids WHERE host = :host`,
    //   parameters: [{ name: "host", value: { stringValue: host } }],
    // });

    await this.deleteS3Directory("traits-app", `deployments/${tenantId}`);
    // await s3.deleteObject({
    //   Bucket: "traits-app",
    //   Key: `settings/weights/${tenantId}.csv`,
    // });

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

    console.log(listedObjects.Contents);

    // await s3.deleteObjects({
    //   Bucket: bucket,
    //   Delete: {
    //     Objects: listedObjects.Contents.filter(
    //       (value): value is { Key: string } => !!value
    //     ),
    //   },
    // });

    if (listedObjects.IsTruncated) await this.deleteS3Directory(bucket, prefix);
  }
}
