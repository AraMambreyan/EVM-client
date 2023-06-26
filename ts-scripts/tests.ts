/*
Tests ideally should be written independently and verification not done manually.

Since this is a learning exercise, not writing proper tests.
 */


import {
    EnvAccountLoader,
    getEvmClient
} from './ts_evm'

const fs = require('fs');
const path = require('path');
require('dotenv').config({path: path.resolve(__dirname, '../.env')});


async function test(http) {
    let API_URL;
    if (http) {
        API_URL = process.env.API_URL;
    }
    else {
        API_URL = process.env.API_WS_URL;
    }
    console.log(API_URL);
    const CONTRACT_ADDRESS = process.env.HELLO_WORLD_CONTRACT_ADDRESS;
    const ACCOUNT_2_ADDRESS = process.env.ACCOUNT_ADDRESS_2;
    const HELLO_WORLD_ABI = fs.readFileSync(path.join(__dirname, '../HelloWorld_abi.json'), 'utf8');
    let client = getEvmClient(API_URL);

    await client.loadAccount(new EnvAccountLoader());
    await client.updateNonce();

    // // test sending to EOA with standard broadcast
    // let signedTx = await client.signTx({
    //     to: ACCOUNT_2_ADDRESS,
    // }, null, {
    //     value: 2e16,
    //     gasPrice: 1e11,
    //     gasLimit: 21000,
    // });
    // let receipt = await client.broadcastTx(signedTx);
    // console.log(receipt);
    //
    //
    // test getting transaction receipt
    // let txReceipt = await client.getTxReceipt('0xb5e617ad2a0a05a27970174194122133b60befeea8407cf6305a856887a1db61');
    // console.log(txReceipt);
    //
    //
    // // test sending to EOA with broadcastSync
    // let signedEoaTx = await client.signTx({
    //     to: ACCOUNT_2_ADDRESS
    // }, null, {
    //     value: 1e15,
    //     gasPrice: 1e11,
    //     gasLimit: 21000,
    // });
    // let eoaReceipt = await client.broadcastTx(signedEoaTx);
    // console.log(eoaReceipt);
    //
    // test making a contract call and send
    // let contract = client.loadContract(CONTRACT_ADDRESS, JSON.parse(HELLO_WORLD_ABI));
    // let message = await contract.query('message');
    // console.log(message);
    // let txReceipt = await client.signAndBroadcastTx(contract.createContractCall('update', 'dradrada'));
    // console.log(txReceipt);
    // message = await contract.query('message');
    // console.log(message);
    //
    // // test log filters
    // let contract = client.loadContract(CONTRACT_ADDRESS, JSON.parse(HELLO_WORLD_ABI));
    // let contractSingatureTopic = contract.getEventTopic('MessageUpdated');
    // let filterTopics = [contractSingatureTopic,
    //     ['0x0000000000000000000000000000000000000000000000000000000000000007',
    //         '0x0000000000000000000000000000000000000000000000000000000000000009']];
    //
    // // let logs = await client.getLogs(0, 'latest', CONTRACT_ADDRESS, filterTopics);
    // // console.log(logs);
    //
    // let filterId = await client.createLogFilter(0, 'latest', CONTRACT_ADDRESS, filterTopics);
    // console.log(filterId);
    // await contract.send('update', '55555');
    // await contract.send('update', '7777777');
    // await contract.send('update', '55555');
    // await contract.send('update', '999999999');
    // let logs_1 = await client.checkFilter(filterId);
    // let logs_2 = await client.checkFilter(filterId);
    // console.log(logs_1);


    // // Test block subscription
    // await client.onBlock((block) => {
    //    console.log('hey');
    //    console.log(block);
    // });



    // // test subscriptions
    // let contract = client.loadContract(CONTRACT_ADDRESS, JSON.parse(HELLO_WORLD_ABI));
    // let contractSingatureTopic = contract.getEventTopic('MessageUpdated');
    // let filterTopics = [contractSingatureTopic,
    //     ['0x0000000000000000000000000000000000000000000000000000000000000007',
    //         '0x0000000000000000000000000000000000000000000000000000000000000009']];
    //
    // await client.onLogs(CONTRACT_ADDRESS, filterTopics, (log) => {
    //     console.log(log);
    // }, 23*1000);
}

test(false)
