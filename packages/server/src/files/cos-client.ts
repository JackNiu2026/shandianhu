import COS from "cos-nodejs-sdk-v5";

export const FILE_URL_TTL_SECONDS = 10 * 60;

export interface FileSigner {
  signPut(input: { objectKey: string; contentType: string; expiresInSeconds: number }): Promise<string>;
  signGet(input: { objectKey: string; expiresInSeconds: number }): Promise<string>;
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

  async signPut({ objectKey, expiresInSeconds }: Parameters<FileSigner["signPut"]>[0]): Promise<string> {
    const { client, configuration } = this.getClient();
    return client.getObjectUrl({
      Bucket: configuration.bucket,
      Region: configuration.region,
      Key: objectKey,
      Method: "PUT",
      Sign: true,
      Expires: expiresInSeconds,
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

  private getClient(): { client: COS; configuration: CosConfiguration } {
    const configuration = this.configuration ?? environmentConfiguration();
    this.client ??= new COS({ SecretId: configuration.secretId, SecretKey: configuration.secretKey });
    return { client: this.client, configuration };
  }
}
