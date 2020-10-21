const defaultContainer = document;
const templateClassName = "domk-template";
const defaultKeyAccessor = (model, index) => index;
const updateText = (model) => ({ text: model });
const predefinedProps = {
  selected: true,
  disabled: true,
  checked: true,
  value: true,
};
const defaultModelSelector = (model) => model;
let dispatchScopes = 0;
let pendingUpdates = new Set();

const predefinedAttrs = {
  id: true,
  href: true,
};

export default function domk({
  container = defaultContainer,
  model,
  ...contextProps
} = {}) {
  if (typeof container === "string") {
    container = query(document, container, false)[0] || defaultContainer;
  }
  return new Component({ container, model, contextProps });
}

class Component {
  constructor(options) {
    this._bindings = [];
    this._options = options;
    this._unsubscribe = undefined;

    // call by another component or internal
    this._update = (model, context) => {
      context = {
        ...options.contextProps,
        ...context,
        container: context.node || context.container,
        component: this,
        updateContainer: (inputModel = model) =>
          this._update(inputModel, context),
      };
      const bindings = this._bindings;
      for (let i = 0; i < bindings.length; i++) {
        bindings[i](model, context);
      }
    };

    this.update = (...args) => {
      let model, container;
      if (!args.length) {
        model = this._options.model;
        container = this._options.container;
      } else if (args.length > 1) {
        [model, container] = args;
      } else if (args[0] && typeof args[0].cloneNode === "function") {
        model = this._options.model;
        container = args[0];
      } else {
        model = args[0];
        container = this._options.container;
      }

      if (!container) {
        return;
      }

      if (typeof model === "function") {
        model = model();
      }

      const update = () => this.update(...args);
      let dynamicModel;

      if (model) {
        if (typeof model.subscribe === "function") {
          if (typeof this._unsubscribe === "function") {
            this._unsubscribe();
          }
          dynamicModel = model;
          this._unsubscribe = dynamicModel.subscribe(() => {
            const rootModel = dynamicModel.getState();
            this._update(
              rootModel,
              addDispatcher(
                update,
                {
                  update,
                  rootContainer: container,
                  rootComponent: this,
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
      this._update(
        model,
        addDispatcher(
          update,
          {
            update,
            rootContainer: container,
            rootComponent: this,
            container,
            rootModel: model,
          },
          dynamicModel && dynamicModel.dispatch
        )
      );

      return this;
    };
  }

  one(selector, binding) {
    this._bindings.push(createBinding(false, selector, binding));
    return this;
  }

  all(selector, binding) {
    this._bindings.push(createBinding(true, selector, binding));
    return this;
  }
}

function addDispatcher(updater, context, customDispatch) {
  context.dispatch = function dispatch() {
    try {
      dispatchScopes++;
      if (typeof customDispatch === "function") {
        return customDispatch(...arguments);
      }
      const [action, payload] = arguments;
      const result = action(payload, context);
      if (isPromiseLike(result)) {
        return result.finally(updater);
      }
      pendingUpdates.add(updater);
      return result;
    } finally {
      dispatchScopes--;
      if (!dispatchScopes) {
        pendingUpdates.forEach((update) => update());
      }
    }
  };
  return context;
}

class Model {
  constructor(state = {}, reducer) {
    if (typeof state === "function") {
      reducer = state;
      state = undefined;
    }

    const listeners = [];
    let batchUpdate = false;
    this.getState = () => state;
    this.subscribe = (listener) => listeners.push(listener);

    function notify() {
      for (let i = 0; i < listeners.length; i++) {
        listeners[i](state);
      }
    }

    if (typeof state === "object") {
      Object.keys(state).forEach((key) => {
        Object.defineProperty(this, key, {
          get() {
            return state[key];
          },
          set(value) {
            if (batchUpdate) return;

            if (state[key] === value) return;
            state = {
              ...state,
              [key]: value,
            };
            notify();
          },
        });
      });
    }

    if (typeof reducer === "function" && typeof state === "undefined") {
      state = reducer(state, { type: "@@init" });
    }

    this.dispatch = (...args) => {
      if (!reducer) return;
      const nextState = reducer(state, ...args);
      if (nextState !== state) {
        state = nextState;
        try {
          batchUpdate = true;
          Object.assign(this, state);
        } finally {
          batchUpdate = false;
        }
        notify();
      }
    };
  }
}

function query(container, selector, all) {
  if (selector === "this") {
    return [container];
  }
  // auto prepend :scope to selector
  if (/^\s*>/.test(selector)) {
    selector = ":scope " + selector;
  }

  if (all) {
    return Array.from(container.querySelectorAll(selector));
  }

  const element = container.querySelector(selector);
  if (element) return [element];
  return [];
}

function createBinding(all, selector, binding) {
  if (binding instanceof Component) {
    return function (model, context) {
      const nodes = query(context.container, selector, all);
      for (let i = 0; i < nodes.length; i++) {
        binding._update(model, { ...context, node: nodes[i] });
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
        const result =
          binding(inputModel, { ...context, node, updateNode: update }) || {};
        updateNode(node, bindingFn, context, result);
      }

      update(model);
    }
  };
}

function getBindingData(node, key, init) {
  if (!node.__data) {
    node.__data = new WeakMap();
  }
  let data = node.__data.get(key);
  if (!data) {
    data = init();
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
  const bindingData = getBindingData(node, bindingKey, () => ({
    childTemplate: false,
    nodeMap: {},
  }));

  if (!node.__model) {
    node.__model = {};
  }

  const keys = Object.keys(result);

  // init should run first
  if (!bindingData.initialized && "init" in result) {
    bindingData.initialized = true;
    let init = result.init;

    if (typeof init === "function") {
      init = init(node);
    }

    if (typeof init !== "undefined" && init !== null) {
      if (init && typeof init.cloneNode === "function") {
        node.appendChild(init.cloneNode(true));
      } else {
        node.innerHTML = "" + init;
      }
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

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
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
      let {
        key: keyAccessor = defaultKeyAccessor,
        model: childModels,
        update,
      } = result.children;
      if (update instanceof Component) {
        update = update._update;
      }

      if (Array.isArray(childModels)) {
        const currentNodeMap = {};
        for (let i = 0; i < childModels.length; i++) {
          const childModel = childModels[i];
          const key = keyAccessor(childModel, i);
          let childNode = bindingData.nodeMap[key];
          if (!childNode) {
            childNode = bindingData.childTemplate.cloneNode(true);
          }
          currentNodeMap[key] = childNode;

          const currentNode = node.children[i];
          if (childNode !== currentNode) {
            node.insertBefore(childNode, currentNode);
          }

          const childContext = {
            ...context,
            parent: context.node,
            node: childNode,
          };

          const updateResult = update(childModel, childContext);

          if (
            typeof updateResult === "object" &&
            !(updateResult instanceof Component)
          ) {
            updateNode(childNode, childNode, childContext, updateResult);
          }
        }
        Object.keys(bindingData.nodeMap).forEach((key) => {
          if (currentNodeMap[key]) return;
          const removedNode = bindingData.nodeMap[key];
          if (removedNode.parentNode === node) {
            node.removeChild(removedNode);
          }
        });
        // remove unused nodes
        bindingData.nodeMap = currentNodeMap;
      }
    }
  }
}

function init() {
  if (!document.querySelector("#domk-styles")) {
    const styleElement = document.createElement("style");
    styleElement.id = "domk-styles";
    styleElement.type = "text/css";
    const styles = `.${templateClassName} {display: none !important;}`;
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

function serializeStyle(style) {
  return Object.entries(style)
    .map(([key, value]) => `${key}: ${value}`)
    .join(";");
}

function updateStyle(node, prev, value, initial) {
  if (isEqual(prev.style, value)) return;
  prev.style = value;
  if (typeof value === "object") {
    node.style = initial + serializeStyle(value);
  } else {
    node.style = initial + value;
  }
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
}

function updateProperty(node, prev, name, value) {
  const key = "p:" + name;
  if (prev[key] === value) return;
  prev[key] = value;
  node[name] = value;
}

function updateEvent(node, prev, name, value) {
  const key = "e:" + name;
  if (prev[key] === value) return;
  prev[key] = value;
  node["on" + name] = value;
}

function updateAttribute(node, prev, name, value) {
  const key = "a:" + name;
  if (prev[key] === value) return;
  prev[key] = value;
  node.setAttribute(name, value);
}

Object.assign(domk, {
  one() {
    return domk().one(...arguments);
  },
  all() {
    return domk().all(...arguments);
  },
  model(state) {
    return new Model(state);
  },
  nested(modelSelector) {
    return function nestedBinding(model, context) {
      return {
        init: context.container,
        children: {
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
});

init();
