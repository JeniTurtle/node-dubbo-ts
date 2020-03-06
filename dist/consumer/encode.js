"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
const hassin = require('hessian.js');
function Encode(options) {
    const body = encodeBody(options);
    const head = encodeHead(options.requestId, body.length);
    return Buffer.concat([head, body]);
}
exports.default = Encode;
function encodeHead(requestId, payload) {
    const header = Buffer.alloc(utils_1.DUBBO_HEADER_LENGTH);
    header[0] = utils_1.DUBBO_MAGIC_HEADER >>> 8;
    header[1] = utils_1.DUBBO_MAGIC_HEADER & 0xff;
    header[2] = utils_1.FLAG_REQEUST | utils_1.HESSIAN2_SERIALIZATION_CONTENT_ID | utils_1.FLAG_TWOWAY;
    setRequestId(requestId, header);
    if (payload > 0 && payload > utils_1.DUBBO_DEFAULT_PAY_LOAD) {
        throw new Error(`Data length too large: ${payload}, max payload: ${utils_1.DUBBO_DEFAULT_PAY_LOAD}`);
    }
    header.writeUInt32BE(payload, 12);
    return header;
}
function setRequestId(requestId, header) {
    const buffer = utils_1.toBytes8(requestId);
    header[4] = buffer[0];
    header[5] = buffer[1];
    header[6] = buffer[2];
    header[7] = buffer[3];
    header[8] = buffer[4];
    header[9] = buffer[5];
    header[10] = buffer[6];
    header[11] = buffer[7];
}
function encodeBody(options) {
    const encoder = new hassin.EncoderV2();
    const { dubboVersion, dubboInterface, version, methodName, methodArgs } = options;
    encoder.write(dubboVersion);
    encoder.write(dubboInterface);
    encoder.write(version);
    encoder.write(methodName);
    encoder.write(getParameterTypes(methodArgs));
    if (methodArgs && methodArgs.length) {
        for (let arg of methodArgs) {
            encoder.write(arg);
        }
    }
    encoder.write(getAttachments(options));
    return encoder.byteBuffer._bytes.slice(0, encoder.byteBuffer._offset);
}
function getParameterTypes(args) {
    if (!(args && args.length))
        return '';
    const primitiveTypeRef = {
        void: 'V',
        boolean: 'Z',
        byte: 'B',
        char: 'C',
        double: 'D',
        float: 'F',
        int: 'I',
        long: 'J',
        short: 'S',
    };
    const desc = [];
    for (let arg of args) {
        let type = arg['$class'];
        if (type[0] === '[') {
            desc.push('[');
            type = type.slice(1);
        }
        if (primitiveTypeRef[type]) {
            desc.push(primitiveTypeRef[type]);
        }
        else {
            desc.push('L');
            desc.push(type.replace(/\./gi, '/'));
            desc.push(';');
        }
    }
    return desc.join('');
}
function getAttachments(options) {
    const { path, dubboInterface, group, timeout, version, application, attachments } = options;
    const map = Object.assign({
        path: path || dubboInterface,
        interface: dubboInterface,
        version: version || '0.0.0',
    }, attachments || {});
    group && (map['group'] = group);
    timeout && (map['timeout'] = timeout);
    application && (map['application'] = application);
    let attachmentsHashMap = {
        $class: 'java.util.HashMap',
        $: map,
    };
    return attachmentsHashMap;
}
