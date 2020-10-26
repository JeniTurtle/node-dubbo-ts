import Connection from "./connection";
import * as compare from "compare-versions";
import {
  DUBBO_HEADER_LENGTH,
  MAGIC_HIGH,
  MAGIC_LOW,
  fromBytes4,
  isHeartBeat,
  isReplyHeart,
  heartBeatEncode,
  fromBytes8,
  getDubboArgumentLength,
  PROVIDER_CONTEXT_STATUS,
  DUBBO_MAGIC_HEADER,
  DUBBO_DEFAULT_PAY_LOAD,
  toBytes8,
  PROVIDER_RESPONSE_BODY_FLAG,
  getProviderServiceChunkId,
} from "../utils";
import { EventEmitter } from "@nelts/utils";
const hassin = require("hessian.js");

export default class Context extends EventEmitter {
  private buf: Buffer = Buffer.alloc(0);
  private conn: Connection;
  public status: PROVIDER_CONTEXT_STATUS;
  public body: any;
  public attachments: {
    dubbo?: string;
    [name: string]: any;
  } = {};
  public req: {
    requestId: number;
    dubboVersion: string;
    interfaceName: string;
    interfaceVersion: string;
    method: string;
    parameters: any[];
    // status?: 20 | 30 | 31 | 40 | 50 | 60 | 70 | 80 | 90 | 100,
    // body?: any,
    // flag?: 0 | 1 | 2 | 3 | 4 | 5,
    attachments: {
      path: string;
      interface: string;
      version: string;
      group?: string;
      timeout: number;
    };
  };
  constructor(conn: Connection) {
    super();
    this.conn = conn;
  }

  get logger() {
    return this.conn.provider.logger;
  }

  decode(data: Buffer) {
    this.buf = Buffer.concat([this.buf, data]);
    let bufferLength = this.buf.length;
    while (bufferLength >= DUBBO_HEADER_LENGTH) {
      const magicHigh = this.buf[0];
      const magicLow = this.buf[1];
      if (magicHigh != MAGIC_HIGH || magicLow != MAGIC_LOW) {
        const magicHighIndex = this.buf.indexOf(magicHigh);
        const magicLowIndex = this.buf.indexOf(magicLow);
        if (magicHighIndex === -1 || magicLowIndex === -1) return;
        if (
          magicHighIndex !== -1 &&
          magicLowIndex !== -1 &&
          magicLowIndex - magicHighIndex === 1
        ) {
          this.buf = this.buf.slice(magicHighIndex);
          bufferLength = this.buf.length;
        }
        return;
      }
      if (magicHigh === MAGIC_HIGH && magicLow === MAGIC_LOW) {
        if (bufferLength < DUBBO_HEADER_LENGTH) return;
        const header = this.buf.slice(0, DUBBO_HEADER_LENGTH);
        const bodyLengthBuff = Buffer.from([
          header[12],
          header[13],
          header[14],
          header[15],
        ]);
        const bodyLength = fromBytes4(bodyLengthBuff);
        if (isHeartBeat(header)) {
          const isReply = isReplyHeart(header);
          this.buf = this.buf.slice(DUBBO_HEADER_LENGTH + bodyLength);
          bufferLength = this.buf.length;
          if (isReply) this.conn.send(heartBeatEncode(true));
          return;
        }
        if (DUBBO_HEADER_LENGTH + bodyLength > bufferLength) return;
        const dataBuffer = this.buf.slice(0, DUBBO_HEADER_LENGTH + bodyLength);
        this.buf = this.buf.slice(DUBBO_HEADER_LENGTH + bodyLength);
        bufferLength = this.buf.length;
        const requestIdBuff = dataBuffer.slice(4, 12);
        const requestId = fromBytes8(requestIdBuff);
        const body = new hassin.DecoderV2(
          dataBuffer.slice(
            DUBBO_HEADER_LENGTH,
            DUBBO_HEADER_LENGTH + bodyLength
          )
        );
        const dubboVersion = body.read();
        const interfaceName = body.read();
        const interfaceVersion = body.read();
        const method = body.read();
        const argumentTypeString = body.read();
        const i = getDubboArgumentLength(argumentTypeString);
        const args = [];
        for (let j = 0; j < i; j++) args.push(body.read());
        const attachments = body.read();
        this.req = {
          requestId,
          dubboVersion,
          interfaceName,
          interfaceVersion,
          method,
          parameters: args,
          attachments,
        };
        const id = getProviderServiceChunkId(
          interfaceName,
          this.req.attachments.group || "-",
          interfaceVersion || "0.0.0"
        );
        const chunk = this.conn.provider.getChunkById(id);
        return this.conn.provider.emit("data", this, chunk);
      }
    }
  }

  encode() {
    const body = this.encodeBody();
    const head = this.encodeHead(body.length);
    return Buffer.concat([head, body]);
  }

  setRequestId(header: Buffer) {
    const requestId = this.req.requestId;
    const buffer = toBytes8(requestId);
    header[4] = buffer[0];
    header[5] = buffer[1];
    header[6] = buffer[2];
    header[7] = buffer[3];
    header[8] = buffer[4];
    header[9] = buffer[5];
    header[10] = buffer[6];
    header[11] = buffer[7];
  }

  private encodeHead(payload: number) {
    const header = Buffer.alloc(DUBBO_HEADER_LENGTH);
    header[0] = DUBBO_MAGIC_HEADER >>> 8;
    header[1] = DUBBO_MAGIC_HEADER & 0xff;
    header[2] = 0x02;
    header[3] = this.status;
    this.setRequestId(header);
    if (payload > 0 && payload > DUBBO_DEFAULT_PAY_LOAD) {
      throw new Error(
        `Data length too large: ${payload}, max payload: ${DUBBO_DEFAULT_PAY_LOAD}`
      );
    }
    header.writeUInt32BE(payload, 12);
    return header;
  }

  private isSupportAttachments(version?: string) {
    if (!version) return false;
    if (compare(version, "2.0.10") >= 0 && compare(version, "2.6.2") <= 0)
      return false;
    return compare(version, "2.0.2") >= 0;
  }

  private encodeBody() {
    const encoder = new hassin.EncoderV2();
    const body = this.body;
    const attachments = this.attachments || {};
    const attach = this.isSupportAttachments(this.conn.provider.version);
    if (this.status !== PROVIDER_CONTEXT_STATUS.OK) {
      encoder.write(
        attach
          ? PROVIDER_RESPONSE_BODY_FLAG.RESPONSE_WITH_EXCEPTION_WITH_ATTACHMENTS
          : PROVIDER_RESPONSE_BODY_FLAG.RESPONSE_WITH_EXCEPTION
      );
      encoder.write(body);
    } else {
      if (body === undefined || body === null) {
        encoder.write(
          attach
            ? PROVIDER_RESPONSE_BODY_FLAG.RESPONSE_NULL_VALUE_WITH_ATTACHMENTS
            : PROVIDER_RESPONSE_BODY_FLAG.RESPONSE_NULL_VALUE
        );
      } else {
        encoder.write(
          attach
            ? PROVIDER_RESPONSE_BODY_FLAG.RESPONSE_VALUE_WITH_ATTACHMENTS
            : PROVIDER_RESPONSE_BODY_FLAG.RESPONSE_VALUE
        );
        encoder.write(body);
      }
    }

    if (attach) {
      encoder.write(
        Object.assign(attachments, {
          dubbo: this.conn.provider.version,
        })
      );
    }

    return encoder.byteBuffer._bytes.slice(0, encoder.byteBuffer._offset);
  }
}
