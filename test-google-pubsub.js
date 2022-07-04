// Imports the Google Cloud client library
const {PubSub} = require('@google-cloud/pubsub');


const dotenv = require("dotenv");
dotenv.config({path: __dirname + '/.env'});
const { GOOGLE_SERVICE_ACCOUNT_KEY_FILE_PATH } = process.env;

var GOOGLE_APPLICATION_CREDENTIALS = require(GOOGLE_SERVICE_ACCOUNT_KEY_FILE_PATH);

projectId = GOOGLE_APPLICATION_CREDENTIALS.project_id; // Your Google Cloud Platform project ID
topicName = 'projects/' + projectId + '/topics/limechain-project-token-bridge-validator-signatures'; // Name for the new topic to create
subscriptionName = 'projects/' + projectId + '/subscriptions/limechain-project-token-bridge-validator-signatures-sub' // Name for the new subscription to create

// Instantiates a client
const pubsub = new PubSub({projectId, credentials: GOOGLE_APPLICATION_CREDENTIALS});

maxInProgress = 1;
timeout = 10;
maxInProgress = Number(maxInProgress);
timeout = Number(timeout);

async function subscribeWithFlowControlSettings() {
    const subscriberOptions = {
      flowControl: {
        maxMessages: maxInProgress,
      },
    };

    // References an existing subscription.
    // Note that flow control settings are not persistent across subscribers.
    const subscription = pubsub.subscription(
      subscriptionName,
    //   subscriberOptions
    );

    console.log(
      `Subscriber to subscription ${subscription.name} is ready to receive messages at a controlled volume of ${maxInProgress} messages.`
    );

    const messageHandler = message => {
      console.log(`Received message: ${message.id}`);
      console.log(`\tData: ${message.data}`);
      console.log(`\tAttributes: ${message.attributes}`);

      // "Ack" (acknowledge receipt of) the message
      message.ack();
    };

    subscription.on('message', messageHandler);

    setTimeout(() => {
      subscription.close();
    }, timeout * 1000);
  }


// [END pubsub_subscriber_flow_settings]
subscribeWithFlowControlSettings().catch(console.error);

async function publishMessage(data) {
    // Publishes the message as a string, e.g. "Hello, world!" or JSON.stringify(someObject)
    const dataBuffer = Buffer.from(data);

    try {
      const messageId = await pubsub
        .topic(topicName)
        .publishMessage({data: dataBuffer});
      console.log(`Message ${messageId} published.`);
      await pubsub.topic(topicName).publish(Buffer.from('Test message!'));

    } catch (error) {
      console.error(`Received error while publishing: ${error.message}`);
      process.exitCode = 1;
    }
  }

//   publishMessage(JSON.stringify({foo: 'bar'}));
