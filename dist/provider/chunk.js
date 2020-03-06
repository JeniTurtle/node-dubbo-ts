"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
const url = require("url");
class ServiceChunk {
    constructor(provider, options) {
        this.provider = provider;
        this.interfacename = options.interface;
        this.interfacegroup = options.group || '-';
        this.interfaceversion = options.version || '0.0.0';
        this.interfacerevision = options.revision || this.interfaceversion;
        this.interfacemethods = options.methods || [];
        this.interfacedelay = options.delay === undefined ? -1 : options.delay;
        this.interfaceretries = options.retries || 2;
        this.interfacetimout = options.timeout || 3000;
        this.interfacemethodparameters = options.parameters;
        this.interfacedescription = options.description;
    }
    get id() {
        return utils_1.getProviderServiceChunkId(this.interfacename, this.interfacegroup, this.interfaceversion);
    }
    get host() {
        return `${utils_1.localhost}:${this.provider.port}`;
    }
    setValue(value) {
        if (this.interfacetarget !== undefined)
            throw this.provider.error('Chunk.set', this.id + ' has already setted value.');
        Object.defineProperty(this, 'interfacetarget', { value });
    }
    async register() {
        const obj = {
            protocol: "dubbo",
            slashes: true,
            host: `${this.host}/${this.interfacename}`,
            query: {
                anyhost: true,
                application: this.provider.application,
                category: "providers",
                dubbo: this.provider.version,
                generic: false,
                heartbeat: this.provider.heartbeat,
                interface: this.interfacename,
                methods: this.interfacemethods.join(','),
                pid: this.provider.pid,
                revision: this.interfacerevision,
                side: 'provider',
                timestamp: Date.now(),
                version: this.interfaceversion,
                'default.group': this.interfacegroup,
                'default.delay': this.interfacedelay,
                'default.retries': this.interfaceretries,
                'default.timeout': this.interfacetimout,
            }
        };
        if (obj.query['default.group'] === '-')
            delete obj.query['default.group'];
        const dubboInterfaceURL = url.format(obj);
        const interface_root_path = `/${this.provider.root}/${this.interfacename}`;
        const interface_dir_path = interface_root_path + '/providers';
        const interface_entry_path = interface_dir_path + '/' + encodeURIComponent(dubboInterfaceURL);
        await this.provider.registry.create(interface_root_path, utils_1.CREATE_MODES.PERSISTENT);
        await this.provider.registry.create(interface_dir_path, utils_1.CREATE_MODES.PERSISTENT);
        await this.provider.registry.create(interface_entry_path, utils_1.CREATE_MODES.EPHEMERAL);
        this.zooKeeperRegisterPath = interface_entry_path;
        this.provider.logger.info(`[Provider Register]`, this.interfacename + ':', dubboInterfaceURL);
        return this;
    }
    unRegister() {
        if (this.zooKeeperRegisterPath) {
            return this.provider.registry.remove(this.zooKeeperRegisterPath);
        }
    }
}
exports.default = ServiceChunk;
