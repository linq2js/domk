const defaultContainer = document;
const templateClassName = "domk-template";
const hideClassName = "domk-hide";
const unset = {};
const defaultKeyAccessor = (model, index) => index;
const updateText = (model) => ({ text: model });
const componentType = () => {};
const templateType = () => {};
const defaultAnimations = { in: [], out: [], flip: [] };
const predefinedProps = {
  selected: true,
  disabled: true,
  checked: true,
  value: true
};
const defaultModelSelector = (model) => model;
let lastQuery;
let dispatchScopes = 0;
let pendingUpdates = new Set();

const predefinedAttrs = {
  id: true,
  href: true,
  title: true,
  name: true
};

export default function domk({
                               container = defaultContainer,
                               model,
                               handler,
                               init,
                               updated,
                               updating,
                               dispatched,
                               ...contextProps
                             } = {}) {
  return createComponent({
    container,
    model,
    handler,
    init,
    updated,
    updating,
    dispatched,
    contextProps
  });
}

function createComponent(options) {
  const instance = {
    _type: componentType,
    _update,
    _options: options,
    update,
    all,
    one,
    withRef,
    withModel
  };
  let bindings = [];
  let unsubscribe;
  let initialized = false;

  function withModel(modelFn) {
    return [modelFn, instance];
  }

  function withRef(id) {
    if (!options.handler) return instance;

    return function (model, context) {
      context.state().__handlers[id] = options.handler(
        context,
        (inputModel = model) => _update(inputModel, context),
        model
      );
      _update(model, context);
    };
  }

  function update(...args) {
    let model, container;
    if (!args.length) {
      model = options.model;
      container = options.container;
    } else if (args.length > 1) {
      [model, container] = args;
    } else if (args[0] && typeof args[0].cloneNode === "function") {
      model = options.model;
      container = args[0];
    } else {
      model = args[0];
      container = options.container;
    }

    if (typeof container === "string") {
      container = query(document, container, false)[0] || defaultContainer;
    }

    if (!container) {
      return;
    }

    if (typeof model === "function") {
      model = model();
    }

    const updater = () => update(...args);
    let dynamicModel;

    if (model) {
      if (typeof model.subscribe === "function") {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
        dynamicModel = model;
        unsubscribe = dynamicModel.subscribe(() => {
          const rootModel = dynamicModel.getState();
          _update(
            rootModel,
            createComponentContext(
              updater,
              {
                update: updater,
                rootContainer: container,
                rootComponent: instance,
                component: instance,
                container,
                rootModel
              },
              dynamicModel.dispatch
            )
          );
        });
      }
      if (typeof model.getState === "function") {
        model = model.getState();
      }
    }
    _update(
      model,
      createComponentContext(
        updater,
        {
          update: updater,
          rootContainer: container,
          rootComponent: instance,
          container,
          rootModel: model,
          component: instance
        },
        dynamicModel && dynamicModel.dispatch
      )
    );
  }

  function _update(model, context) {
    if (!initialized && typeof options.init === "function") {
      initialized = true;
      options.init(update);
    }

    const newContext = Object.assign({}, options.contextProps, context, {
      container: context.node || context.container,
      component: instance,
      model,
      updateContainer: (inputModel = model) => _update(inputModel, context)
    });

    if (typeof options.updating === "function") {
      options.updating({
        type: "updating",
        target: instance,
        container: newContext.container,
        model,
        context
      });
    }

    for (let i = 0; i < bindings.length; i++) {
      bindings[i](model, newContext);
    }
    if (typeof options.updated === "function") {
      options.updated({
        type: "updated",
        target: instance,
        container: newContext.container,
        model,
        context
      });
    }
  }

  function one(selector, binding) {
    bindings.push(createBinding(false, selector, binding));
    return instance;
  }

  function all(selector, binding) {
    bindings.push(createBinding(true, selector, binding));
    return instance;
  }

  return instance;
}

