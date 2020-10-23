const defaultContainer = document;
const templateClassName = "domk-template";
const hideClassName = "domk-hide";
const defaultKeyAccessor = (model, index) => index;
const updateText = (model) => ({ text: model });
const componentType = () => {};
const templateType = () => {};
const predefinedProps = {
  selected: true,
  disabled: true,
  checked: true,
  value: true,
};
const defaultModelSelector = (model) => model;
let lastQuery;
let dispatchScopes = 0;
let pendingUpdates = new Set();

const predefinedAttrs = {
  id: true,
  href: true,
  title: true,
  name: true,
};

export default function domk({
  container = defaultContainer,
  model,
  handler,
  init,
  ...contextProps
} = {}) {
  return createComponent({ container, model, handler, init, contextProps });
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
    withModel,
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
                rootModel,
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
          component: instance,
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
      updateContainer: (inputModel = model) => _update(inputModel, context),
    });

    for (let i = 0; i < bindings.length; i++) {
      bindings[i](model, newContext);
    }
    if (options.onUpdate) {
      options.onUpdate({
        type: "update",
        target: instance,
        container: newContext.container,
        model,
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
      if (props.component._options.onDispatch) {
        props.component._options.onDispatch({
          type: "dispatch",
          target: props.component,
          action: arguments[0],
          payload: arguments[1],
          container: props.rootContainer,
          model: props.rootModel,
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
    return getData(context.container, context.component, () => {
      return {
        __handlers: {},
      };
    });
  }
  return Object.assign({}, context, props, {
    node,
    invoke(id, ...args) {
      const handler = state().__handlers[id];
      return handler && handler(...args);
    },
    state,
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
      init: binding,
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

function getData(node, key, init) {
  if (!node.__data) {
    node.__data = new WeakMap();
  }
  let data = node.__data.get(key);
  if (!data) {
    data = typeof init === "function" ? init() : init || {};
    node.__data.set(key, data);
  }
  return data;
}

function getNodeInitialData(node) {
  if (!node.__initialData) {
    node.__initialData = {
      style: (node.getAttribute("style") || "") + ";",
      class: (node.getAttribute("class") || "") + " ",
    };
  }
  return node.__initialData;
}

function updateNode(node, bindingKey, context, result) {
  const initialData = getNodeInitialData(node);
  const bindingData = getData(node, bindingKey, () => ({
    initialized: false,
    childTemplate: false,
    nodeList: [],
    nodeMap: {},
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
      updateEvent(node, node.__model, name, value)
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
          node.textContent = result.text;
          break;
        case "html":
          node.innerHTML = result.html;
          break;
        case "visible":
          node.classList.toggle(hideClassName, !value);
          break;
        default:
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
      updateChildren(node, bindingData, context, result.children);
    }
  }
}

function updateChildren(
  node,
  bindingData,
  context,
  { key: keyAccessor = defaultKeyAccessor, model: childModels, update }
) {
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
  const nodeMap = {};
  const nodeList = [];
  const listChanged = length !== bindingData.nodeList.length;

  for (let i = 0; i < length; i++) {
    const childModel = isArray ? childModels[i] : i;
    // convert key to string
    const key = "" + keyAccessor(childModel, i);
    let childNode = bindingData.nodeMap[key];
    if (!childNode) {
      childNode = bindingData.childTemplate.cloneNode(true);
      node.insertBefore(childNode, bindingData.nodeList[i]);
    } else if (!listChanged && childNode !== bindingData.nodeList[i]) {
      // console.log(bindingData.nodeList[i + 1]);
      node.insertBefore(childNode, bindingData.nodeList[i + 1]);
    }

    nodeMap[key] = childNode;
    nodeList[i] = childNode;
    delete bindingData.nodeMap[key];

    const childContext = Object.assign({}, context, {
      parent: context.node,
      node: childNode,
    });

    const updateResult = update(childModel, childContext);

    if (typeof updateResult === "object" && !isComponent(updateResult)) {
      updateNode(childNode, childNode, childContext, updateResult);
    }
  }
  const removedNodes = Object.values(bindingData.nodeMap);
  for (let i = 0; i < removedNodes.length; i++) {
    node.removeChild(removedNodes[i]);
  }
  bindingData.nodeMap = nodeMap;
  bindingData.nodeList = nodeList;
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

function updateStyle(node, prev, value, initial) {
  if (prev.style === value) return;
  prev.style = value;
  if (typeof value === "object") {
    for (let key in value) {
      // noinspection JSUnfilteredForInLoop
      node.style.setProperty(key, value[key]);
    }
  } else {
    node.style = initial + value;
  }
  lastQuery = undefined;
}

function updateClass(node, prev, value, initial) {
  if (isEqual(prev.style, value)) return;
  prev.style = value;
  if (typeof value === "object") {
    Object.entries(value).forEach(([token, force]) => {
      node.classList.toggle(token, !!force);
    });
  } else {
    node.className = initial + value;
  }
  lastQuery = undefined;
}

function updateProperty(node, prev, name, value) {
  const key = "p:" + name;
  if (prev[key] === value) return;
  prev[key] = value;
  node[name] = value;
  lastQuery = undefined;
}

function updateEvent(node, prev, name, value) {
  const key = "e:" + name;
  if (prev[key] === value) return;
  // custom event
  if (key.charAt(0) === "$") {
    if (prev[key]) {
      node.removeEventListener(name, prev[key]);
    }
    prev[key] = value;
    node.addEventListener(name, value);
  } else {
    node["on" + name] = value;
  }
}

function updateAttribute(node, prev, name, value) {
  const key = "a:" + name;
  if (prev[key] === value) return;
  prev[key] = value;
  node.setAttribute(name, value);
  lastQuery = undefined;
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
          update: context.component,
        },
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
          update,
        },
      };
    }

    return function childrenBinding(model, context) {
      return {
        children: {
          key,
          model: modelSelector(model, context),
          update,
        },
      };
    };
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
        _type: templateType,
      }
    );
  },
});

init();
