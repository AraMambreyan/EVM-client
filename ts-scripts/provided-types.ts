/*
Copy paste of the types provided with some minor modifications.
*/

// Returned by contract.createContractCall()
interface ContractCall {
    to: string  // Address of contract
    data?: string   // ABI encoded contract calldata & parameters
}

// Argument to client.signTransaction()
interface TransactionParameters {
    value?: number | string | null   // ETH to send with transaction
    gasPrice?: number | null
    gasLimit: number | null
    maxFeePerGas?: number | null    // EIP-1559 param
    maxPriorityFeePerGas?: number | null    // EIP-1559 param
}

// Created internally in client.signTransaction() - combines ContractCall, TransactionParameters, and account specific data
type UnsignedTransaction = ContractCall & TransactionParameters & {
    from: string  // Account address
    nonce: number  // Account nonce
    type: number    // 0 if using gasPrice in TransactionParameters, 2 if using maxFeePerGas and maxPriorityFeePerGas
}


interface IContract {
    getAddress(): string  // Contract address
    call(func: string, ...args: any[]): Promise<any>   // Query view function
    send(func: string, ...args: any[]): Promise<any>  // Create ContractCall for transaction
    getEventTopic(eventName: string): string | null  // Keccak hash of event name
}


// Don't worry about this
interface AccessListInfo {
    address: string;
    storageKeys: string[]
}

// Transaction information
interface TransactionInfo {
    blockHash: string;
    blockNumber: string;
    from: string;
    gas: string;
    gasPrice: string;
    hash: string;
    input: string;
    nonce: string;
    to: string;
    transactionIndex: string;
    value: string;
    type: string;
    accessList: AccessListInfo[];
    chainId: string;
    v: string;
    r: string;
    s: string;
}

// Block information
interface BlockInfo {
    baseFeePerGas?: string | null;
    difficulty?: string;
    extraData?: string;
    gasLimit?: string;
    gasUsed?: string;
    hash?: string;
    logsBloom: string;
    miner: string;
    mixHash?: string;
    nonce: string;
    number: string;
    parentHash: string;
    receiptRoot: string;
    sha3Uncles: string;
    size?: string;
    stateRoot: string;
    timestamp: string;
    totalDifficulty?: string;
    transactions?: (TransactionInfo | string)[];
    transactionsRoot: string;
    uncles?: string[];
}

// Arguments for specifying a log filter
interface LogFilterParameters {
    fromBlock: string;
    toBlock: string;
    address: string | string[] | null;
    topics: (string | string[])[]
}

// Emitted log
interface Log {
    address: string;
    topics: (string | string[])[];
    data: string;
    blockNumber: number | null;
    transactionHash: string | null;
    transactionIndex: number | null;
    blockHash: string | null;
    logIndex: string | null;
    removed: boolean;
}

// Receipt for transaction included in block
interface TransactionReceipt {
    blockHash: string;
    blockNumber: string;
    contractAddress: string | null
    cumulativeGasUsed: string;
    effectiveGasPrice: string;
    from: string;
    to: string | null;
    gasUsed: string;
    logs: Log[];
    logsBloom: string;
    status: string;
    transactionHash: string;
    transactionIndex: string;
    type: string;
}

// Messages received from subscriptions contain no RPC id, so can easily distinguish when a message is a response to a specific request versus a notification
interface SubscriptionMessageParams<T> {
    subscription: string
    result: T;
}

interface SubscriptionMessage<T> {
    jsonrpc: string;
    method: string;
    params?: SubscriptionMessageParams<T>
}

