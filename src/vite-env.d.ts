/// <reference types="vite/client" />

interface Window {
  __sharkyGame?: any;
  __sharkyTest?: {
    start(): void;
    startActive(): void;
    advance(delta: number): void;
    pause(): void;
    resume(): void;
    boost(): void;
    state(): {
      round: { remainingMs: number; settled: boolean; phase: string };
      paused: boolean;
      boostState: string;
      stunnedRemainingMs: number;
      audio: { paused: boolean; musicActive: boolean; contextState: string };
      sharkTexture?: string;
      sharkType?: string;
      activeFish: number;
      fishTextures: (string | undefined)[];
    };
    collide(fishId: string): void;
    stunProbe(): { initial: number; beforeExpiry: number; afterExpiry: number };
    consumeExisting(count: number): number;
    edgeProbe(): { x: number; velocityX: number; minimumX: number };
    directionProbe(): {
      right: { velocityX: number; flipped: boolean };
      left: { velocityX: number; flipped: boolean };
    };
    artProbe(): {
      shark: { width: number; height: number };
      fish: Record<string, { width: number; height: number }>;
    };
    sharkHeadingProbe(): {
      rightDown: { rotation: number; flipped: boolean };
      rightUp: { rotation: number; flipped: boolean };
      leftDown: { rotation: number; flipped: boolean };
      leftUp: { rotation: number; flipped: boolean };
    };
    animationProbe(): {
      sharkStart: { x: number; y: number };
      sharkLater: { x: number; y: number };
      fishStart: number;
      fishLater: number;
    };
    grant(coins: number): void;
    buy(upgradeId: string): unknown;
    level(id: string): void;
  };
}

declare const __E2E__: boolean;
