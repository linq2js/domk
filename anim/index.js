import gsap from "gsap";
const crossFadeLists = {};

export function fade({ duration = 0.5 } = {}) {
  return {
    in(node) {
      gsap.from(node, {
        opacity: 0,
        height: 0,
        duration,
        onComplete() {
          node.style.removeProperty("opacity");
          node.style.removeProperty("height");
        },
      });
    },
    out(node) {
      const clone = node.cloneNode(true);
      node.parentNode.insertBefore(clone, node);
      gsap.to(clone, {
        opacity: 0,
        height: 0,
        duration,
        onComplete() {
          clone.parentNode.removeChild(clone);
        },
      });
    },
  };
}

export function crossFade({ duration = 1, name = "default" } = {}) {
  let list = crossFadeLists[name];
  if (!list) {
    list = new Map();
    crossFadeLists[name] = list;
  }

  function add(key, type, node) {
    let item = list.get(key);
    if (!item) {
      item = { key };
      list.set(key, item);
    }
    item[type] = node;
    clearTimeout(item.timer);
    if (item.in && item.out) {
      list.delete(key);
      gsap.from(item.in, {
        opacity: 0,
        duration: duration * 0.25,
        delay: duration * 0.75,
        onComplete() {
          item.in.style.removeProperty("opacity");
        },
      });
      const from = getCoords(item.out);
      const to = getCoords(item.in);
      const x = to.x - from.x;
      const y = to.y - from.y;
      gsap.to(item.out, {
        x,
        y,
        duration: duration * 0.75,
        onComplete() {
          item.out.style.setProperty("visibility", "hidden");
          gsap.to(item.out, {
            height: 0,
            duration: duration * 0.25,
            onComplete() {
              item.out.parentNode.removeChild(item.out);
            },
          });
        },
      });
    } else {
      // cleanup
      item.timer = setTimeout(() => {
        if (list.get(key) === item) {
          list.delete(key);
        }
        if (item.out) {
          item.out.node.parentNode.removeChild(item.out.node);
        }
      }, 0);
    }
  }

  return {
    in(node, key) {
      add(key, "in", node);
    },
    out(node, key) {
      const clone = node.cloneNode(true);
      node.parentNode.insertBefore(clone, node);
      add(key, "out", clone);
    },
  };
}

function getCoords(node) {
  const rect = node.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
  };
}
