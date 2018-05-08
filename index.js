const AWS = require('aws-sdk');
const ECS = new AWS.ECS({region: 'eu-west-2'});
const url = require('url');
const https = require('https');
const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || false;

exports.handler = (event, context) => {
	// AWS Lambda handler function
}

exports.run = async () => {
	// Find the stopped ECS Task
	const listTasks = await ECS.listTasks({
		cluster: 'wp-dev',
		family: 'hmpps-job-feed-parser-task',
		desiredStatus: 'stopped'
	}).promise();

	if (listTasks.taskArns.length == 0) {
		sendError("We didn't find any stopped containers");
		process.exit(0);
	}

	// Question: do we want to report if the Task is still running?

	// Check the Task's exit code
	var describeTasks = await ECS.describeTasks({
		cluster: 'wp-dev',
		tasks: listTasks.taskArns
	}).promise();

	describeTasks.tasks.forEach((task) => {
		if (task.containers[0].exitCode !== 0) {
			sendError(`Task ${task.taskArn} stopped at ${task.stoppedAt} with a non-zero exit code. Reason: ${task.containers[0].reason}`);
		}
		else {
			console.log(`Task ${task.taskArn} stopped at ${task.stoppedAt} with exit code 0`);
		}
	});
}

const sendError = async (message) => {
	console.log('Sending message to Slack: ' + message);
	try {
		await postToSlack(message);
	}
	catch (e) {
		console.error('ERROR: ' + e.message);
	}
}

const postToSlack = (message) => {
	return new Promise((resolve, reject) => {
		if (!slackWebhookUrl) {
			reject(new Error('Unable to post to Slack because environment variable SLACK_WEBHOOK_URL is not set'));
		}

		const postData = JSON.stringify({
			text: message
		});

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

		request.on('error', (e) => {
			reject(e);
		});

		request.write(postData);
		request.end();
	});
}
