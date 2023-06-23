import {
    IWebSocket,
    IRpcWebSocket,
    RpcMessage
} from './provided-types'
const PlainWebSocket = require('ws');
import {clearInterval} from "timers";
import {RpcMethod} from "../ts-scripts/provided-types";

class WebSocket implements IWebSocket {
    socket: typeof PlainWebSocket;
    protocols: string[];
    reconnectDelayMs = 1000;
    readonly defaultPingInterval = 10*1000;
    interval = this.setUpInterval(this.defaultPingInterval);
    reconnect: boolean;
    constructor(url: string, protocols: string[] = [], reconnect = true) {
        this.protocols = protocols;
        this.createSocket(url);
        this.reconnect = reconnect;
    }

    private createSocket(url: string): typeof PlainWebSocket {
        let prevSocket = this.socket;
        this.socket = new PlainWebSocket(
            url,
            this.protocols,
            {'perMessageDeflate': false, 'skipUTF8Validation': true}
        );
        if (typeof prevSocket === 'object') {
            this.socket.onclose = prevSocket.onclose;
            this.socket.onerror = prevSocket.onerror;
            this.socket.onopen = prevSocket.onopen;
            this.socket.onmessage = prevSocket.onmessage;
        }
    }
    close(): void {
        if (this.isConnected()) {
            this.socket.close();
        }
    }

    private async sleep(ms: number): Promise<void> {
        return await new Promise(resolve => setTimeout(resolve, ms));
    }

    isConnected(): boolean {
        return this.socket.readyState === 1
    }

    async waitForConnect(): Promise<void> {
        while (!this.isConnected()) {
            await this.sleep(100);
        }
    }

    private waitingCallback(callback: () => void) : () => void {
            return () => {
                this.sleep(this.reconnectDelayMs).then(() => {
                    this.createSocket(this.url());
                    callback();
                });
            }
    }

    onClose(callback: () => void): void {
        if (this.reconnect) {
            this.socket.onclose = this.waitingCallback(callback);
        }
        else {
            this.socket.onclose = callback;
        }
    }

    onError(callback: () => void): void {
        if (this.reconnect) {
            this.socket.onerror = this.waitingCallback(callback);
        }
        else {
            this.socket.onerror = callback;
        }
    }

    onMessage(callback: (msg: any) => void): void {
        this.socket.onmessage = callback;
    }

    onOpen(callback: () => void): void {
        this.socket.onopen = callback;
    }

    ping(): void {
        if (this.isConnected()) {
            this.socket.ping();
        }
    }

    pingLoop(intervalMs: number): void {
        clearInterval(this.interval);
        this.interval = this.setUpInterval(intervalMs);
    }

    pong(): void {
        if (this.isConnected()) {
            this.socket.pong();
        }
    }

    send(msg: string): void {
        this.socket.send(msg);
    }

    private setUpInterval(pingLoopIntervalMs: number) : NodeJS.Timeout {
        return setInterval(() => {
            if (this.isConnected()) {
                this.ping();
            }
        }, pingLoopIntervalMs);
    }

    setReconnectDelay(delay: number): void {
        clearInterval(this.interval);
        this.reconnectDelayMs = delay;
        this.interval = this.setUpInterval(this.defaultPingInterval);
    }

    url(): string {
        return this.socket.url;
    }


}

class RpcWebSocket extends WebSocket implements IRpcWebSocket {
    id = 0;
    readonly nullEvent = 'nullEvent';

    constructor(url: string, protocols: string[] = []) {
        super(url, protocols);

        this.onMessage((message) => {
            let data: RpcMessage<any> = JSON.parse(message['data']);
            let id = data['id'];
            if (id === null || id === undefined) {
                this.socket.emit(this.nullEvent, data);
            }
            else {
                this.socket.emit(id, data);
            }
        });

        this.onNullIdMessage((msg) => {
            console.log('null id message received');
            console.log(msg);
        });
    }
    onNullIdMessage(callback: (msg: any) => void): void {
        this.socket.addEventListener(this.nullEvent, callback);
    }

    onResponse(id: number, callback: (msg: any) => void): void {
        this.socket.addEventListener(id, callback);
    }

    rpcId(): number {
        return this.id;
    }

    async send(msg: string): Promise<number> {
        if (!this.isConnected()) {
            await this.waitForConnect();
        }
        let prevId = this.id;
        await this.socket.send(msg);
        this.id += 1;
        return prevId;
    }

    async sendBody(body: object): Promise<number> {
        let rpcBody: RpcMessage<any> = {
            ...body,
            id: this.id,
            jsonrpc: '2.0'
        }
        return await this.send(JSON.stringify(rpcBody));
    }

    async sendWithCallback(method: RpcMethod, callback: (msg: any) => void, params: any[] = []): Promise<void> {
        this.onResponse(this.id, callback);
        await this.sendBody({method, params});
    }
}

export {
    RpcWebSocket,
    IRpcWebSocket
}
