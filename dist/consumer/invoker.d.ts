import Consumer from "./index";
import Channel from './channel';
import { RPC_CALLBACK_ARGS } from '../utils';
export default class Invoker {
    consumer: Consumer;
    readonly interfacename: string;
    readonly interfaceversion: string;
    readonly interfacegroup: string;
    private zooKeeperRegisterPath;
    private zooKeeperRegisterRootPath;
    private channels;
    constructor(consumer: Consumer, interfacename: string, interfaceversion: string, interfacegroup: string);
    close(): Promise<void>;
    remove(channel: Channel): Promise<void>;
    register(): Promise<this>;
    unRegister(): void;
    subscribe(id: string): Promise<number>;
    private notify;
    private getChildrenListFromZooKeeper;
    private setupChannels;
    invoke<T = any>(method: string, args: any[]): Promise<T>;
    manyRetry(method: string, args: any[], providers: Channel[], usedChannels: Channel[], count: number): Promise<RPC_CALLBACK_ARGS>;
    private oneRetry;
    private resolveInvokeResult;
}
