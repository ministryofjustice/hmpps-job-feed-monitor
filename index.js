const AWS = require('aws-sdk');
const ECS = new AWS.ECS({region: 'eu-west-2'});
const https = require('https');
const url = require('url');

/**
 * Environment variables
 */
const ecsCluster = process.env.ECS_CLUSTER || 'wp-dev';
const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || false;
const taskFamily = process.env.TASK_FAMILY || 'hmpps-job-feed-parser-task';
const logGroup = process.env.LOG_GROUP || 'hmpps-job-feed-parser';

/**
 * AWS Lambda handler function
 */
exports.handler = (event, context, callback) => {
	try {
		exports.run();
		callback();
	}
	catch (e) {
		callback(e);
	}
}

/**
 * Main function
 */
exports.run = async () => {
	console.log(`Looking for stopped ECS Tasks with family '${taskFamily}' on cluster '${ecsCluster}'`);

	// Find stopped ECS Tasks
	const listTasks = await ECS.listTasks({
		cluster: ecsCluster,
		family: taskFamily,
		desiredStatus: 'stopped'
	}).promise();

	if (listTasks.taskArns.length == 0) {
		console.log(`There are no stopped Tasks`);
		await postToSlack(noStoppedTasksErrorMessage());
		return;
	}

	// Check the Task exit codes
	var describeTasks = await ECS.describeTasks({
		cluster: ecsCluster,
		tasks: listTasks.taskArns
	}).promise();

	describeTasks.tasks.forEach((task) => {
		if (task.containers[0].exitCode !== 0) {
			// Non-zero exit code – this container failed to run
			console.log(`WARNING: Task ${task.taskArn} stopped with a non-zero exit code`);
			postToSlack(failedTaskErrorMessage(task));
		}
		else {
			// Zero exit code – this container ran successfully
			let created = new Date(task.createdAt).toLocaleTimeString();
			let stopped = new Date(task.stoppedAt).toLocaleTimeString();
			console.log(`SUCCESS: Task ${task.taskArn} started at ${created} and stopped at ${stopped} with exit code 0`);
		}
	});
}

/**
 * Error Message for No Stopped Tasks
 * Return the message payload to post to Slack
 */
const noStoppedTasksErrorMessage = () => {
	const errorMessage = 
			`There are no stopped ECS Tasks belonging to the family \`${taskFamily}\` on cluster \`${ecsCluster}\`.\n\n` +
			`This likely means that the Task we're looking for:\n` +
			`• is still running,\n` +
			`• was never started, or\n` +
			`• ran earlier and was subsequently cleared up by ECS, meaning a record of it no longer exists\n\n` +
			`It may be helpful to look for recent log streams in CloudWatch.`

	const logsUrl = `https://eu-west-2.console.aws.amazon.com/cloudwatch/home?region=eu-west-2#logStream:group=${logGroup}`;

	return {
		text: ':warning: *The job feed (maybe) failed to run!*',
		attachments: [
			{
				fallback: `There are no stopped ECS Tasks matching our criteria`,
				color: 'warning',
				text: errorMessage,
				mrkdwn_in: ['text'],
				actions: [
					{
						type: 'button',
						text: 'Open CloudWatch Logs',
						url: logsUrl,
						style: 'primary'
					}
				]
			}
		]
	};
}

/**
 * Error Message for a Failed Task
 * Return the message payload to post to Slack for the given Task
 */
const failedTaskErrorMessage = (task) => {
	const taskText = "```\n" + JSON.stringify(task, null, 4) + "\n```";
	const taskArn = task.taskArn.match(/^arn:aws:ecs:(.+?):.*task\/(.*)$/i);
	const logsUrl = `https://${taskArn[1]}.console.aws.amazon.com/cloudwatch/home?region=${taskArn[1]}#logEventViewer:group=${logGroup};stream=ecs/app/${taskArn[2]}`;

	let actions = [];
	let fields = [
		{
			title: 'Task ARN',
			value: task.taskArn,
			short: false
		},
		{
			title: 'Created At',
			value: new Date(task.createdAt).toLocaleTimeString(),
			short: true
		},
		{
			title: 'Stopped At',
			value: new Date(task.stoppedAt).toLocaleTimeString(),
			short: true
		},
		{
			title: 'Reason Task Stopped',
			value: task.stoppedReason,
			short: false
		}
	];

	if ('reason' in task.containers[0]) {
		fields.push({
			title: 'Reason Container Stopped',
			value: task.containers[0].reason,
			short: false
		});
	}

	if ('exitCode' in task.containers[0]) {
		fields.push({
			title: 'Container Exit Code',
			value: task.containers[0].exitCode,
			short: false
		});
		actions.push({
			type: 'button',
			text: 'View Log Output',
			url: logsUrl,
			style: 'primary'
		});
	}

	return {
		text: ':warning: *The job feed failed to run!*',
		attachments: [
			{
				fallback: `Details of ECS Task ${task.taskArn}`,
				color: 'warning',
				title: 'ECS Task Details',
				text: taskText,
				mrkdwn_in: ['text'],
				actions: actions,
				fields: fields
			}
		]
	};
}

/**
 * Post a message to Slack
 */
const postToSlack = (payload) => {
	return new Promise((resolve, reject) => {
		if (!slackWebhookUrl) {
			reject(new Error('Unable to post to Slack because the environment variable SLACK_WEBHOOK_URL is not set'));
		}

		payload.icon_emoji = ':ppjfeednotok:';
		const postData = JSON.stringify(payload);
		const slackUrl = url.parse(slackWebhookUrl);

		const postOptions = {
			host: slackUrl.host,
			path: slackUrl.pathname,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(postData)
			}
		};

		console.log('Posting message to Slack: ' + postData);

		// Set up the request
		const request = https.request(postOptions, (response) => {
			const body = [];
			response.on('data', (chunk) => {
				body.push(chunk);
			});
			response.on('end', () => {
				const responseBody = body.join('');
				if (response.statusCode < 200 || response.statusCode > 299) {
					reject(new Error('Failed to post to Slack. Status code: ' + response.statusCode + '. Response body: ' + responseBody));
				}
				else {
					resolve(responseBody);
				}
			});
		});

		request.on('error', (error) => {
			reject(error);
		});

		request.write(postData);
		request.end();
	});
}
