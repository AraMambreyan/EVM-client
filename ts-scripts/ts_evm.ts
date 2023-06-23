/*
1. I have been sloppy with encapsulation of class fields. Almost all aside from the interfaces should be private.
2. I performed almost no proper error checking.
3. Lots of room for refactoring including for increasing performance, making the code more readable and avoiding deduplication.
 */

import {
    IEvmClient,
    RpcMessage,
    RpcMethod,
    Subscription,
    SubscriptionMessage,
    SubscriptionMessageParams,
    LogFilterParameters,
    Log,
    TransactionReceipt,
    UnsignedTransaction,
    TransactionParameters,
    TransactionInfo,
    ContractCall,
    IContract,
    ClientType,
    IAccountLoader,
} from './provided-types'


import {Client} from 'undici';

const fs = require('fs');
const path = require('path');
require('dotenv').config({path: path.resolve(__dirname, '../.env')});
const ethers = require('ethers');
const keccak = require('keccak');


class EnvAccountLoader {
    loadAccountAddress(): string {
        return process.env.ACCOUNT_ADDRESS;
    }

    loadPrivateKey(): string {
        return process.env.PRIVATE_KEY;
    }
}


class EvmHttpClient implements IEvmClient {
    clientUrlDns: string;
    clientUrlPath: string;
    httpClient: Client;
    accountAddress?: string
    privateKey?: string;
    nonce?: number;
    wallet?: typeof ethers.Wallet;
    keccakUtil = keccak('keccak256');
    defaultIntervalMs = 30000;

    constructor(clientUrl: string) {
        let url = new URL(clientUrl);
        this.clientUrlDns = url.origin;
        this.clientUrlPath = url.pathname;

        this.httpClient = new Client(this.clientUrlDns);
    }

