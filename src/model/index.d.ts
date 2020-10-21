export interface ModelBase {}

export type Model<T> = T & ModelBase;

export interface DefaultExports extends Function {
  <T extends { [key: string]: any }>(props: T): Model<T>;
  <T>(initial: T, reducer: (current: T, ...args: any[]) => T): Model<T>;
  <T>(reducer: (current: T, ...args: any[]) => T): Model<T>;
}

declare const model: DefaultExports;

export default model;
