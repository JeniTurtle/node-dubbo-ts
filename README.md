# node-dubbo-ts

Dubbo官网 [http://dubbo.apache.org](http://dubbo.apache.org)，它主要解决java服务的RPC通信问题，而`dubbo.ts`主要参考Dubbo理念，重写NODEJS端的dubbo的rpc通信。它提供一整套完整的包括从服务端到客户端的解决方案。

![dubbo](http://dubbo.apache.org/img/architecture.png)

作者参考了现有市面上的所有基于nodejs的dubbo框架，发现这些框架都只实现了客户端调用服务端的解决方案，而没有实现在nodejs上如何启动dubbo的RPC通讯的解决方案。在研究java源码的同时，将其思想迁移到nodejs上，以便nodejs可以直接通过zk注册后给java服务提供微服务的rpc调用。

> `dubbo.ts` 采用 `typescript` 编写。

如何使用到实际项目架构中，可以参考这个库的实现 [@nelts/dubbo](https://github.com/nelts/dubbo/blob/master/src/index.ts#L103)，它将duubo.ts通过AOP模型的设计，使其显得更加直观，也更加贴近JAVA的注解模式。可以来看一段代码：

> 注意： `dubbo.ts` 没有提供如下的注解，这里仅仅展示一个基于`@nelts/dubbo`设计的注解模型。

## 安装方式

```
npm install node-dubbo-ts
```


## ZooKeeper Install

参考 [https://note.youdao.com/ynoteshare1/index.html?id=98a4e01e9c83f8fc5d252d5cefcc34eb&type=note](https://note.youdao.com/ynoteshare1/index.html?id=98a4e01e9c83f8fc5d252d5cefcc34eb&type=note) 或者自己安装服务端。

## Get started

让我们一起来看看如何使用这个框架。

### Install

```bash
$ npm i node-dubbo-ts
```

### Usage

```ts
import { Registry, Provider, Consumer } from 'node-dubbo-ts';
```

#### Registry

基于zookeeper的服务注册发现。使用来第三方的库 [node-zookeeper-client](https://www.npmjs.com/package/node-zookeeper-client)

> This module is designed to resemble the ZooKeeper Java client API but with tweaks to follow the convention of Node.js modules. Developers that are familiar with the ZooKeeper Java client would be able to pick it up quickly.

创建一个新的registry

```ts
const registry = new Registry({
  host: '127.0.0.1:2181'
} as RegistryInitOptions);
await registry.connect();
registry.close();
```

Registry的初始化参数

```ts
export type RegistryInitOptions = {
  host: string, // zookeeper 地址.
  sessionTimeout?: number, // Session timeout in milliseconds, defaults to 30 seconds.
  spinDelay?: number, // The delay (in milliseconds) between each connection attempts.
  retries?: number, //  The number of retry attempts for connection loss exception.
  connectTimeout?: number, // zookeeper 连接超时时间（毫秒）
}
```

初始化完毕后需要连接

```ts
await registry.connect();
```

关闭连接

```ts
registry.close();
```

> 一般的，在`provider`或者`Consumer`中您无需关心什么时候连接，什么时候关闭，系统将自动处理。而你只要 `new Registry()`即可。

#### Provider

Dubbo的服务提供者，主要用于提供RPC通讯服务。

```ts
class CUATOM_SERVICE {
  hello() {
    return 123;
  }
}
// 创建对象
const provider = new Provider({
  application: 'test',
  dubbo_version: '2.0.2',
  port: 8080,
  pid: process.pid,
  registry: registry,
  heartbeat?: 60000,
} as ProviderInitOptions);
// 添加服务
// addService(service: any, configs: ProviderServiceChunkInitOptions)
provider.addService(CUATOM_SERVICE, {
  interface: 'xxx',
  version: 'x.x.x',
  group; 'xxxx',
  methods: ['xxx', 'ddd'],
  timeout: 3000
} as ProviderServiceChunkInitOptions);
provider.addService(...);
provider.addService(...);

// 监听服务
await provider.listen();

// 关闭服务
await provider.close();
```

Provider初始化参数

```ts
type ProviderInitOptions = {
  application: string; // 应用名
  root?: string; // 在zookeeper上路径的root名
  dubbo_version: string; // dubbo版本
  port: number; // 服务端口
  pid: number; // 服务进程ID
  registry?: Registry; // Registry对象
  heartbeat?: number; // 心跳频率，如果不指定，那么不进行心跳。
  logger?: Logger; // 日志对象
}
```

addService参数

```ts
type ProviderServiceChunkInitOptions = {
    interface: string; // 接口名
    revision?: string; // 接口修订版本，不指定默认为version值
    version?: string; // 版本
    group?: string; // 组
    methods: string[]; // 方法列表
    delay?: number; // 延迟调用时间（毫秒） 默认 -1 不延迟
    retries?: number; // 超时尝试次数 默认2次
    timeout?: number; // 请求超时时间 默认 3000ms
}
```

通过`listen`方法启动服务后，我们可以通过事件`data`来获取反序列化后的数据

```ts
import { ProviderContext, ProviderChunk, PROVIDER_CONTEXT_STATUS } from 'dubbo.ts';
provider.on('data', async (ctx: ProviderContext, chunk: ProviderChunk, next) => {
  // 反序列化数据
  const req = ctx.req;
  // 如果chunk.interfacetarget是一个class service
  // 那么我们可以这样写
  const app = new chunk.interfacetarget();
  const result = app[req.method](...req.parameters);
  ctx.body = result;
  ctx.status = PROVIDER_CONTEXT_STATUS.OK;
  next();
})
```

#### Consumer

消费者。它提供完整的服务调用方法和服务状态监听，及时创建或者销毁服务引用。

创建一个消费者对象

```ts
const consumer = new Consumer({
  application: 'dist',
  dubbo_version: '2.0.2',
  pid: process.pid,
  registry: registry,
});
```

开始监听消费者

```ts
await consumer.listen();
```

调用一个服务，返回一个`invoker`对象

```ts
const invoker = await consumer.get('com.mifa.stib.service.ProviderService');
```

调用服务的方法 `[Invoker].invoke(methodname, methodArgs)`;

- `methodname` 方法名
- `methodArgs` 方法参数数组

```ts
await invoker.invoke('testRpc', [java.combine('com.mifa.stib.common.RpcData', {
    data: {"name":"gxh","age":"18","word":""},
    headers: {
      appName: 'dist',
      platform: 1,
      equipment: 1,
      trace: 'dsafa-dsf-dsaf-sda-f-sa'
    },
    user: {
      id: 1
    },
  }
)])
```

停止服务

```ts
await consumer.close();
```

# Swagger

微服务swagger方法，采用zookeeper自管理方案。通过微服务启动，收集`interface`与`method`信息上报到自定义`zookeeper`节点来完成数据上报。前端服务，可以通过读取这个节点信息来获得具体的接口与方法。

上报格式:

```
/swagger/{subject}/{interface}/exports/{base64 data}
```

url参数：

- **subject** 总项目命名节点名
- **interface** 接口名
- **base64 data** 它是一个记录该接口下方法和参数的数组(最终base64化)，见以下参数格式。

base64 data 参数详解

```ts
type Base64DataType = {
  description?: string, // 该接口的描述
  group: string, // 组名 如果没有组，请使用字符串`-`
  version: string, // 版本名 如果没有版本，请使用字符串 `0.0.0`
  methods: [
    {
      name: string, // 方法名
      summary?: string, // 方法描述，摘要
      input: Array<{ $class: string, $schema: JSONSCHEMA; }>, // 入参
      output: JSONSCHEMA // 出参
    },
    // ...
  ]
}
```

最终将数据base64后再进行`encodeURIComponent`操作，最后插入zookeeper的节点即可。

在Provider程序中，我们可以这样使用来发布到zookeeper:

```ts
import { SwaggerProvider, Provider } from 'dubbo.ts';
const swagger = new SwaggerProvider('subject name', provider as Provider);
await swagger.publish(); // 发布
await swagger.unPublish(); // 卸载
```

使用`SwaggerConsumer`调用分布式swgger后得到的数据。

```ts
import { SwaggerConsumer, Registry } from 'dubbo.ts';
const swgger = new SwaggerConsumer('subject name', registry as Registry);
const resultTree = await swgger.get();
```

我们来看一个基于`egg-dubbo`的实例，在具体微服务的service上，我们可以这样写

```ts
// app/dubbo/service/oauth.ts

import { Service, Inject } from 'typedi';
import { RPCService, Response, Provider, Version, Description, Method, Summary, Param } from 'egg-dubbo';
import { OAuthTokenParams, OAuthTokenResp } from '../dto/oAuth';
import OAuthService from '@service/auth/oauth';

@Service()
@Provider('com.jeni.node.service.OAuthService')
@Version('1.0.0')
@Description('第三方授权认证服务')
export default class OAuthRPCService extends RPCService {
  @Inject()
  readonly oAuthService: OAuthService;

  @Method
  @Summary('获取第三方授权Token')
  @Response(OAuthTokenResp)
  async getAccessToken(@Param params: OAuthTokenParams) {
    const { sign, appId, appSecret, school, timestamp } = params;
    const thirdApp = await this.oAuthService.validateOAuth({
      sign,
      appId,
      appSecret,
      school,
      timestamp,
    });
    const accessToken = this.app.jwt.sign(
      {
        appId,
        school,
      },
      {
        expiresIn: thirdApp.tokenExpireTime || 2 * 60 * 60, // 默认有效期2小时
      },
    );
    return {
      token: this.ctx.helper.crypto.encrypt(accessToken),
    };
  }
}
```

```ts
// app/dubbo/dto/oauth.ts

import { IsDefined } from 'class-validator';
import { Type } from 'class-transformer';

export class OAuthTokenParams {
  @IsDefined({ message: '学校不能为空' })
  @Type(() => Number)
  school: number;

  @IsDefined({ message: 'appId不能为空' })
  @Type(() => String)
  appId: string;

  @IsDefined({ message: 'appSecret不能为空' })
  @Type(() => String)
  appSecret: string;

  @IsDefined({ message: '签名不能为空' })
  @Type(() => String)
  sign: string;

  @IsDefined({ message: '时间戳不能为空' })
  @Type(() => Number)
  timestamp: number;
}

export class OAuthTokenResp {
  @IsDefined({ message: 'Token不能为空' })
  @Type(() => String)
  token: string;
}
```

> 这种Swagger模式称为分布式swagger，它的优势在于，如果使用同一个zk注册中心，那么无论服务部署在那台服务器，都可以将swagger聚合在一起处理。
