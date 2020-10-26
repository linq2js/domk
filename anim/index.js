import gsap from "gsap";
const crossFadeLists = {};

function fadeOut(node, { duration }) {
  node.style.setProperty("visibility", "hidden");
  node.style.setProperty("overflow", "hidden");
  gsap.to(node, {
    height: 0,
    duration: duration * 0.5,
    onComplete() {
      node.parentNode.removeChild(node);
    }
  });
}

function fadeIn(node, { duration, delay = 0, disableScale } = {}) {
  node.style.setProperty("visibility", "visible");
  gsap.from(node, {
    ...(disableScale ? undefined : { height: 0 }),
    opacity: 0,
    duration: duration * 0.5,
    delay,
    onComplete() {
      node.style.removeProperty("visibility");
      node.style.removeProperty("opacity");
      !disableScale && node.style.removeProperty("height");
    }
  });
}

export function fade({ duration = 0.5 } = {}) {
  return {
    in(node) {
      fadeIn(node, { duration });
    },
    out(node) {
      const clone = node.cloneNode(true);
      node.parentNode.insertBefore(clone, node);
      fadeOut(node, { duration });
    }
  };
}

Object.assign(fade, {
  in: fade().in,
  out: fade().out
});

export function crossFade({ duration = 1, name = "default" } = {}) {
  let list = crossFadeLists[name];
  if (!list) {
    list = new Map();
    crossFadeLists[name] = list;
  }

  const fadeDuration = duration * 0.5;
  const moveDuration = duration * 0.5;

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
      const from = getCoords(item.out);
      const to = getCoords(item.in);
      const x = to.x - from.x;
      const y = to.y - from.y;
      fadeIn(item.in, {
        duration: fadeDuration,
        delay: moveDuration,
        disableScale: true
      });
      item.out.classList.add("domk-crossfade-active");
      gsap.to(item.out, {
        x,
        y,
        duration: moveDuration,
        onComplete() {
          item.out.classList.remove("domk-crossfade-active");
          fadeOut(item.out, { duration: fadeDuration });
        }
      });
    } else {
      item.in && item.in.style.setProperty("visibility", "hidden");
      // cleanup
      item.timer = setTimeout(() => {
        if (list.get(key) === item) {
          list.delete(key);
        }
        item.in && fadeIn(item.in, { duration: fadeDuration });
        item.out && fadeOut(item.out, { duration: fadeDuration });
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
    }
  };
}

Object.assign(crossFade, {
  in: crossFade().in,
  out: crossFade().out
});

function getCoords(node) {
  const rect = node.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top
  };
}
