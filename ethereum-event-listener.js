const dotenv = require("dotenv");
dotenv.config({path: __dirname + '/.env'});
const { INFURA_API_KEY, PRIVATE_KEY, GOOGLE_SERVICE_ACCOUNT_KEY_FILE_PATH } = process.env;

// Imports the Google Cloud client library
const initializeApp = require("firebase/app").initializeApp;
const getDatabase = require("firebase/database").getDatabase;
const ref = require("firebase/database").ref;
const push = require("firebase/database").push;
const set = require("firebase/database").set;

const Web3 = require('web3');
const EthereumEvents = require('ethereum-events');

const ethers = require('ethers');

const myWallet = new ethers.Wallet(PRIVATE_KEY, ethers.getDefaultProvider())
console.log("Signing signatures with address: " + myWallet.address);

ERC20_ABI = require("./ABIs/ERC20.json");
TOKEN_BRIDGE_ABI = require("./ABIs/TokenBridge.json");

const WEB3_PROVIDER_RINKEBY = new Web3.providers.HttpProvider('https://rinkeby.infura.io/v3/' + INFURA_API_KEY) /* Your web3 provider (e.g. geth, Infura) */;
const WEB3_PROVIDER_ROPSTEN = new Web3.providers.HttpProvider('https://ropsten.infura.io/v3/' + INFURA_API_KEY) /* Your web3 provider (e.g. geth, Infura) */;

const contractsRinkeby = [
  {
    name: 'Token Bridge',
    address: '0x7686680Dd6Bd185D7B47913040CD440D217B53Dd',
    abi: TOKEN_BRIDGE_ABI,
    events: ['Lock', 'Burn'] // optional event filter (default: all events)
}
];

const contractsRopsten = [
  {
    name: 'Token Bridge',
    address: '0x5155bE53a3144BAf6D2D8a3123Ac1914d5FDF76F',
    abi: TOKEN_BRIDGE_ABI,
    events: ['Lock', 'Burn'] // optional event filter (default: all events)
}
];

const options = {
  pollInterval: 13000, // period between polls in milliseconds (default: 13000)
  confirmations: 2,   // n° of confirmation blocks (default: 12)
  chunkSize: 10000,    // n° of blocks to fetch at a time (default: 10000)
  concurrency: 10,     // maximum n° of concurrent web3 requests (default: 10)
  backoff: 1000        // retry backoff in milliseconds (default: 1000)
};

