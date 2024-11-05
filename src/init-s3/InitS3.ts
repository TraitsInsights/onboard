import axios from "axios";
import AWS from "aws-sdk";
import fs from "fs";
import { SlackOnboardSubmitPayload } from "../types";
import path from "path";
const s3 = new AWS.S3();

const dbMappings = {
  all: 99,
  "wyscout-womens": 32,
  "wyscout-youth": 75,
  "wyscout-mens": 99,
};

export class InitS3 {
  async invoke(input: SlackOnboardSubmitPayload) {
    const values = input.view.state.values;

    const params = {
      Bucket: "traits-app",
      Prefix: "deployments/",
    };

    const data = await s3.listObjectsV2(params).promise();

    if (!data.Contents) {
      throw new Error("No deployment directories found");
    }

    const folderNames = data.Contents.map((item) =>
      item.Key ? item.Key.split("/")[2] : "0"
    ).filter((folder) => /^\d+$/.test(folder));

    const maxClientId = Math.max(...folderNames.map(Number));
    const clientId = maxClientId + 1;

    await this.uploadDirectory(
      "s3/wyscout",
      "traits-app",
      `deployments/${clientId}`
    );

    const logoResponse = await axios.get(
      values.logo.logo_upload.files[0].url_private,
      {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        },
        responseType: "arraybuffer",
      }
    );

    await s3
      .upload({
        Bucket: "traits-app",
        Key: `deployments/${clientId}/assets/club_image.png`,
        Body: logoResponse.data,
        ContentType: "image/png",
      })
      .promise();

    const weightsFilePath = path.join("s3", "wyscout", "weights.csv");
    const weightsFileContent = fs.readFileSync(weightsFilePath);

    await s3
      .upload({
        Bucket: "traits-app",
        Key: `settings/weights/${clientId}.csv`,
        Body: weightsFileContent,
        ContentType: "text/csv",
      })
      .promise();

    const workflowDispatchUrl = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/add-cognito-user-pool/dispatches`;
    await axios.post(
      workflowDispatchUrl,
      {
        ref: "main",
        clientName: values.subdomain.subdomain_input.value,
        clientId: clientId,
        clientDbId:
          dbMappings[
            values.competition_scope.competition_scope_selection.selected_option
              .value
          ],
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
        await s3
          .upload({
            Bucket: bucket,
            Key: fileKey,
            Body: fileContent,
          })
          .promise();
      }
    }
  }
}
