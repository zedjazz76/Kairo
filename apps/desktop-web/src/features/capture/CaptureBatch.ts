import type { CoreCommandV1 } from "../../../../../shared/contracts/generated/contracts.v1.ts";

export type CaptureBatchItem = {
  sourceRef: string;
  name: string;
  sizeBytes: number;
  mediaType: string;
};

export type CaptureBatchOptions = {
  captureSessionId: string;
  createRequestId?: () => string;
};

export class CaptureBatch {
  private readonly captureSessionId: string;
  private readonly createRequestId: () => string;
  private readonly stagedItems: Array<CaptureBatchItem & { requestId: string }> = [];

  constructor(options: CaptureBatchOptions) {
    this.captureSessionId = options.captureSessionId;
    this.createRequestId = options.createRequestId ?? (() => crypto.randomUUID());
  }

  get items(): readonly CaptureBatchItem[] {
    return this.stagedItems.map(({ requestId: _, ...item }) => item);
  }

  stage(item: CaptureBatchItem): void {
    this.stagedItems.push({ ...item, requestId: this.createRequestId() });
  }

  commands(): CoreCommandV1[] {
    return this.stagedItems.map((item, index) => ({
      requestId: item.requestId,
      type: "CaptureSource",
      contractVersion: "v1",
      payload: {
        captureSessionId: this.captureSessionId,
        sourceRef: item.sourceRef,
      },
    }));
  }
}
