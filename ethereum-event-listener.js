const dotenv = require("dotenv");
dotenv.config({path: __dirname + '/.env'});
const { INFURA_API_KEY, PRIVATE_KEY } = process.env;

const Web3 = require('web3');
const EthereumEvents = require('ethereum-events');

ERC20_ABI = require("./ABIs/ERC20.json");
TOKEN_BRIDGE_ABI = require("./ABIs/TokenBridge.json");

const WEB3_PROVIDER_RINKEBY = new Web3.providers.HttpProvider('https://rinkeby.infura.io/v3/' + INFURA_API_KEY) /* Your web3 provider (e.g. geth, Infura) */;
const WEB3_PROVIDER_ROPSTEN = new Web3.providers.HttpProvider('https://ropsten.infura.io/v3/' + INFURA_API_KEY) /* Your web3 provider (e.g. geth, Infura) */;

const contracts = [
  {
    name: 'Token Bridge',
    address: '0x7686680Dd6Bd185D7B47913040CD440D217B53Dd',
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

const web3 = new Web3(WEB3_PROVIDER_RINKEBY);

const ethereumEvents = new EthereumEvents(web3, contracts, options);

ethereumEvents.on('block.confirmed', (blockNumber, events, done) => {

    // Events contained in 'confirmed' blocks are considered final,
    // hence the callback is fired only once for each blockNumber.
    // Blocks are delivered in sequential order and one at a time so that none is skipped
    // and you know for sure that every block up to the latest one received was processed.
    
    // Call 'done()' after processing the events in order to receive the next block. 
    // If an error occurs, calling 'done(err)' will retry to deliver the same block
    // without skipping it.
    if(events.length > 0){
        console.log("Got Confirmed Events.");
        console.log("Block Number: " + blockNumber);
        // console.log(events);
        for(i = 0; i < events.length; i++){
            const event = events[i];
            console.log(event.name);
            
            let functionName = "";
            if(event.name == "Lock")
                functionName = "lock()"
            else if(event.name == "Burn")
                functionName = "burn()";
            else
                return;
                
            console.log(event.values);
            const targetChain = event.values._targetChain;
            const tokenAddress = event.values._token;
            const ownerAddress = event.values._owner;
            const amount = event.values._amount;
            const nonce = event.values._nonce;
            console.log([functionName, targetChain, tokenAddress, ownerAddress, amount, nonce]);
        }
    }
    done();
  });
  
ethereumEvents.on('error', err => {

    // An error occured while fetching new blocks/events.
    // A retry will be attempted after backoff interval.
    console.log("ERROR Fetching events!!");
  
  });

  console.log("Ready to start listening for event");

ethereumEvents.start(); // startBlock defaults to 'latest' when omitted

console.log("Εvent listener is running?: " + ethereumEvents.isRunning())

// Stop listening for events
// ethereumEvents.stop();