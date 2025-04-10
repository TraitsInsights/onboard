import { CognitoIdentityProvider } from "@aws-sdk/client-cognito-identity-provider";
import {
  ExecuteStatementCommandInput,
  RDSData,
} from "@aws-sdk/client-rds-data";
import axios from "axios";
import { InitRDSPayload } from "@shared/types";

const cognito = new CognitoIdentityProvider();
const rdsData = new RDSData();

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

export class InitRDS {
  async invoke(input: InitRDSPayload) {
    try {
      const userPool = await cognito.describeUserPool({
        UserPoolId: input.userPoolId,
      });

      if (!userPool.UserPool) {
        throw new Error("User pool not found");
      }

      const listUserPoolClientsData = await cognito.listUserPoolClients({
        UserPoolId: input.userPoolId,
      });

      if (
        !listUserPoolClientsData ||
        !listUserPoolClientsData.UserPoolClients ||
        listUserPoolClientsData.UserPoolClients.length === 0
      ) {
        throw new Error("No user pool clients found");
      }

      const appClientId = listUserPoolClientsData.UserPoolClients[0].ClientId;
      const userPoolDomain = userPool.UserPool.Domain;

      if (!appClientId) {
        throw new Error("No app client ID found");
      }

      if (!userPoolDomain) {
        throw new Error("No user pool domain found");
      }

      await executeStatement({
        sql: `
          UPDATE public.tenant
          SET cognito_user_pool_id = :cognito_user_pool_id,
              cognito_app_client_id = :cognito_app_client_id,
              cognito_domain = :cognito_domain
          WHERE id = :tenant_id
        `,
        parameters: [
          { name: "tenant_id", value: { stringValue: input.tenantId } },
          {
            name: "cognito_user_pool_id",
            value: { stringValue: input.userPoolId },
          },
          {
            name: "cognito_app_client_id",
            value: { stringValue: appClientId },
          },
          {
            name: "cognito_domain",
            value: { stringValue: userPoolDomain },
          },
        ],
      });

      await this.sendSlackMessage(
        this.getSuccessMessage(
          input.tenantName,
          input.tenantId,
          input.userPoolId
        )
      );
    } catch (error: any) {
      console.error("Error during onboarding process:", error);
      await this.sendSlackMessage(
        this.getErrorMessage(input.tenantName, error.message)
      );
    }
  }

  getErrorMessage(tenantName: string, error: string) {
    return `⚠️ *Failed to onboard tenant ${tenantName}* ⚠️\n\n*Error:* ${error}`;
  }

  getSuccessMessage(tenantName: string, tenantId: string, userPoolId: string) {
    return `🎉 *Client Onboarded!* 🎉\n\n*Name:* ${tenantName}\n*ID:* ${tenantId}\n*URL:* ${tenantName}.traitsinsights.app\n\nYou can add a new user here: https://eu-west-1.console.aws.amazon.com/cognito/v2/idp/user-pools/${userPoolId}/users/create/user?region=eu-west-1`;
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