function createComponentContext(updater, props, customDispatch) {
  props.dispatch = function dispatch() {
    try {
      if (!dispatchScopes) {
        pendingUpdates.clear();
      }
      dispatchScopes++;
      if (typeof customDispatch === "function") {
        return customDispatch(...arguments);
      }
      const [action, payload] = arguments;
      const result = action(payload, props);
      if (isPromiseLike(result)) {
        return result.finally(updater);
      }
      pendingUpdates.add(updater);
      return result;
    } finally {
      dispatchScopes--;
      if (props.component._options.dispatched) {
        props.component._options.dispatched({
          type: "dispatch",
          target: props.component,
          action: arguments[0],
          payload: arguments[1],
          container: props.rootContainer,
          model: props.rootModel
        });
      }
      if (!dispatchScopes) {
        pendingUpdates.forEach((update) => update());
      }
    }
  };
  return props;
}

function query(container, selector, all) {
  if (selector === "this") {
    return [container];
  }

  if (
    lastQuery &&
    lastQuery.container === container &&
    lastQuery.selector === selector &&
    lastQuery.all === all
  ) {
    return lastQuery.result;
  }

  lastQuery = { container, selector, all };

  // auto prepend :scope to selector
  if (/^\s*>/.test(selector)) {
    selector = ":scope " + selector;
  }

  if (all) {
    return (lastQuery.result = Array.from(
      container.querySelectorAll(selector)
    ));
  }

  const element = container.querySelector(selector);
  if (element) return (lastQuery.result = [element]);
  return (lastQuery.result = []);
}

function createBindingContext(context, node, props) {
  function state() {
    return getData(
      context.container,
      context.component,
      () => {
        return {
          __handlers: {}
        };
      },
      "state"
    );
  }
  return Object.assign({}, context, props, {
    node,
    invoke(id, ...args) {
      const handler = state().__handlers[id];
      return handler && handler(...args);
    },
    state
  });
}

function isComponent(value) {
  return value && value._type === componentType;
}

function createBinding(all, selector, binding) {
  let modelSelector;

  if (
    typeof binding === "string" ||
    (typeof binding === "function" && binding._type === templateType)
  ) {
    binding = {
      init: binding
    };
  }

  if (Array.isArray(binding)) {
    modelSelector = binding[0];
    binding = binding[1];
  }
  if (isComponent(binding)) {
    return function (model, context) {
      if (modelSelector) {
        model = modelSelector(model, context);
      }

      const nodes = query(context.container, selector, all);
      for (let i = 0; i < nodes.length; i++) {
        binding._update(model, createBindingContext(context, nodes[i]));
      }
    };
  }
  if (typeof binding === "object") {
    const result = binding;
    binding = () => result;
  }
  return function bindingFn(model, context) {
    const nodes = query(context.container, selector, all);
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      function update(inputModel = model) {
        const result = binding(
          inputModel,
          createBindingContext(context, node, { updateNode: update })
        );
        if (typeof result === "object") {
          updateNode(node, bindingFn, context, result);
        }
      }
      update(model);
    }
  };
}

function getData(node, key, init, prop = "default") {
  if (!node.__data) {
    node.__data = new WeakMap();
  }
  let data = node.__data.get(key);
  if (!data) {
    data = {};
    node.__data.set(key, data);
    if (!(prop in data)) {
      data[prop] = typeof init === "function" ? init() : init || {};
    }
  }
  return data[prop];
}

function getNodeInitialData(node) {
  if (!node.__initialData) {
    node.__initialData = {
      style: (node.getAttribute("style") || "") + ";",
      class: (node.getAttribute("class") || "") + " "
    };
  }
  return node.__initialData;
}

