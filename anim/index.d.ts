export interface FadeOptions {
  duration?: number;
}

export interface CrossFadeOptions {
  duration?: number;
  name?: string;
}

export function fade(options?: FadeOptions): Animation;

export function crossFade(options?: CrossFadeOptions): Animation;
