import {RpcMethod} from "../ts-scripts/provided-types";

interface IWebSocket {
    url() : string
    setReconnectDelay(delay: number) : void
    isConnected() : boolean
    waitForConnect() : Promise<void>
    onOpen(callback: () => void) : void
    onMessage(callback: (msg: any) => void) : void
    onClose(callback: () => void) : void
    onError(callback: () => void) : void
    send(msg: string) : void
    ping() : void
    pingLoop(intervalMs: number) : void
    pong() : void
    close() : void
}

interface RpcMessage<T> {
    jsonrpc: string
    id?: number
    error?: any
    result?: T
    params?: any
}

interface IRpcWebSocket extends IWebSocket {
    onResponse(id: number, callback: (msg: any) => void) : void
    onNullIdMessage(callback: (msg: any) => void) : void
    send(msg: string) : Promise<number>
    sendBody(body: object) : Promise<number>
    rpcId() : number,
    sendWithCallback(method: RpcMethod, callback: (msg: any) => void, params: any[]): Promise<void>
}

export {
    IWebSocket,
    IRpcWebSocket,
    RpcMessage
}
