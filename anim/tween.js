const unusedNodes = [];
const unset = {};

export default function tween(
  from,
  to,
  { ease = "ease", duration = 300, delay = 0, onUpdate } = {}
) {
  if (typeof to !== "function") {
    const toValue = to;
    to = () => toValue;
  }
  const isObject = typeof from === "object";
  const nodes = {};
  let current;
  let value = unset;
  let cancelled = false;

  function initTransition(node) {
    node.style.setProperty("transition-property", "left");
    node.style.setProperty("transition-timing-function", ease);
    node.style.setProperty("transition-delay", delay + "ms");
    node.style.setProperty("transition-duration", duration + "ms");
  }

  function getNode(key) {
    let node = nodes[key];
    if (!node) {
      if (!unusedNodes.length) {
        node = document.createElement("span");
        document.body.appendChild(node);
      } else {
        node = unusedNodes.shift();
      }
      nodes[key] = node;
      node.setAttribute("style", "position: absolute; visibility: hidden;");
      initTransition(node);
    }
    return node;
  }

  function updateNode(node, value, reset) {
    const left = -value + "px";
    if (reset) {
      node.style.setProperty("transition-property", "");
      node.style.setProperty("left", left);
      initTransition(node);
    } else {
      node.style.setProperty("left", left);
    }
  }

  function updateNodes(next, reset) {
    if (current !== next) {
      current = next;
      if (isObject) {
        for (const key in current) {
          const node = getNode(key);
          updateNode(node, current[key], reset);
        }
      } else {
        const node = getNode("value");
        updateNode(node, current, reset);
      }
    }
  }
  const startTime = Date.now();
  updateNodes(from, true);

  function dispose() {
    unusedNodes.push(Object.values(nodes));
  }

  function computeValue() {
    if (isObject) {
      value = {};
      for (const key in nodes) {
        value[key] = -nodes[key].getBoundingClientRect().left;
      }
    } else {
      value = -nodes.value.getBoundingClientRect().left;
    }
  }

  function update() {
    if (cancelled) return;
    const next = to();
    const end = Date.now() - startTime >= duration;
    if (end) {
      value = next;
    } else {
      computeValue();
    }
    typeof onUpdate === "function" && onUpdate(value);
    if (end) {
      return dispose();
    }
    updateNodes(next);
    requestAnimationFrame(update);
  }

  setTimeout(update);

  return {
    get value() {
      value === unset && computeValue();
      return value;
    },
    cancel() {
      cancelled = true;
      dispose();
    },
  };
}
