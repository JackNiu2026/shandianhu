import COS from "cos-nodejs-sdk-v5";

export const FILE_URL_TTL_SECONDS = 10 * 60;

export interface FileSigner {
  signPut(input: {
    objectKey: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds: number;
  }): Promise<string>;
  signGet(input: { objectKey: string; expiresInSeconds: number }): Promise<string>;
  /** 永久删除 COS 对象（用于隐私清理等场景） */
  remove(input: { objectKey: string }): Promise<void>;
}

type CosConfiguration = {
  bucket: string;
  region: string;
  secretId: string;
  secretKey: string;
};

function environmentConfiguration(): CosConfiguration {
  const configuration = {
    bucket: process.env.COS_BUCKET,
    region: process.env.COS_REGION,
    secretId: process.env.COS_SECRET_ID,
    secretKey: process.env.COS_SECRET_KEY,
  };

  if (Object.values(configuration).some((value) => !value)) {
    throw new Error("COS configuration is incomplete");
  }

  return configuration as CosConfiguration;
}

export class CosFileSigner implements FileSigner {
  private client: COS | undefined;

  constructor(private readonly configuration?: CosConfiguration) {}

  async signPut({
    objectKey,
    contentType,
    contentLength,
    expiresInSeconds,
  }: Parameters<FileSigner["signPut"]>[0]): Promise<string> {
    const { client, configuration } = this.getClient();
    return client.getObjectUrl({
      Bucket: configuration.bucket,
      Region: configuration.region,
      Key: objectKey,
      Method: "PUT",
      Sign: true,
      Expires: expiresInSeconds,
      Headers: {
        "Content-Type": contentType,
        "Content-Length": String(contentLength),
      },
    });
  }

  async signGet({ objectKey, expiresInSeconds }: Parameters<FileSigner["signGet"]>[0]): Promise<string> {
    const { client, configuration } = this.getClient();
    return client.getObjectUrl({
      Bucket: configuration.bucket,
      Region: configuration.region,
      Key: objectKey,
      Method: "GET",
      Sign: true,
      Expires: expiresInSeconds,
    });
  }

  async remove({ objectKey }: Parameters<FileSigner["remove"]>[0]): Promise<void> {
    const { client, configuration } = this.getClient();
    await client.deleteObject({
      Bucket: configuration.bucket,
      Region: configuration.region,
      Key: objectKey,
    });
  }

  private getClient(): { client: COS; configuration: CosConfiguration } {
    const configuration = this.configuration ?? environmentConfiguration();
    this.client ??= new COS({ SecretId: configuration.secretId, SecretKey: configuration.secretKey });
    return { client: this.client, configuration };
  }
}
