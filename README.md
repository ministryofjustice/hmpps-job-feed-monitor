# HMPPS Job Feed Monitor

This is an AWS Lambda Node.js script which checks whether the HMPPS job feed parser ran successfully. If it didn't run successfully, this script will post an alert message to Slack.

## Requirements

- Node.js 8 (newer versions untested)

## Environment Variables

| Name | Description |
| ---- | ----------- |
| `ECS_CLUSTER` | The ECS cluster which the Task should have run on |
| `LOG_GROUP` | Name of the CloudWatch log group that ECS Task output is sent to |
| `SLACK_WEBHOOK_URL` | [Incoming Webhook](https://api.slack.com/incoming-webhooks) URL that Slack messages should be posted to |
| `TASK_FAMILY` | Name of the task definition family to look for |
| `TZ` | The timezone Node.js should run in, e.g. `Europe/London` |

## Running in AWS Lambda

Lambda should use the handler defined at `exports.handler`.

As per the requirements, this should be run in the Node.js 8.10 runtime.

## Running locally

This script can also be run locally:

1. Clone this git repository.
2. Make sure you're using at least Node.js version 8 ([nvm](https://github.com/creationix/nvm) is useful for this)
3. Install dependencies:  
  
   ```
   npm install
   ```
4. Setup your environment variables:  
	
   ```
   export ECS_CLUSTER="something"
   export SLACK_WEBHOOK_URL="something"
   export TASK_FAMILY="something"
   export LOG_GROUP="something"
   ```
5. Run the script:  
   
   ```
   npm start
   ```