// RpcMethod & Subscription should be used internally by the EvmClient so the functions are strongly typed
enum RpcMethod {
    GetTransactionCount = 'eth_getTransactionCount',
    BlockNumber = 'eth_blockNumber',
    GetBlockByNumber = 'eth_getBlockByNumber',
    NewFilter = 'eth_newFilter',
    NewBlockFilter = 'eth_newBlockFilter',
    NewPendingTransactionFilter = 'eth_newPendingTransactionFilter',
    GetLogs = 'eth_getLogs',
    GetFilterChanges = 'eth_getFilterChanges',
    GasPrice = 'eth_gasPrice',
    GetBalance = 'eth_getBalance',
    SendRawTransaction = 'eth_sendRawTransaction',
    GetTransactionReceipt = 'eth_getTransactionReceipt',
    Subscribe = 'eth_subscribe',
    Call = 'eth_call',
}

enum Subscription {
    Blocks = 'newHeads',
    PendingTransactions = 'newPendingTransactions',
    Logs = 'logs'
}


enum ClientType {
    Http,
    WebSocket
}


interface IEvmClient {
    type(): ClientType

    url(): string

    getAccountAddress(): string | undefined

    abiDecode(data: string, types: string[]): any

    updateNonce()

    loadAccount(envFile: string | null)

    getNonce(): Promise<number>

    incrementNonce()

    getAndIncrementNonce(): number

    keccak(data: string): string

    getBlockHeight(): Promise<number | null>

    getBlockTransactions(
        height: number,
        hashesOnly: boolean
    ): Promise<(TransactionInfo | string)[]>

    // Returns a contract object with a reference to the EvmClient
    loadContract(address: string, abi: object[]): IContract

    // Scans matching logs between fromBlock and toBlock
    getLogs(
        fromBlock: number | string,
        toBlock: number | string,
        addresses: string | string[] | null,
        topics: (string | string[])[]
    ): Promise<Log[] | null>

    getGasPrice(): Promise<string | null>

    getEthBalance(address: string | null): Promise<string | null>

    // SUBSCRIPTIONS
    createLogFilter(
        fromBlock: string | number,
        toBlock: string | number,
        addresses: string | string[] | null,
        topics: (string | string[])[]
    ): Promise<string | null>

    createBlockFilter(): Promise<string | null>

    createPendingTransactionFilter(): Promise<string | null>

    checkFilter(filterId: string): Promise<Log[] | null>

    // Websocket: Calls eth_subscribe on block
    // Http: Creates block filter and polls the filter ID for changes on a fixed interval
    onBlock(
        callback: (msg: any) => void,
        intervalMs?: number | null,
        resubscibing?: boolean
    ): Promise<void>

    // Websocket: Calls eth_subscribe on pendingTransactions
    // Http: Creates pendingTransaction filter and polls the filter ID for changes on a fixed interval
    onPendingTx(
        callback: (msg: any) => void,
        intervalMs?: number | null,
        resubscibing?: boolean
    ): Promise<void>

    // Websocket: Calls eth_subscribe on logs
    // Http: Creates log filter and polls the filter ID for changes on a fixed interval
    onLogs(
        addresses: string | string[] | null,
        topics: (string | string[])[],
        callback: (log: Log | Log[]) => void,
        intervalMs?: number | null,
        resubscibing?: boolean
    ): Promise<void>

    // TRANSACTIONS
    signTx(
        contractCall: ContractCall,  // Returned by contract.createContractCall()
        nonceOverride: number | null, // Optional nonce override
        txParams: TransactionParameters
    ): Promise<string>

    // Calls eth_sendRawTransaction()
    broadcastTx(signedTx: string): Promise<RpcMessage<string>>

    // Returns receipt if transaction is mined else null
    getTxReceipt(hash: string): Promise<TransactionReceipt | null>

    // Calls broadcastTx() then polls the transaction receipt until it's mined
    broadcastTxSync(signedTx: string, timeout: number | null): Promise<TransactionReceipt | null>
    query(
        method: RpcMethod,
        params: any[]
    ): Promise<RpcMessage<any>>
}


// Standard JSON RPC message
interface RpcMessage<T> {
    jsonrpc: string
    id?: number
    error?: any
    result?: T
    params?: any
}


// export all the interfaces of this file
export {
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
    ClientType,
    IContract
}