function updateNode(node, bindingKey, context, result) {
  const initialData = getNodeInitialData(node);
  const bindingData = getData(node, bindingKey, () => ({
    initialized: false,
    childTemplate: false,
    keyList: [],
    nodeMap: {}
  }));

  if (!node.__model) {
    node.__model = {};
  }

  // init should run first

  if (!bindingData.initialized && "init" in result) {
    bindingData.initialized = true;
    let init = result.init;

    if (typeof init === "function") {
      init = init(node, context);
    }

    // multiple init actions can be called with same node but the initial content is applied once
    if (
      typeof init !== "undefined" &&
      init !== null &&
      !node.__contentInitialized
    ) {
      node.__contentInitialized = true;
      if (init && typeof init.cloneNode === "function") {
        node.appendChild(init.cloneNode(true));
      } else {
        node.innerHTML = "" + init;
      }

      lastQuery = undefined;
    }
  }

  if (result.prop) {
    Object.entries(result.prop).forEach(([name, value]) =>
      updateProperty(node, node.__model, name, value)
    );
  }

  if (result.on) {
    Object.entries(result.on).forEach(([name, value]) =>
      updateListener(node, node.__model, context, name, value)
    );
  }

  if (result.attr) {
    Object.entries(result.attr).forEach(([name, value]) =>
      updateAttribute(node, node.__model, name, value)
    );
  }

  for (const key in result) {
    const value = result[key];
    if (predefinedAttrs[key]) {
      updateAttribute(node, node.__model, key, value);
    } else if (predefinedProps[key]) {
      updateProperty(node, node.__model, key, value);
    } else {
      switch (key) {
        case "class":
          updateClass(node, node.__model, value, initialData.class);
          break;
        case "style":
          updateStyle(node, node.__model, value, initialData.style);
          break;
        case "text":
          tryUpdate(result.text, node.__model, "text", (value) => {
            node.textContent = value;
            lastQuery = undefined;
          });
          break;
        case "html":
          tryUpdate(result.html, node.__model, "html", (value) => {
            node.innerHTML = value;
            lastQuery = undefined;
          });
          break;
        case "visible":
          tryUpdate(value, node.__model, "visible", (value) => {
            node.classList.toggle(hideClassName, !value);
            lastQuery = undefined;
          });
          break;
        default:
          // event listener
          if (key.charAt(0) === "$") {
            updateListener(node, node.__model, context, key.substr(1), value);
          }
          break;
      }
    }
  }

  if (result.children && typeof result.children.update !== "undefined") {
    if (bindingData.childTemplate === false) {
      bindingData.childTemplate = node.firstElementChild.cloneNode(true);
      bindingData.childTemplate.classList.remove(templateClassName);
      node.innerHTML = "";
    }
    if (bindingData.childTemplate) {
      updateChildNodes(node, bindingData, context, result.children);
    }
  }
}

function startAnimation(key, node, animations) {
  for (let i = 0; i < animations.length; i++) {
    animations[i](node, key);
  }
}

/**
 * TODO: improve diffing algorithm
 * @param parentNode
 * @param bindingData
 * @param context
 * @param keyAccessor
 * @param anim
 * @param childModels
 * @param update
 */
function updateChildNodes(
  parentNode,
  bindingData,
  context,
  { key: keyAccessor = defaultKeyAccessor, anim, model: childModels, update }
) {
  const animations = anim
    ? normalizeAnimations(Array.isArray(anim) ? anim : [anim])
    : defaultAnimations;

  if (isComponent(update)) {
    update = update._update;
  }
  // support array or number only
  if (!Array.isArray(childModels) && typeof childModels !== "number") {
    return;
  }

  lastQuery = undefined;

  const isArray = Array.isArray(childModels);
  const length = isArray ? childModels.length : childModels;
  const keyList = [];
  const nodeMap = {};

  for (let i = 0; i < length; i++) {
    const childModel = isArray ? childModels[i] : i;
    // convert key to string
    const key = "" + keyAccessor(childModel, i);
    let childNode;
    if (!(key in bindingData.nodeMap)) {
      childNode = bindingData.childTemplate.cloneNode(true);
      childNode.__isNew = true;
    } else {
      childNode = bindingData.nodeMap[key];
    }
    keyList[i] = key;
    nodeMap[key] = childNode;
    delete bindingData.nodeMap[key];
  }

  for (let i = bindingData.keyList.length - 1; i >= 0; i--) {
    const key = bindingData.keyList[i];
    const prevNode = bindingData.nodeMap[key];
    if (prevNode) {
      bindingData.keyList.splice(i, 1);
      startAnimation(key, prevNode, animations.out);
      parentNode.removeChild(prevNode);
    }
  }
  let lastNode;
  for (let i = length - 1; i >= 0; i--) {
    const childModel = isArray ? childModels[i] : i;
    const currentKey = keyList[i];
    const currentNode = nodeMap[currentKey];
    const prevKey =
      i >= bindingData.keyList.length ? unset : bindingData.keyList[i];
    if (prevKey === unset) {
      parentNode.insertBefore(currentNode, lastNode);
    } else if (currentKey !== prevKey) {
      parentNode.insertBefore(currentNode, lastNode);
    }
    updateChildNode(currentNode, childModel, context, update);
    if (currentNode.__isNew) {
      delete currentNode.__isNew;
      startAnimation(currentKey, currentNode, animations.in);
    }
    lastNode = currentNode;
  }

  bindingData.nodeMap = nodeMap;
  bindingData.keyList = keyList;
}

