import { IRpcWebSocket, RpcWebSocket } from "./index";
import {RpcMethod} from "../ts-scripts/provided-types";
const path = require("path");
require('dotenv').config({path: path.resolve(__dirname, '../.env')});



async function test() {
    let client: RpcWebSocket = new RpcWebSocket(process.env.API_WS_URL);
    client.onOpen(() => {
        console.log('Connected');
    });
    client.onClose(() => {console.log('Closed')});
    client.onError(() => {console.log('Error')});

    await client.sendWithCallback(RpcMethod.GasPrice, (msg) => {
        console.log('Gas price is: ' + msg['result']);
    });

    await client.sendWithCallback(RpcMethod.BlockNumber, (msg) => {
        console.log('Block number is: ' + msg['result']);
    });
}

test();








