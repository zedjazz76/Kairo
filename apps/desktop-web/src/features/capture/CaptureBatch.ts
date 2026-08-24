import type { CoreCommandV1 } from "../../../../../shared/contracts/generated/contracts.v1.ts";

export type CaptureBatchItem = {
  sourceRef: string;
  name: string;
  sizeBytes: number;
  mediaType: string;
};

export type CaptureBatchOptions = {
  captureSessionId: string;
};

export class CaptureBatch {
  private readonly captureSessionId: string;
  private readonly stagedItems: CaptureBatchItem[] = [];

  constructor(options: CaptureBatchOptions) {
    this.captureSessionId = options.captureSessionId;
  }

  get items(): readonly CaptureBatchItem[] {
    return this.stagedItems;
  }

  stage(item: CaptureBatchItem): void {
    this.stagedItems.push({ ...item });
  }

  commands(): CoreCommandV1[] {
    return this.stagedItems.map((item, index) => ({
      requestId: `${this.captureSessionId}:${index + 1}`,
      type: "CaptureSource",
      contractVersion: "v1",
      payload: {
        captureSessionId: this.captureSessionId,
        sourceRef: item.sourceRef,
      },
    }));
  }
}
