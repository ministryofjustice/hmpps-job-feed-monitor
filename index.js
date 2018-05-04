const AWS = require('aws-sdk');
const ECS = new AWS.ECS({region: 'eu-west-2'});

exports.handler = (event, context) => {
	// AWS Lambda handler function
}

exports.run = async () => {
	const listTasks = await ECS.listTasks({
		cluster: 'wp-dev',
		family: 'hmpps-job-feed-parser-task',
		desiredStatus: 'stopped'
	}).promise();

	if (listTasks.taskArns.length == 0) {
		sendError("We didn't find any stopped containers");
		process.exit(0);
	}

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

const sendError = (message) => {
	console.error(message);
	// Also to slack
}
