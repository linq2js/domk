export interface Options<TModel = any> {
  model?: TModel | (() => TModel);
  tag?: string;
  container?: Node;
  updating?: ComponentHandler<"updating">;
  updated?: ComponentHandler<"updated">;
  dispatched?: ComponentHandler<"dispatched">;
  init?: Function;
  [key: string]: any;
}

export type EventHandler<T> = (args: T) => any;

export type ComponentHandler<TType extends string> = EventHandler<{
  type: TType;
  target: Component<any>;
  action: any;
  payload: any;
  container: Node;
  model: any;
  context: TType extends "dispatch" ? never : Context<any>;
}>;

export type Action<TPayload = never, TReturn = void, TContext = never> = (
  payload?: TPayload,
  context?: TContext
) => TReturn;

export interface Context<TModel> {
  rootModel: any;
  rootContainer: Node;
  container: Node;
  node: Node;
  component: Component<TModel>;
  state<T>(defaultValue: T): T;
  dispatch<TPayload, TReturn>(
    action: Action<TPayload, TReturn, Context<TModel>>,
    payload?: TPayload
  ): TReturn;
  dispatch(...args: any[]): void;
  [key: string]: any;
  update(): void;
  updateContainer(): void;
  invoke(ref: string, ...args: any[]): any;
}

export interface BindingResult<TModel> {
  id?: any;
  name?: any;
  class?: Classes | any;
  style?: Styles | any;
  text?: any;
  html?: any;

  init?: ((node?: Node, context?: Context<any>) => Node | any) | Node | any;
  on?: Events;
  prop?: Properties;
  attr?: Attributes;
  children?: ChildrenOptions<any, TModel>;

  selected?: any;
  checked?: any;
  disabled?: any;
  value?: any;
  title?: any;
  href?: any;

  visible?: any;
}

export type ItemInfer<TChildren> = TChildren extends number
  ? number
  : TChildren extends Array<infer TItem>
  ? TItem
  : never;

export interface ChildrenOptions<TChildren, TModel> {
  key?: (item?: ItemInfer<TChildren>, index?: number) => any;
  model: TChildren;
  update:
    | Component<ItemInfer<TChildren>>
    | BindingDelegate<
        ItemInfer<TChildren>,
        BindingResult<ItemInfer<TChildren>> | void,
        TModel
      >;
  anim?: Animation | Function | Animation[];
}

export type BindingDelegate<
  TModel,
  TResult = any,
  TContextModel = Context<TModel>
> = (model?: TModel, context?: TContextModel) => TResult;

export interface Properties {
  [key: string]: any;
}

export interface Attributes {
  [key: string]: any;
}

export interface Events {
  [key: string]: (e: Event) => any;
}

export interface Styles {
  [key: string]: any;
}

export interface Classes {
  [key: string]: any;
}

export type QuerySelector = "this" | string;

export type Binding<TModel> = BindingDelegate<TModel, BindingResult<TModel>>;

export interface Animation {
  in?: AnimationInOut;
  out?: AnimationInOut;
}

export type AnimationInOut = (node?: Node, key?: any) => any;

export interface Bindable<TModel> {
  one(
    query: QuerySelector,
    binding:
      | Component<TModel>
      | Binding<TModel>
      | BindingResult<TModel>
      | string
  ): Component<TModel>;
  one<TModelMapping>(
    query: QuerySelector,
    binding: [BindingDelegate<TModel, TModelMapping>, Component<TModelMapping>]
  ): Component<TModel>;
  all(
    query: QuerySelector,
    binding:
      | Component<TModel>
      | Binding<TModel>
      | BindingResult<TModel>
      | string
  ): Component<TModel>;
  all<TModelMapping>(
    query: QuerySelector,
    binding: [BindingDelegate<TModel, TModelMapping>, Component<TModelMapping>]
  ): Component<TModel>;
}

export interface Component<TModel> extends Bindable<TModel> {
  bind(): void;
  bind(model: TModel, container?: Node);
  bind(container: Node);
  withRef(id: string): Binding<any>;
  withModel(
    modelFn: (model?: any, context?: Context<any>) => any
  ): Binding<any>;
}

export interface DynamicValue<T> {}

export interface AsyncValue<T> extends DynamicValue<T> {
  map<U>(resolved: T, loading?: U | (() => U)): DynamicValue<U>;
}

export interface AsyncValueOptions<T> {
  loading?: T | (() => T);
  error?(reason: any): T;
}

export interface DefaultExports extends Bindable<any> {
  <TModel = any>(options?: Options<TModel>): Component<TModel>;

  nested(
    modelFn: BindingDelegate<any>,
    keyFn: (item?: any, index?: number) => any
  ): Binding<any>;

  children(model: number): Binding<any>;
  children(modelFn: BindingDelegate<any>): Binding<any>;

  children(model: number, component: Component<number>): Binding<any>;
  children(
    modelFn: BindingDelegate<any>,
    component: Component<any>
  ): Binding<any>;

  children(
    model: number,
    updateFn: BindingDelegate<number, BindingResult<number>>
  ): Binding<any>;
  children(
    modelFn: BindingDelegate<any>,
    updateFn: BindingDelegate<any, BindingResult<any>>
  ): Binding<any>;

  children(
    model: number,
    keyFn: (item?: number, index?: number) => any,
    updateFn: BindingDelegate<number, BindingResult<number>>
  ): Binding<any>;
  children(
    modelFn: BindingDelegate<any>,
    keyFn: (item?: any, index?: number) => any,
    updateFn: BindingDelegate<any, BindingResult<any>>
  ): Binding<any>;

  children(
    model: BindingDelegate<number>,
    keyFn: (item?: number, index?: number) => any,
    component: Component<number>
  ): Binding<any>;
  children(
    modelFn: BindingDelegate<any>,
    keyFn: (item?: any, index?: number) => any,
    component: Component<any>
  ): Binding<any>;

  async<T>(promise: Promise<T>, options?: AsyncValueOptions<T>): AsyncValue<T>;
}

declare const domk: DefaultExports;

export default domk;
