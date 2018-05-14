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
   
## Running in AWS

A CloudFormation template [`cloudformation-template.yaml`](cloudformation-template.yaml) exists to get this script running on AWS. It will configure the infrastructure required to run this script automatically every night at 12:30am.

### Create a CloudFormation stack

Create a CloudFormation stack using the following steps.

1. Create a ZIP file containing the Lambda function.
   
   In a terminal window, navigate to this git repository and run the following command:
   
   ```
   zip index-$(md5 -q index.js | cut -c1-6).js.zip index.js
   ```
   
   This will create a file called `index-XXXXXX.js.zip` which contains the `index.js` Lambda script.
   
   **Note:** The filename contains a partial MD5 sum to make the ZIP filename unique. This will be useful when deploying future changes to the Lambda function ([more info](#update-a-cloudformation-stack)).
2. Upload `index.js.zip` to an S3 bucket in the `eu-west-2` region. Take note of the bucket name and path of the uploaded file – these will become the `LambdaS3Bucket` and `LambdaS3Key` parameters for our CloudFormation stack.
3. Using the [CloudFormation 'Create Stack' wizard](https://eu-west-2.console.aws.amazon.com/cloudformation/home?region=eu-west-2#/stacks/new), upload the CloudFormation template file `cloudformation-template.yaml` and click Next.
4. Give your stack a name and complete the required parameters.
   
   For example:
   
   | Parameter | Example Value |
   | --------- | ------------- |
   | Stack Name | hmpps-job-feed-monitor-production |
   | EcsCluster | production |
   | LambdaS3Bucket | hmpps-job-feed-monitor-lambda |
   | LambdaS3Key | index.js.zip |
   | LogGroup | hmpps-job-feed-production |
   | SlackWebhookUrl | https://hooks.slack.com/services/XXXXXXX |
   | TaskFamily | hmpps-job-feed-production |
5. On the final page of the wizard, you will be asked to acknowledge that the template may create IAM resources. Check the box to confirm this, and click Create.
6. Once the stack has reached a status of `CREATE_COMPLETED`, remove the `index-XXXXXX.js.zip` file (created in Step 1) from the S3 bucket. It is no longer needed and is safe to delete.

Once completed, the script will run once a night at 12:30 AM using the parameters you provided during stack creation.

### Update a CloudFormation stack

You can change the parameters associated with an existing CloudFormation stack using the 'Update Stack' action. This will allow you to change the environment variables passed to the Lambda function.

To deploy changes to the Lambda function (`index.js` file in this repo), you'll need to upload a new ZIP file to an S3 bucket and update the `LambdaS3Bucket` and `LambdaS3Key` parameters accordingly.

**Note:** The S3 filename/key _must change_ for CloudFormation to re-deploy the Lambda function. This is why it's recommended to include a hash in the filename (as shown in Step 1 above) to ensure it changes when the file is updated.

### Delete a CloudFormation stack

When you delete a CloudFormation stack, all associated AWS resources will also be removed. This includes the CloudWatch log group and associated log streams.

### AWS Resources

The CloudFormation template creates the following resources:

* **Lambda Function** – the main script of this project, `index.js`
* **IAM Role** – the Lambda script will execute under this Role, so it must have permission to access the necessary AWS resources
* **Log Group** – this is where Lambda execution logs will be stored
* **CloudWatch Rule** – this will execute the Lambda script on a schedule (nightly at 12:30 AM)