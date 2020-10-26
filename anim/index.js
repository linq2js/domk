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
      const fromPos = getCoords(item.out);
      const toPos = getCoords(item.in);
      const x = toPos.x - fromPos.x;
      const y = toPos.y - fromPos.y;
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
    },
    flip([from, to]) {
      const fromPos = getCoords(from);
      const toPos = getCoords(to);

      const cloneFrom = from.cloneNode(true);
      from.parentNode.insertBefore(cloneFrom, from);
      from.classList.add("domk-hide");

      const cloneTo = to.cloneNode(true);
      to.parentNode.insertBefore(cloneTo, to);
      to.classList.add("domk-hide");

      gsap.to(cloneFrom, {
        x: toPos.x - fromPos.x,
        y: toPos.y - fromPos.y,
        duration: moveDuration,
        onComplete() {
          from.classList.remove("domk-hide");
          from.parentNode.removeChild(cloneFrom);
        }
      });
      gsap.to(cloneTo, {
        x: fromPos.x - toPos.x,
        y: fromPos.y - toPos.y,
        duration: moveDuration,
        onComplete() {
          to.classList.remove("domk-hide");
          to.parentNode.removeChild(cloneTo);
        }
      });
    }
  };
}

Object.assign(crossFade, {
  in: crossFade().in,
  out: crossFade().out,
  flip: crossFade().flip
});

function getCoords(node) {
  const rect = node.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top
  };
}
