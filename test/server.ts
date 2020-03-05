import { Registry, Provider, ProviderContext, PROVIDER_CONTEXT_STATUS, ProviderChunk, SwaggerProvider } from '../src';

class CUSTOM_SERVICE {
  hello(a: number, b: number) {
    return a + b;
  }
}

const registry = new Registry({
  host: '192.168.2.150:2181',
});

const provider = new Provider({
  application: 'test',
  dubbo_version: '2.0.2',
  port: 8080,
  pid: process.pid,
  registry,
  heartbeat: 60000,
});
const swagger = new SwaggerProvider('test', provider);
let closing = false;
process.on('SIGINT', () => {
  if (closing) return;
  closing = true;
  let closed = false;
  swagger.unPublish().then(() => provider.close()).then(() => closed = true).catch(e => {
    console.error(e);
    closed = true;
  });
  setInterval(() => {
    if (closed) {
      console.log('closed')
      process.exit(0);
    }
  }, 300);
});

provider.on('data', async (ctx: ProviderContext, chunk: ProviderChunk) => {
  // 反序列化数据
  const req = ctx.req;
  // 如果chunk.interfacetarget是一个class service
  // 那么我们可以这样写
  const app = new chunk.interfacetarget();
  const result = await app[req.method](...req.parameters);
  ctx.body = result;
  ctx.status = PROVIDER_CONTEXT_STATUS.OK;
});

provider.addService(CUSTOM_SERVICE, {
  interface: 'com.mifa.test',
  version: '1.0.0',
  methods: ['hello'],
  parameters: [
    {
      name: 'hello',
      summary: '何洛洛我',
      input: [
        {
          $class: 'java.util.integer',
          $schema: {
            type: 'integer'
          }
        }
      ],
      output: {
        type: 'integer'
      }
    }
  ]
});

provider.listen().then(() => swagger.publish()).then(() => console.log('service published')).catch(e => console.error(e));