// See: https://firebase.google.com/docs/web/learn-more#config-object
const firebaseConfig = {
  databaseURL: "https://lime-token-bridge-validator-default-rtdb.europe-west1.firebasedatabase.app/",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
const database = getDatabase(app);


async function publishMessage(data) {
  try {
    console.log("Publishing Validation Signature Message");
    const postListRef = ref(database, 'signatures');
    const newPostRef = push(postListRef);
    await set(newPostRef, data);
  } catch (error) {
    console.error(`Received error while publishing: ${error.message}`);
    // process.exitCode = 1;
  }
}

async function publishEvent(chainId, blockNumber, event){
  let functionName = "";
  if(event.name == "Lock")
      functionName = "lock()"
  else if(event.name == "Burn")
      functionName = "burn()";
  else
      return;

  console.log("Event values:");
  console.log(event.values);

  const data = {
    functionName: functionName,
    chainId: event.values._targetChain,
    tokenAddress: event.name == "Lock"? event.values._token: event.values._tokenNativeAddress,
    receiverAddress: event.name == "Lock"? event.values._owner: event.values._receiver,
    amount: event.values._amount,
    nonce: event.name == "Lock"? event.values._nonce: event.values.nonce,
    }
  
  console.log("Publishing message data:");
  console.log(data);

  const contractAddress = event.values._targetChain == 3? contractsRopsten[0].address : event.values._targetChain == 4? contractsRinkeby[0].address: '0';

  const signature = await createValidSignature(myWallet, contractAddress, data);
  console.log("Generated Signature: " + signature);
  await publishMessage({data: data, signature: signature});
}

async function publishEvents(chainId, blockNumber, events){
  for(i = 0; i < events.length; i++){
    const event = events[i];
    console.log(event.name);
      await publishEvent(chainId, blockNumber, event)
    }
}

async function createValidSignature (_signer, _tokenBridgeContractAddress, message) {
  // console.log(_signer + " " + _tokenBridgeContractAddress + " " + _functionName + " " + _chainId + " " + _tokenAddress + " " + _receiverAddress + " " + _amount + " " + _nonce);

  const domain = {
    name: "Tzikis TokenBridge",
    version: '1',
    verifyingContract: _tokenBridgeContractAddress
  };

  // The named list of all type definitions
  const types = {
    Verify : [ // array of objects -> properties from erc20withpermit
    { name: 'functionName', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'tokenAddress', type: 'address' },
    { name: 'receiverAddress', type: 'address' },
    { name: 'amount', type: 'uint32' },
    { name: 'nonce', type: 'uint32' }
  ]
  };
  // owner, tokenBridgeContractAddress, "lock()", chainId, sampleTokenAddress, owner.address, 105, 1 
  // const message = {
  //   functionName: _functionName, // Wallet Address
  //   chainId: _chainId,
  //   tokenAddress: _tokenAddress, // This is the address of the contract.
  //   receiverAddress: _receiverAddress, // This is the address of the spender whe want to give permit to.
  //   amount: _amount,
  //   nonce: _nonce
  // };

  let signature = await _signer._signTypedData(domain, types, message);
  return signature;
}

async function handleEvents(chainId, blockNumber, events, done){
  if(events.length > 0) {
    console.log("Chain: " + chainId + " - Got Confirmed Events.");
    console.log("Chain: " + chainId + " - Block Number: " + blockNumber);
    // console.log(events);
    await publishEvents(chainId, blockNumber, events, done);
  }
  else {
    console.log(chainId + ": Empty Events list");
  }

  try {
    console.log(chainId + ": Updating Last Block ID - " + blockNumber);
    await set(ref(database, 'last-block-number-' + chainId), blockNumber);
  }
  catch (error) {
    console.error(`Received error while publishing: ${error.message}`);
  }

    done();
}

const web3Rinkeby = new Web3(WEB3_PROVIDER_RINKEBY);
const web3Ropsten = new Web3(WEB3_PROVIDER_ROPSTEN);

const ethereumEventsRinkeby = new EthereumEvents(web3Rinkeby, contractsRinkeby, options);
const ethereumEventsRopsten = new EthereumEvents(web3Ropsten, contractsRopsten, options);

ethereumEventsRinkeby.on('error', err => {
  // An error occured while fetching new blocks/events.
  // A retry will be attempted after backoff interval.
  console.log("ERROR Fetching events!!");

});

ethereumEventsRopsten.on('error', err => {
// An error occured while fetching new blocks/events.
// A retry will be attempted after backoff interval.
console.log("ERROR Fetching events!!");
});

ethereumEventsRinkeby.on('block.confirmed', (blockNumber, events, done) => {
    // Events contained in 'confirmed' blocks are considered final,
    // hence the callback is fired only once for each blockNumber.
    // Blocks are delivered in sequential order and one at a time so that none is skipped
    // and you know for sure that every block up to the latest one received was processed.
    
    // Call 'done()' after processing the events in order to receive the next block. 
    // If an error occurs, calling 'done(err)' will retry to deliver the same block
    // without skipping it.
    const chainId = 4;
    handleEvents(chainId, blockNumber, events, done);
});

ethereumEventsRopsten.on('block.confirmed', (blockNumber, events, done) => {
    // Events contained in 'confirmed' blocks are considered final,
    // hence the callback is fired only once for each blockNumber.
    // Blocks are delivered in sequential order and one at a time so that none is skipped
    // and you know for sure that every block up to the latest one received was processed.
    
    // Call 'done()' after processing the events in order to receive the next block. 
    // If an error occurs, calling 'done(err)' will retry to deliver the same block
    // without skipping it.
    const chainId = 3;
    handleEvents(chainId, blockNumber, events, done);
});


console.log("Rinkeby (4) - Ready to start listening for event");
ethereumEventsRinkeby.start(); // startBlock defaults to 'latest' when omitted
console.log("Rinkeby (4) - Εvent listener is running? " + ethereumEventsRinkeby.isRunning())

console.log("Ropsten (3) - Ready to start listening for event");
ethereumEventsRopsten.start(); // startBlock defaults to 'latest' when omitted
console.log("Ropsten (3) - Εvent listener is running? " + ethereumEventsRopsten.isRunning())

// Stop listening for events
// ethereumEvents.stop();