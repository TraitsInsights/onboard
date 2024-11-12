# Onboarding

Lambda functions invoked throughout the process to onboard a new client.

> Check out the [notion document](https://www.notion.so/traitsinsights/Client-Onboard-13ce6565411a8072bd10c68143e89b88) that outlines the onboarding process for an overview of how the lambdas in this repository fit in the larger picture

## Setup

1. Clone the repository

```sh
git clone https://github.com/yourusername/onboarding.git
cd onboarding
```

2. Install the dependencies

```sh
npm install
```

## Structure

This repository comprises of multiple lambda functions, each with their own `package.json` within the `lambdas` directory.

This repository therefore adopts a monorepo structure, without using any monorepo tool, however.

Each lambda has its own dependencies within its `lambdas/*` directory, and is built through the `npm run build` command within the directory. The builds are separate for each lambda.

The root of the repository also has a `package.json` with scripts to help coordinate across all `lambda/*` `package.json` scripts.

The `s3` directory includes a directory per data provider that will be uploaded to `s3` upon onboard of a new client, as well as a `shared` directory which is common to all data providers and is too uploaded to `s3`.

## Lambdas

### onboard

Invoked by the Slack `/onboard` command. Verifies the request via the Slack verification token and responds to the request with the JSON for the modal input.

### interaction

Invoked by Slack whenever an interaction occurs. In this case, it is invoked when the user submits the modal input.

This function then invokes the `init-s3` lambda function as the request from Slack needs to be responded to within 3 seconds in order to close the modal.

### init-s3

This function takes the Slack input and does a few things:

1. Looks up RDS to find the next available tenant/client ID
2. Locates the data provider's default s3 directory contents in the `s3` directory at the root of this repository and uploads it to the `traits-app/deployments/{clientId}` directory
3. Loads the `config.json` file and overrides the default team, competition, and/or season if the Slack input includes overrides, then uploading it to `traits-app/deployments/{clientId}/v2/config.json`
4. Retrieves the logo uploaded to Slack via the modal and uploads it to `traits-app/deployments/{clientId}/assets/club_image.png`
5. Uploads the `s3/{dataProvider}/weights.csv` file to `traits-app/settings/weights/{clientId}.csv`
6. Invokes the `TraitsInsights/infrastructure` GitHub repository's `Add Cognito User Pool` [action workflow](https://github.com/TraitsInsights/infrastructure/actions/workflows/add-cognito-user-pool.yml)

### init-rds

This function is invoked at the conclusion of the `Add Cognito User Pool` GitHub action workflow in the `TraitsInsights/infrastructure` repository.

This function looks up the user pool and associated application client in Cognito and inserts a row into the `traitsproddb.ids` table with the tenant and Cognito details.

At this point, the client is fully onboarded and accessible.

## CI

On push of this repository to `main`, the `Build and Deploy lambdas to S3` action workflow will be triggered.

This workflow will build and zip each lambda and upload them to `traits-lambda-layers/onboard`. The terraform configurations for the lambda functions source the code from this directory.

## Useful Links

- [Slack application](https://api.slack.com/apps/A07U2NURWBT/general)
- [Lambda functions](https://eu-west-1.console.aws.amazon.com/lambda/home?region=eu-west-1#/functions)
- [S3 directory that stores the compressed lambda functions](https://eu-west-1.console.aws.amazon.com/s3/buckets/traits-lambda-layers?region=eu-west-1&bucketType=general&prefix=onboard/&showversions=false)
- [API Gateway](https://eu-west-1.console.aws.amazon.com/apigateway/main/apis/a7bqo16ypf/resources?api=a7bqo16ypf&region=eu-west-1)
- [Lambda function terraform configurations](https://github.com/TraitsInsights/infrastructure/blob/main/terraform/production/onboard.tf)


