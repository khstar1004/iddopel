declare module "sharp" {
  interface SharpPipeline {
    png(): SharpPipeline;
    toBuffer(): Promise<Buffer>;
  }

  export default function sharp(input: Buffer | string): SharpPipeline;
}