function updateChildNode(childNode, childModel, context, update) {
  const childContext = Object.assign({}, context, {
    parent: context.node,
    node: childNode
  });

  const updateResult = update(childModel, childContext);

  if (typeof updateResult === "object" && !isComponent(updateResult)) {
    updateNode(childNode, childNode, childContext, updateResult);
  }
}

function init() {
  if (!document.querySelector("#domk-styles")) {
    const styleElement = document.createElement("style");
    styleElement.id = "domk-styles";
    styleElement.type = "text/css";
    const styles = `.${templateClassName} {display: none !important;} .${hideClassName} {display: none !important;}`;
    const styleContainer = document.querySelector("head") || document.body;

    if (styleElement.styleSheet) {
      styleElement.styleSheet.cssText = styles;
    } else {
      styleElement.appendChild(document.createTextNode(styles));
    }
    styleContainer.appendChild(styleElement);
  }
}

function isPromiseLike(obj) {
  return obj && typeof obj.then === "function";
}

function isEqual(a, b) {
  if (a === b) {
    return true;
  }

  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    isPromiseLike(a) ||
    isPromiseLike(b) ||
    Array.isArray(a) ||
    Array.isArray(b)
  )
    return false;
  if (a === null && b) return false;
  if (b === null && a) return false;

  const comparer = (key) => {
    return a[key] === b[key];
  };
  return Object.keys(a).every(comparer) && Object.keys(b).every(comparer);
}

function tryUpdate(value, bag, key, update) {
  if (typeof value !== "function") {
    return update(value);
  }

  const token = {};
  const dynamicKey = "d:" + key;
  const isCancel = () => bag[dynamicKey] !== token;
  bag[dynamicKey] = token;
  const result = value((next) => {
    if (isCancel()) return;
    update(next);
  });
  // is iterator
  if (result && typeof result.next === "function") {
    handleIterableValue(result, update, isCancel);
  }
}

function handleIterableValue(iterator, update, isCancel) {
  function next(payload, init) {
    if (isCancel()) return;
    if (!init) {
      update(payload);
    }
    const result = iterator.next(payload);
    if (isPromiseLike(result)) {
      return result.then(({ value, done }) => !done && next(value));
    }
    return !result.done && next(result.value);
  }

  next(undefined, true);
}

function updateStyle(node, bag, value, initial) {
  if (bag.style === value) return;
  bag.style = value;
  if (typeof value === "object") {
    for (const key in value) {
      // noinspection JSUnfilteredForInLoop
      tryUpdate(value[key], bag, "style." + key, (value) => {
        node.style.setProperty(key, value);
        lastQuery = undefined;
      });
    }
  } else {
    tryUpdate(value, bag, "style", (value) => {
      node.style = initial + value;
      lastQuery = undefined;
    });
  }
}

function updateClass(node, bag, value, initial) {
  if (isEqual(bag.style, value)) return;

  bag.style = value;
  if (typeof value === "object") {
    for (const token in value) {
      // noinspection JSUnfilteredForInLoop
      const force = value[token];
      tryUpdate(force, bag, "class." + token, (value) => {
        node.classList.toggle(token, !!value);
        lastQuery = undefined;
      });
    }
  } else {
    tryUpdate(value, bag, "class", (value) => {
      node.className = initial + value;
      lastQuery = undefined;
    });
  }
}

function updateProperty(node, bag, name, value) {
  const key = "p:" + name;
  if (bag[key] === value) return;
  bag[key] = value;
  tryUpdate(value, bag, key, (value) => {
    node[name] = value;
    lastQuery = undefined;
  });
}

