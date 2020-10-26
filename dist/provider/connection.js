"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
const context_1 = require("./context");
class Connection {
    constructor(provider, socket) {
        this._alive = true;
        this._lastread_timestamp = Date.now();
        this._lastwrite_timestamp = Date.now();
        this.provider = provider;
        this.socket = socket;
        this.connect();
        this.initHeartbeat();
        this.context = new context_1.default(this);
    }
    connect() {
        this.socket.on("data", (buf) => this.onMessage(buf));
        this.socket.on("close", () => this.provider.disconnect(this));
        this.socket.on("error", (err) => this.provider.logger.error(err));
    }
    initHeartbeat() {
        if (this.provider.heartbeat > 0) {
            this._heartbet_timer = setInterval(() => {
                const time = Date.now();
                const readTime = time - this._lastread_timestamp;
                const writeTime = time - this._lastwrite_timestamp;
                if (readTime > this.provider.heartbeat_timeout ||
                    writeTime > this.provider.heartbeat_timeout)
                    return this.provider.disconnect(this);
                if (readTime > this.provider.heartbeat ||
                    writeTime > this.provider.heartbeat)
                    this.send(utils_1.heartBeatEncode());
            }, this.provider.heartbeat);
        }
    }
    onMessage(buf) {
        this._lastread_timestamp = Date.now();
        Promise.resolve(this.context.decode(buf))
            .then(() => {
            this.context.status = utils_1.PROVIDER_CONTEXT_STATUS.OK;
            this.send(this.context.encode());
        })
            .catch((e) => {
            this.context.body = e.message;
            if (!this.context.status ||
                this.context.status === utils_1.PROVIDER_CONTEXT_STATUS.OK)
                this.context.status = utils_1.PROVIDER_CONTEXT_STATUS.SERVICE_ERROR;
            this.send(this.context.encode());
        });
    }
    send(buf) {
        if (!this._alive)
            return;
        this.socket.write(buf);
        this._lastwrite_timestamp = Date.now();
    }
    disconnect() {
        if (!this._alive)
            return;
        if (this._heartbet_timer) {
            clearInterval(this._heartbet_timer);
            this._heartbet_timer = null;
        }
        this._alive = false;
        this.socket.destroy();
    }
}
exports.default = Connection;