    async query(method: RpcMethod, params: any[] = []): Promise<RpcMessage<any>> {
        try {
            let payload = {
                jsonrpc: '2.0',
                id: 0, // irrelevant for the http client
                method: method,
                params: params
            };

            let {body} = await this.httpClient.request({
                path: this.clientUrlPath,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            return await body.json();
        } catch (err) {
            console.log(err);
        }
    }

    getHex(num: number): string {
        return `0x${num.toString(16)}`
    }

    abiDecode(data: string, types: string[]): any {
        return ethers.utils.defaultAbiCoder.decode(types, data);
    }

    async broadcastTx(signedTx: string): Promise<RpcMessage<string>> {
        this.checkAccountLoaded();
        let result = await this.query(RpcMethod.SendRawTransaction, [signedTx]);
        this.incrementNonce();
        return result as RpcMessage<string>;
    }

    async broadcastTxSync(signedTx: string, timeout: number | null): Promise<TransactionReceipt | null> {
        this.checkAccountLoaded();
        let transactionHash = (await this.broadcastTx(signedTx))['result'];
        console.log(transactionHash);

        // wait for the transaction to be mined
        let timeoutReached = false;
        if (timeout !== null) {
            setTimeout(() => {
                if (receipt === null) {
                    console.log('Broadcast Tx sync timeout reached');
                    timeoutReached = true;
                }
            }, timeout);
        }

        let receipt = null;
        while (receipt === null && timeoutReached === false) {
            console.log('Awaiting receipt... of transaction hash: ' + transactionHash);
            await new Promise(resolve => setTimeout(resolve, 1000));
            receipt = (await this.query(RpcMethod.GetTransactionReceipt, [transactionHash]))['result'];
        }

        return receipt;
    }

    async checkFilter(filterId: string): Promise<Log[] | null> {
        let jsonResult = await this.query(RpcMethod.GetFilterChanges, [filterId]);
        return jsonResult['result'];
    }

    async createBlockFilter(): Promise<string | null> {
        let jsonResult = await this.query(RpcMethod.NewBlockFilter, []);
        return jsonResult['result'];
    }

    private createLogParameters(fromBlock: string | number, toBlock: string | number, addresses: string | string[] | null, topics: (string | string[])[]): LogFilterParameters[] {
        if (typeof fromBlock === 'number') {
            fromBlock = this.getHex(fromBlock);
        }
        if (typeof toBlock === 'number') {
            toBlock = this.getHex(toBlock);
        }

        return [{fromBlock, toBlock, topics, address: addresses}];
    }

    async createLogFilter(fromBlock: string | number, toBlock: string | number, addresses: string | string[] | null, topics: (string | string[])[]): Promise<string | null> {
        let jsonResult = await this.query(RpcMethod.NewFilter, this.createLogParameters(fromBlock, toBlock, addresses, topics));
        return jsonResult['result'];
    }

    async createPendingTransactionFilter(): Promise<string | null> {
        let jsonResult = await this.query(RpcMethod.NewPendingTransactionFilter, []);
        return jsonResult['result'];
    }

    getAccountAddress(): string | undefined {
        return this.accountAddress;
    }

    getAndIncrementNonce(): number {
        if (this.nonce === undefined) {
            throw new Error('Nonce not initialized');
        }
        let nonce = this.nonce;
        this.nonce++;
        return nonce;
    }

    async getBlockHeight(): Promise<number | null> {
        let json = await this.query(RpcMethod.BlockNumber);
        return parseInt(json['result'], 16);
    }


    getBlockTransactions(height: number, hashesOnly: boolean): Promise<(TransactionInfo | string)[]> {
        return this.query(RpcMethod.GetBlockByNumber, [this.getHex(height), hashesOnly])['result']['transactions'];
    }

    getEthBalance(address: string | null): Promise<string | null> {
        return this.query(RpcMethod.GetBalance, [address])['result'];
    }

    getGasPrice(): Promise<string | null> {
        return this.query(RpcMethod.GasPrice)['result'];
    }

    async getLogs(fromBlock: number | string, toBlock: number | string, addresses: string | string[] | null, topics: (string | string[])[]): Promise<Log[] | null> {
        let jsonResult = await this.query(RpcMethod.GetLogs, this.createLogParameters(fromBlock, toBlock, addresses, topics));
        return jsonResult['result'];
    }

    async getNonce(): Promise<number | undefined> {
        return this.nonce;
    }

    async getTxReceipt(hash: string): Promise<TransactionReceipt | null> {
        return (await this.query(RpcMethod.GetTransactionReceipt, [hash]))['result'];
    }

    incrementNonce() {
        if (this.nonce === undefined) {
            throw new Error('Nonce not initialized');
        }
        this.nonce++;
    }

    keccak(data: string): string {
        let result = this.keccakUtil.update(data).digest('hex');
        this.keccakUtil._resetState();
        this.keccakUtil._finalized = false;
        return result;
    }

    async loadAccount(accountLoader: IAccountLoader) {
        if (this.accountAddress === undefined) {
            this.accountAddress = accountLoader.loadAccountAddress();
        }
        if (this.privateKey === undefined) {
            this.privateKey = accountLoader.loadPrivateKey();
        }
        if (this.wallet === undefined) {
            this.wallet = new ethers.Wallet(this.privateKey);
        }
    }

    loadContract(address: string, abi: object[]): IContract {
        return new Contract(this, abi, address);
    }

    private onFilter(callback: (msg: any) => void, filterId: string, intervalMs: number | null | undefined,): void {
        setInterval(async () => {
            let result = await this.checkFilter(filterId);
            if (result !== null) {
                callback(result);
            }
        }, (typeof intervalMs === 'number') ? intervalMs : this.defaultIntervalMs);
    }

    async onBlock(callback: (msg: any) => void, intervalMs?: number | null, resubscibing?: boolean): Promise<void> {
        let filterId = await this.createBlockFilter();
        this.onFilter(callback, filterId, intervalMs);
    }

    async onLogs(addresses: string | string[] | null, topics: (string | string[])[], callback: (log: (Log | Log[])) => void, intervalMs?: number | null, resubscibing?: boolean): Promise<void> {
        let filterId = await this.createLogFilter('latest', 'latest', addresses, topics);
        this.onFilter(callback, filterId, intervalMs);
    }

    async onPendingTx(callback: (msg: any) => void, intervalMs?: number | null, resubscibing?: boolean): Promise<void> {
        let filterId = await this.createPendingTransactionFilter();
        this.onFilter(callback, filterId, intervalMs);
    }

    private checkAccountLoaded(): void {
        if (this.accountAddress === undefined || this.privateKey === undefined || this.wallet === undefined) {
            throw new Error('Account not loaded');
        }
    }

    async signTx(contractCall: ContractCall, nonceOverride: number | null, txParams: TransactionParameters): Promise<string> {
        this.checkAccountLoaded();
        let unsignedTx: UnsignedTransaction = {
            ...contractCall,
            ...txParams,
            from: this.accountAddress,
            nonce: (nonceOverride === null) ? this.nonce : nonceOverride,
            type: (txParams.gasPrice !== null) ? 0 : 2,
            value: (typeof txParams.value !== 'string') ? this.getHex(txParams.value) : txParams.value,
        }

        return this.wallet.signTransaction(unsignedTx);
    }

    type(): ClientType {
        return ClientType.Http;
    }

    async updateNonce(): Promise<void> {
        this.checkAccountLoaded();
        let json = await this.query(RpcMethod.GetTransactionCount, [this.accountAddress, 'latest']);
        this.nonce = parseInt(json['result'], 16);
    }

    url(): string {
        return this.clientUrlDns + this.clientUrlDns;
    }
}


class Contract implements IContract {
    client: IEvmClient;
    address: string;
    methodAbi: Map<string, object>;
    eventAbi: Map<string, string>;

    constructor(client: IEvmClient, abi: object[], address: string) {
        this.client = client;
        this.address = address;
        this.populateMethodAbi(abi);
        this.populateEventAbi(abi);
    }

    async query(func: string, ...args: any[]): Promise<TransactionReceipt> {
        let data = this.constructData(func, ...args);
        let jsonResult = await this.client.query(RpcMethod.Call, [{
            to: this.address,
            data: data,
        }, 'latest']);
        let encodedResult = jsonResult['result'];
        let types = this.getOutputTypes(func);
        return ethers.utils.defaultAbiCoder.decode(types, encodedResult);
    }
    createContractCall(method: string, ...args: any[]): ContractCall {
        return {
            to: this.address,
            data: this.constructData(method, ...args)
        }
    }

    private populateMethodAbi(abi: object[]) {
        this.methodAbi = new Map<string, object>();
        let functions = abi.filter((object) => object['type'] === 'function');
        functions.forEach((object) => {
            this.methodAbi.set(object['name'], object);
        });
    }

    private populateEventAbi(abi: object[]) {
        this.eventAbi = new Map<string, string>();
        let events = abi.filter((object) => object['type'] === 'event');
        events.forEach((object) => {
            let signature = this.getObjectSignature(object);
            this.eventAbi.set(object['name'], '0x' + this.client.keccak(signature));
        });
    }

    getAddress(): string {
        return this.address;
    }

    getEventTopic(eventName: string): string | null {
        let event = this.eventAbi.get(eventName);
        return (event === undefined) ? null : event;
    }

    private getObjectSignature(abiObject: object): string {
        let inputs = abiObject['inputs'];
        let stringParts = [abiObject['name'] + '('];
        for (let i = 0; i < inputs.length; i++) {
            stringParts.push(inputs[i]['internalType']);
            if (i !== inputs.length - 1) {
                stringParts.push(',');
            }
        }
        stringParts.push(')');
        return stringParts.join('');
    }

    private getFunctionSelector(methodObject: object) {
        let signature = this.getObjectSignature(methodObject);
        let hash = this.client.keccak(signature);
        return hash.slice(0, 8);
    }

    private constructData(method, ...args: any[]): string {
        let methodObject = this.methodAbi.get(method);
        if (methodObject === undefined) {
            throw new Error(`Method ${method} does not exist in the ABI`);
        }

        let functionSelector = this.getFunctionSelector(methodObject);
        let params = methodObject['inputs'].map(object => object['internalType']);
        let encodedInputs = ethers.utils.defaultAbiCoder.encode(params, args).slice(2);
        return '0x' + functionSelector + encodedInputs;
    }

    private getOutputTypes(func: string) {
        let outputs = this.methodAbi.get(func)['outputs'];
        return outputs.map(object => object['internalType']);
    }
}


export {
    Contract,
    IAccountLoader,
    EnvAccountLoader,
    EvmHttpClient
}