function updateListener(node, bag, context, name, value) {
  const key = "e:" + name;
  if (Array.isArray(value)) {
    const [action, payload] = value;
    const hasPayload = value.length > 1;
    if (hasPayload) {
      if (typeof payload === "function") {
        value = (e) => {
          return context.dispatch(
            action,
            payload({ ...context, node, event: e })
          );
        };
      } else {
        value = () => {
          return context.dispatch(action, payload);
        };
      }
    } else {
      value = (e) => {
        return context.dispatch(action, e);
      };
    }
  }
  if (bag[key] === value) return;
  // custom event
  if (name.charAt(0) === "$") {
    if (typeof bag[key] === "function") {
      node.removeEventListener(name.substr(1), bag[key]);
    }
    node.addEventListener(name.substr(1), value);
  } else {
    node["on" + name] = value;
  }
  bag[key] = value;
}

function normalizeAnimations(animations) {
  const result = { in: [], out: [], flip: [] };
  for (let i = 0; i < animations.length; i++) {
    let anim = animations[i];
    if (typeof anim === "function") {
      anim = { in: anim };
    }
    if (anim.in) {
      result.in.push(anim.in);
    }
    if (anim.out) {
      result.out.push(anim.out);
    }
    if (anim.flip) {
      result.flip.push(anim.flip);
    }
  }

  return result;
}

function updateAttribute(node, bag, name, value) {
  const key = "a:" + name;
  if (bag[key] === value) return;
  bag[key] = value;
  tryUpdate(value, bag, key, (value) => {
    node.setAttribute(name, value);
    lastQuery = undefined;
  });
}

Object.assign(domk, {
  one() {
    return domk().one(...arguments);
  },
  all() {
    return domk().all(...arguments);
  },
  nested(modelSelector, keySelector) {
    return function nestedBinding(model, context) {
      return {
        init: context.container,
        children: {
          key: keySelector,
          model: modelSelector(model, context),
          update: context.component
        }
      };
    };
  },
  children() {
    let modelSelector;
    let key;
    let update;
    if (!arguments.length) {
      modelSelector = defaultModelSelector;
      update = updateText;
    } else if (arguments.length < 3) {
      modelSelector = arguments[0];
      update = arguments[1];
    } else {
      [modelSelector, key, update] = arguments;
    }

    if (typeof modelSelector === "number") {
      return {
        children: {
          key,
          model: modelSelector,
          update
        }
      };
    }

    return function childrenBinding(model, context) {
      return {
        children: {
          key,
          model: modelSelector(model, context),
          update
        }
      };
    };
  },
  async(promise, options = {}) {
    const wrapper = new Promise((resolve) => {
      promise.then(
        resolve,
        (error) =>
          options.error &&
          resolve(
            typeof options.error === "function"
              ? options.error(error)
              : options.error
          )
      );
    });
    return Object.assign(
      function (next) {
        if ("loading" in options) {
          next(
            typeof options.loading === "function"
              ? options.loading()
              : options.loading
          );
        }
        wrapper.then(next);
      },
      {
        map(propOrSelector, loading) {
          const hasInit = arguments.length > 1;
          if (typeof propOrSelector !== "function") {
            const prop = propOrSelector;
            propOrSelector = (model) => model[prop];
          }
          return function (next) {
            if (hasInit) {
              next(typeof loading === "function" ? loading() : loading);
            }
            return wrapper.then(propOrSelector).then(next);
          };
        }
      }
    );
  },
  html(strings, ...args) {
    const uid = "i" + Math.floor(Date.now() * Math.random()).toString(36);
    const tokens = {};
    return Object.assign(
      function (container, context) {
        container.innerHTML = String.raw(
          strings,
          ...args.map((arg, index) => {
            const id = uid + index;
            let model;
            let tag = "div";
            // [component, model]
            if (Array.isArray(arg)) {
              model = arg[1];
              arg = arg[0];
            }
            if (!isComponent(arg)) {
              return arg;
            }

            const component = arg;
            if (component._options.tag) {
              tag = component._options.tag;
            }
            tokens[id] = function (node, context) {
              component._update(model, Object.assign({}, context, { node }));
            };
            return `<${tag} id="${id}"></${tag}>`;
          })
        );

        for (const id in tokens) {
          const node = query(container, "#" + id, false)[0];
          if (!node) continue;
          tokens[id](node, context);
        }
      },
      {
        _type: templateType
      }
    );
  }
});

init();
