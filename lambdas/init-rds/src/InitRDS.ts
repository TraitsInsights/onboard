import AWS from "aws-sdk";
import axios from "axios";
import { InitRDSPayload } from "@shared/types";

const cognito = new AWS.CognitoIdentityServiceProvider();
const rdsData = new AWS.RDSDataService();

export class InitRDS {
  async invoke(input: InitRDSPayload) {
    const userPoolData = await cognito
      .describeUserPool({ UserPoolId: input.userPoolId })
      .promise();

    if (!userPoolData || !userPoolData.UserPool?.Domain) {
      throw new Error("No user pool found");
    }

    const domain = userPoolData.UserPool.Domain;

    const listUserPoolClientsData = await cognito
      .listUserPoolClients({ UserPoolId: input.userPoolId })
      .promise();

    if (
      !listUserPoolClientsData ||
      !listUserPoolClientsData.UserPoolClients ||
      listUserPoolClientsData.UserPoolClients.length === 0
    ) {
      throw new Error("No user pool clients found");
    }

    const appClientId = listUserPoolClientsData.UserPoolClients[0].ClientId;

    if (!appClientId) {
      throw new Error("No app client ID found");
    }

    const appClientSecretData = await cognito
      .describeUserPoolClient({
        UserPoolId: input.userPoolId,
        ClientId: appClientId,
      })
      .promise();

    if (!appClientSecretData || !appClientSecretData.UserPoolClient) {
      throw new Error("No app client secret found");
    }

    const appClientSecret = appClientSecretData.UserPoolClient.ClientSecret;

    await rdsData
      .executeStatement({
        secretArn: process.env.RDS_SECRET_ARN!,
        resourceArn: process.env.RDS_CLUSTER_ARN!,
        sql: `
        INSERT INTO ids (tenant_id, db_id, host, cognito_url, cognito_client_id, cognito_client_secret)
        VALUES (:tenant_id, :db_id, :host, :cognito_url, :cognito_client_id, :cognito_client_secret)
      `,
        database: process.env.RDS_DATABASE!,
        parameters: [
          { name: "tenant_id", value: { stringValue: input.clientId } },
          { name: "db_id", value: { stringValue: input.clientDbId } },
          { name: "host", value: { stringValue: input.clientName } },
          {
            name: "cognito_url",
            value: {
              stringValue: `https://${domain}.auth.eu-west-1.amazoncognito.com`,
            },
          },
          { name: "cognito_client_id", value: { stringValue: appClientId } },
          {
            name: "cognito_client_secret",
            value: { stringValue: appClientSecret },
          },
        ],
      })
      .promise();

    const slackMessage = {
      channel: "onboard",
      text: `🎉 *Client Onboarded!* 🎉\n\n*Name:* ${input.clientName}\n*ID:* ${input.clientId}\n*URL:* ${input.clientName}.traitsinsights.app\n\nYou can add a new user here: https://eu-west-1.console.aws.amazon.com/cognito/v2/idp/user-pools/${input.userPoolId}/users/create/user?region=eu-west-1`,
    };

    await axios.post("https://slack.com/api/chat.postMessage", slackMessage, {
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  }
}
