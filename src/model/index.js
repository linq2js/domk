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

export default function model() {
  return new Model(...arguments);
}
