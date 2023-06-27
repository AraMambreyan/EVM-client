

import {
    EnvAccountLoader,
    getEvmClient
} from './ts_evm'
import {IEvmClient} from "./provided-types";
import BigNumber from "bignumber.js";

const fs = require('fs');
const path = require('path');
require('dotenv').config({path: path.resolve(__dirname, '../.env')});

async function print_data(http: boolean) {
    const API_URL = 'wss://eth-mainnet.g.alchemy.com/v2/Bz0KRD6N4ojfzMuWtNe3m4Bne8RaWaKn';
    const CONTRACT_ADDRESS = '0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852';
    const CONTRACT_ABI = fs.readFileSync(path.join(__dirname, '../Uniswapv2_eth_usdt_pair_abi.json'), 'utf8');
    let client = getEvmClient(API_URL);

    await client.loadAccount(new EnvAccountLoader());
    await client.updateNonce();

    // test log filters
    let contract = client.loadContract(CONTRACT_ADDRESS, JSON.parse(CONTRACT_ABI));
    let contractSingatureTopic = contract.getEventTopic('Sync');
    let filterTopics = [contractSingatureTopic];

    await client.onLogs(
        CONTRACT_ADDRESS,
        filterTopics,
        (logs) => {

            if (Array.isArray(logs)) {
                logs.forEach((log) => {
                    processLog(client, log);
                });
            }
            else {
                processLog(client, logs);
            }
        }
    )
}

function processLog(client: IEvmClient, log) {
    let reserves = client.abiDecode(log['data'], ['uint112', 'uint112']);

    let ethReserve = BigNumber(reserves[0]['_hex']);
    let usdtReserve = BigNumber(reserves[1]['_hex']);
    let tenToTwelve = new BigNumber('10').exponentiatedBy(12);

    let result = usdtReserve.multipliedBy(tenToTwelve).dividedBy(ethReserve);
    console.log('ETH/USDT: ' + result.toFixed(4));
}

print_data(false);
