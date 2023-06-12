/*
Author: Ara Mambreyan
Purpose: EVM client

For production:

1. Proper error handling should be done.
2. The hard-coded values of the gas limit and price should be changed.
3. Some of the code can be amended to be much more performant.
*/

const ethers = require('ethers');
require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
keccak = require('keccak');

const API_URL = process.env.API_URL;
const API_KEY = process.env.API_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const ACCOUNT_ADDRESS = process.env.ACCOUNT_ADDRESS;
const ACCOUNT_2_ADDRESS = '0x3404EDBB079CB3b8525876299D51f540B569FAe3'
const HELLO_WORLD_ABI = fs.readFileSync('scripts/HelloWorld_abi.json', 'utf8');


class EvmHttpClient {
    static async create(account_address, private_key, client_url) {
        let client = new EvmHttpClient(account_address, private_key, client_url);
        await client.updateNonce();
        return client;
    }

    constructor(account_address, private_key, client_url) {
        this.client_url = client_url;
        this.account_address = account_address;
        this.private_key = private_key;
        this.nonce = 0;
    }

    checkNonce() {
        if (this.nonce === undefined) {
            throw new Error('Nonce is not set yet. Please wait for the nonce to be set before making a transaction.');
        }
    }

    async updateNonce() {
        let queryResult = await this.query('eth_getTransactionCount', [this.account_address, 'latest']);
        this.nonce = parseInt(queryResult.result, 16);
    }

    async query(method, params = []) {
        let payload = {
            jsonrpc: '2.0',
            id: 0, // irrelevant for the http client using axios
            method: method,
            params: params
        }

        let http_result = await axios.post(this.client_url, payload);
        return http_result.data;
    }

    getHex(num) {
        return `0x${num.toString(16)}`
    }

    constructTxObject(to, gasLimit, gasPrice, value, data = '0x') {
        return {
            nonce: this.getHex(this.nonce),
            gasLimit: this.getHex(gasLimit),
            gasPrice: this.getHex(gasPrice),
            to: to,
            value: this.getHex(value),
            data: data,
        }
    }

    async sendTransaction(to, gasLimit, gasPrice, value, data = '0x') {
        this.checkNonce();
        let tx = this.constructTxObject(to, gasLimit, gasPrice, value, data);
        let wallet = new ethers.Wallet(this.private_key);
        let signedTx = await wallet.signTransaction(tx);
        let result = await this.query('eth_sendRawTransaction', [signedTx]);
        this.nonce += 1;
        return result;
    }

    async sendEoaTransaction(to, value) {
        return this.sendTransaction(to, 21000, 1000000000, value);
    }
}

class Contract {
    constructor(contract_address, abi, evmClient) {
        this.contract_address = contract_address;
        this.abi = JSON.parse(abi);
        this.evmClient = evmClient;
    }

    getMethodInputs(method) {
        let methodData = null;
        for (let i = 0; i < this.abi.length; i++) {
            if (this.abi[i].name === method) {
                methodData = this.abi[i].inputs;
                break;
            }
        }
        return methodData;
    }

    getFunctionSelector(method, inputs) {
        let s = method + '(';
        for (let i = 0; i < inputs.length; i++) {
            s += inputs[i].internalType;
            if (i !== inputs.length - 1) {
                s += ',';
            }
        }
        s += ')';
        let hash = keccak('keccak256').update(s).digest('hex');
        return hash.slice(0, 8);
    }

    getParameterTypes(inputs) {
        let types = [];
        for (let i = 0; i < inputs.length; i++) {
            types.push(inputs[i].internalType);
        }
        return types;
    }

    constructData(method, params = []) {
        let inputs = this.getMethodInputs(method);
        if (inputs === null) {
            throw new Error(`Method ${method} does not exist in the ABI`);
        }

        let functionSelector = this.getFunctionSelector(method, inputs);
        let encodedInputs = ethers.utils.defaultAbiCoder.encode(this.getParameterTypes(inputs), params).slice(2);
        return '0x' + functionSelector + encodedInputs;
    }

    async call(method, params = []) {
        let data = this.constructData(method, params);
        let txObject = evmClient.constructTxObject(this.contract_address, 100000, 1000000000, 0, data);
        let result = await this.evmClient.query('eth_call', [txObject, 'latest']);
        return result.result;
    }

    async send(method, params = []) {
        let data = this.constructData(method, params);

        let result = await this.evmClient.sendTransaction(
            this.contract_address,
            2e6,
            1e10,
            0,
            data
        );

        // wait for the transaction to be mined
        let receipt = null;
        while (receipt === null) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            receipt = (await this.evmClient.query('eth_getTransactionReceipt', [result.result])).result;
            console.log(receipt);
        }

        return result;
    }
}

/*
This is the test code.

The "pyramid of doom" can be avoided, was just writing quickly.
 */
let evmClient = new EvmHttpClient(ACCOUNT_ADDRESS, PRIVATE_KEY, API_URL);
EvmHttpClient.create(ACCOUNT_ADDRESS, PRIVATE_KEY, API_URL).then((evmClient) => {
    console.log('Nonce is: ' + evmClient.nonce);

    // test sending a transaction to an EOA
    evmClient.sendTransaction(ACCOUNT_2_ADDRESS, 21000, 1000000000, 10 ** 16).then((result) => {
        console.log(result)
    });

    // test making a call to a contract, update the "Hello World" message of the contract, verify that message changed
    let contract = new Contract(CONTRACT_ADDRESS, HELLO_WORLD_ABI, evmClient);
    contract.call('message').then((result) => {
        console.log('Initial Message of the Smart Contract is: ' + ethers.utils.toUtf8String(result));

        contract.send('update', ['Lolo']).then(() => {
            contract.call('message').then((result) => {
                console.log('Final Message of the Smart Contract is: ' + ethers.utils.toUtf8String(result));
            });
        });
    });
});




