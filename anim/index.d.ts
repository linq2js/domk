export interface FadeOptions {
  duration?: number;
}

export interface CrossFadeOptions {
  duration?: number;
  name?: string;
}

export interface FadeExports extends Function, Animation {
  (options?: FadeOptions): Animation;
}

export interface CrossFadeExports extends Function, Animation {
  (options?: CrossFadeOptions): Animation;
}

export const fade: FadeExports;

export const crossFade: CrossFadeExports;
