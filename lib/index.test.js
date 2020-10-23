import domk from "./index";
import model from "../model";

function query(selector, container = document) {
  return container.querySelector(selector);
}

function queryAll(selector, container = document) {
  return Array.from(container.querySelectorAll(selector));
}

beforeEach(() => {
  document.body.innerHTML = "";
});

test("counter", () => {
  const rootModel = model({ count: 0 });

  document.body.innerHTML = `
    <h1></h1>
  `;

  const binder = domk({ model: rootModel }).one("h1", (model) => ({
    text: model.count,
    on: { click: () => rootModel.count++ },
  }));

  binder.update();

  expect(query("h1").textContent).toBe("0");
  query("h1").click();
  expect(query("h1").textContent).toBe("1");
  query("h1").click();
  expect(query("h1").textContent).toBe("2");
});

test("nested components", () => {
  const tree = {
    id: "root",
    title: "root",
    children: [
      { id: "c1", title: "child 1" },
      {
        id: "c2",
        title: "child 2",
        children: [
          { id: "c3", title: "child 3" },
          { id: "c4", title: "child 4" },
        ],
      },
    ],
  };

  document.body.innerHTML = `
    <div class="tree">
        <div class="node">
            <span></span>
            <div class="children"></div>
        </div>
    </div>
  `;
  const nodeBinder = domk
    .one(
      ">.children",
      domk.nested((model) => model.children)
    )
    .one("this", (model) => ({
      id: model.id,
    }))
    .one(">span", (model) => ({
      text: model.title,
    }));
  const rootBinder = domk.one(".tree > .node", nodeBinder);

  rootBinder.update(tree);
  const rootNode = query("#root");
  expect(rootNode).not.toBeUndefined();
  const c1Node = query("#c1", rootNode);
  expect(c1Node).not.toBeUndefined();
  const c2Node = query("#c2", rootNode);
  expect(c2Node).not.toBeUndefined();

  const c3Node = query("#c3", c2Node);
  expect(c3Node).not.toBeUndefined();

  const c4Node = query("#c4", c2Node);
  expect(c4Node).not.toBeUndefined();
});

test("all()", () => {
  document.body.innerHTML = "<h1></h1><h1></h1><h1></h1>";
  domk.all("h1", (model) => ({ text: model.data })).update({ data: "hello" });
  expect(
    queryAll("h1")
      .map((node) => node.innerHTML)
      .join("|")
  ).toBe("hello|hello|hello");
});

test("one()", () => {
  document.body.innerHTML = "<h1></h1><h1></h1><h1></h1>";
  domk.one("h1", (model) => ({ text: model.data })).update({ data: "hello" });
  expect(
    queryAll("h1")
      .map((node) => node.innerHTML)
      .join("|")
  ).toBe("hello||");
});

test("simple list render", () => {
  document.body.innerHTML = `
  <ul>
    <li></li>
  </ul>
  `;
  const model = {
    fruits: ["apple", "banana", "orange"],
  };
  domk
    .one("h1 > span", (model) => ({
      text: model.fruits.length,
    }))
    .one("ul", (model) => ({
      children: {
        model: model.fruits,
        update: (fruit) => ({ text: fruit }),
      },
    }))
    .update(model);

  expect(queryAll("li").map((li) => li.innerHTML)).toEqual(model.fruits);
});

test("keyed", () => {
  const checkList = [{ id: 1 }, { id: 2 }, { id: 3 }];
  document.body.innerHTML = `<div><input type="checkbox"/></div>`;
  const List = domk({ model: () => checkList }).one(
    "div",
    domk.children(
      (model) => model,
      (item) => item.id,
      (item) => ({ id: "item-" + item.id })
    )
  );
  List.update();
  expect(query("#item-1").checked).toBeFalsy();
  query("#item-1").click();
  expect(query("#item-1").checked).toBeTruthy();
  // swap 2 checkboxes
  const temp = checkList[0];
  checkList[0] = checkList[1];
  checkList[1] = temp;
  List.update();
  expect(query("#item-1").checked).toBeTruthy();

  checkList.shift();
  List.update();

  checkList.shift();
  List.update();
});

test("unkeyed", () => {
  const checkList = [
    { id: 1, done: true },
    { id: 2, done: false },
  ];
  document.body.innerHTML = `<div><input type="checkbox"/></div>`;
  const List = domk({ model: () => checkList }).one(
    "div",
    domk.children(
      (model) => model,
      (item) => ({ id: "item-" + item.id })
    )
  );
  List.update();
  expect(query("#item-1").checked).toBeFalsy();
  query("#item-1").click();
  expect(query("#item-1").checked).toBeTruthy();
  const temp = checkList[0];
  checkList[0] = checkList[1];
  checkList[1] = temp;
  List.update();
  expect(query("#item-1").checked).toBeFalsy();
});

test("model.dispatch", () => {
  document.body.innerHTML = `
  <button class="increase"></button>
  <button class="decrease"></button>
  <h1 class="value"></h1>
  `;
  domk({
    model: model((state = 1, action) => {
      if (action === "increase") return state + 1;
      if (action === "decrease") return state - 1;
      return state;
    }),
  })
    .one("h1", (model) => ({ text: model }))
    .one(".increase", (model, context) => ({
      on: { click: () => context.dispatch("increase") },
    }))
    .one(".decrease", (model, context) => ({
      on: { click: () => context.dispatch("decrease") },
    }))
    .update();

  expect(query("h1").innerHTML).toBe("1");
  query(".increase").click();
  expect(query("h1").innerHTML).toBe("2");
  query(".decrease").click();
  expect(query("h1").innerHTML).toBe("1");
});

test("withRef", () => {
  document.body.innerHTML = `
      <div id="app">
        <button id="b1"></button>
        <button id="b2"></button>
        <button id="b3"></button>
      </div>`;
  const Button = ({ text }) =>
    domk({
      handler(context, update) {
        return function (action, payload) {
          if (action === "text") {
            if (arguments.length > 1) {
              text = payload;
              update();
            } else {
              return text;
            }
          }
        };
      },
    }).one("this", () => ({ text }));

  domk({ container: "#app" })
    .one("#b1", Button({ text: "button-1" }).withRef("b1"))
    .one("#b2", Button({ text: "button-2" }).withRef("b2"))
    .one("#b3", (model, { invoke }) => ({
      on: {
        click() {
          invoke("b1", "text", "button-1-changed");
          invoke("b2", "text", "button-2-changed");
        },
      },
    }))
    .update();

  expect(query("#b1").textContent).toBe("button-1");
  expect(query("#b2").textContent).toBe("button-2");
  query("#b3").click();
  expect(query("#b1").textContent).toBe("button-1-changed");
  expect(query("#b2").textContent).toBe("button-2-changed");
});

test("withModel", () => {
  document.body.innerHTML = `<button id="b1"></button><button id="b2"></button>`;
  const Button = domk.one("this", (model) => ({ text: model }));
  domk({
    model: {
      b1: "button-1",
      b2: "button-2",
    },
  })
    .one(
      "#b1",
      Button.withModel((model) => model.b1)
    )
    .one(
      "#b2",
      Button.withModel((model) => model.b2)
    )
    .update();

  expect(query("#b1").innerHTML).toBe("button-1");
  expect(query("#b2").innerHTML).toBe("button-2");
});
