import * as net from "net";
import Provider from "./index";
import { heartBeatEncode, PROVIDER_CONTEXT_STATUS } from "../utils";
import Context from "./context";
export default class Connection {
  public provider: Provider;
  private context: Context;
  private socket: net.Socket;
  private _alive: boolean = true;
  private _heartbet_timer: NodeJS.Timer;
  private _lastread_timestamp: number = Date.now();
  private _lastwrite_timestamp: number = Date.now();
  constructor(provider: Provider, socket: net.Socket) {
    this.provider = provider;
    this.socket = socket;
    this.connect();
    this.initHeartbeat();
    this.context = new Context(this);
  }

  private connect() {
    this.socket.on("data", (buf) => this.onMessage(buf));
    this.socket.on("close", () => this.provider.disconnect(this));
    this.socket.on("error", (err) => this.provider.logger.error(err));
  }

  private initHeartbeat() {
    if (this.provider.heartbeat > 0) {
      this._heartbet_timer = setInterval(() => {
        const time = Date.now();
        const readTime = time - this._lastread_timestamp;
        const writeTime = time - this._lastwrite_timestamp;
        if (
          readTime > this.provider.heartbeat_timeout ||
          writeTime > this.provider.heartbeat_timeout
        )
          return this.provider.disconnect(this);
        if (
          readTime > this.provider.heartbeat ||
          writeTime > this.provider.heartbeat
        )
          this.send(heartBeatEncode());
      }, this.provider.heartbeat);
    }
  }

  onMessage(buf: Buffer) {
    this._lastread_timestamp = Date.now();
    Promise.resolve(this.context.decode(buf))
      .then(() => {
        this.context.status = PROVIDER_CONTEXT_STATUS.OK;
        this.send(this.context.encode());
      })
      .catch((e) => {
        this.context.body = e.message;
        if (
          !this.context.status ||
          this.context.status === PROVIDER_CONTEXT_STATUS.OK
        )
          this.context.status = PROVIDER_CONTEXT_STATUS.SERVICE_ERROR;
        this.send(this.context.encode());
      });
  }

  send(buf: Buffer) {
    if (!this._alive) return;
    this.socket.write(buf);
    this._lastwrite_timestamp = Date.now();
  }

  disconnect() {
    if (!this._alive) return;
    if (this._heartbet_timer) {
      clearInterval(this._heartbet_timer);
      this._heartbet_timer = null;
    }
    this._alive = false;
    this.socket.destroy();
  }
}
