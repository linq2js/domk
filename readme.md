# DOMK

Powerful DOM toolkit

## Installation

```
npm install domk --save
```

## Why domk ?

- Domk is made for small and medium projects.
- With Domk you can manipulate DOM easier and more flexible.
- Domk is an alternative for jQuery or static template engines.
- Domk is very compact, only 3kb after GZiped

## Getting started

Let's create simple clock app

```js
import domk from "domk";

document.body.innerHTML = `<h1></h1>`;

// create date formatter
const formatter = new Intl.DateTimeFormat("en", {
  hour12: true,
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

const Clock = domk.one(
  // select h1 element, the first argument is query selector text
  // if there are many h1 elements in the document,
  // the first one will be selected because we call domk.one()
  // using domk.all() to update multiple matched elements at once
  "h1",
  // define updates for selected elements
  function () {
    return {
      // update element text
      text: formatter.format(new Date()),
    };
  }
);

// call Clock.update every 1 second
setInterval(Clock.update, 1000);
```

We can make the above example more compact

```js
setInterval(
  domk.one("h1", () => ({ text: new Date().toString() })).update,
  1000
);
```

## Click counter app

```js
import domk from "domk";

let count = 0;
let Counter;

document.body.innerHTML = `<button></button>`;

function handleClick() {
  count++;
  Counter.update(count);
}

Counter = domk.one(
  "button",
  // model is value of count
  function (model) {
    return {
      text: model
        ? `Clicked ${model} ${model === 1 ? "time" : "times"}`
        : "Click here",
      // define event listeners
      on: {
        // click event
        click: handleClick,
      },
    };
  }
);

Counter.update(count);
```

## List rendering

In this example, we create a list of youtube links,
Domk does not generate HTML tags automatically (like React, Angular do),
We must provide some existing tags, those will be used for templating

```js
let cats = [
  { id: "J---aiyznGQ", name: "Keyboard Cat" },
  { id: "z_AbfPXTKms", name: "Maru" },
  { id: "OUtn3pvWmpg", name: "Henri The Existential Cat" },
];

// UL is list container
// The first child of UL will be used for templating
document.body.innerHTML = `
<h1>The Famous Cats of YouTube</h1>
<!-- UL is list container -->
<ul>
  <li>
    <a target="_blank" ></a>
  </li>
</ul>
`;

// define Cat component, no update() call needed
// when the Cat component is created, it is just like a template
// it will be called later on by another component
const Cat = domk.one("a", (cat) => ({
  href: `https://www.youtube.com/watch?v=${cat.id}`,
  text: `${cat.index}: ${cat.name}`,
}));

domk
  .one("ul", (cats) => ({
    children: {
      // define model for children
      model: cats.map((cat, index) => ({ ...cat, index: index + 1 })),
      // each child element will be updated by Cat component
      update: Cat,
    },
  }))
  .update(cats);
```

## Benchmark

- [Domk](https://codesandbox.io/s/fancy-pine-54tv8?file=/src/index.js)
- [React + Redux](https://codesandbox.io/s/hardcore-glade-ts4q7)

## Advanced Usages

- [Todo App](https://codesandbox.io/s/domk-todo-2ltcr?file=/src/index.js)

## References

### domk(options)

Create a new Domk component with specified options.

- **options (optional)**: A plain object has following properties
  - **model (optional)**: A function returns current model or a model object
  - **container (optional)**: A dom node or query selector string. By default, domk uses document as container
- **return**: [Domk component](#domk-component)

```js
const mutableTodos = [];
let immutableTodos = [];

domk({ model: mutableTodos });
domk({ model: () => immutableTodos });
domk({ container: "#app" });
domk({ container: document.body });
```

### domk.one(selector, updateFn) & domk.all(selector, updateFn)

Query single (**domk.one**) or multiple elements (**domk.all**) and apply updating specs to matched elements.

- **selector**: A valid query selector string that can be used to querySelector() and querySelectorAll()
- **updateFn**: A function retrieves 2 arguments model and context and returns [updating specs](#updating-specs).

### Domk component

An object contains all update specs for specified element

#### Domk.one(selector, updateFn) & Domk.all(selector, updateFn)

Perform the same as [domk.all](#domkoneselector-updatefn--domkallselector-updatefn) and domk.one

#### Domk.update()

- **Domk.update(model, container)**

- **Domk.update(container)**

### model()

- **model(props)**

- **model(props, reducer)**

- **model(reducer)**

### domk.nested()

- domk.nested(modelFn)

### domk.children()

- domk.children(modelFn)

- domk.children(modelFn, component)

- domk.children(modelFn, updateFn)

- domk.children(modelFn, keyFn, component)

- domk.children(modelFn, keyFn, updateFn)

### Updating specs

A plain object has following properties

#### id

Update element id

```js
domk.one("div", () => ({ id: "new-id" })).update();
```

```html
<div id="new-id"></div>
```

#### class

Update element class. A value can be string or class map object.

```js
let isVisible = false;
domk.one("div.box1", () => ({ class: { hide: !isVisible } })).update();
domk
  .one("div.box2", () => ({ class: isVisible ? "visible" : "invisible" }))
  .update();
```

```html
<div class="box1 hide"></div>
<div class="box2 invisible"></div>
```

> domk does not remove original classes (box1, box2), it just append updated classes (hide, visible, invisible)

#### style

Update element style. A value can be string or style map object.

```js
domk.one("div.box1", () => ({ style: "font-weight: bold" })).update();
domk.one("div.box2", () => ({ style: { opacity: 0.5 } })).update();
```

```html
<div class="box1" style="font-weight: bold"></div>
<div class="box2" style="opacity: 0.5"></div>
```

> domk does not add browser prefixes automatically

#### selected

Update selected property of option element

#### checked

Update checked property of input element

#### disabled

Update disabled property of input element

#### value

Update value property of input element

#### href

Update href attribute of anchor element

#### text

Update textContent property of html element

```js
domk.one("div", { text: "<strong>This is formatted text</strong>" }).update();
```

```html
<div>&lt;strong&gt;This is formatted text&lt;/strong&gt;</div>
```

#### html

Update innerHTML property of html element

```js
domk.one("div", { html: "<strong>This is formatted text</strong>" }).update();
```

```html
<div><strong>This is formatted text</strong></div>
```

#### init

An init value for a current node. Init value can be function, Node object or HTML string.

- **A function** retrieves current node object as first argument.
- **HTML string**: Node contents will be replaced with given value.
- **Node object**: Clone of given node will be appended to current node.

```js
domk
  .one("div.box1", { init: "<strong>This is formatted text</strong>" })
  .update();

domk.one("div.box2", { init: document.querySelector("#content") }).update();

const Box3 = domk.one("div.box3", {
  init(node) {
    console.log(node.innerHTML); // Box 3 contents
  },
});

// init action invoked once
Box3.update();
Box3.update();
Box3.update();
```

```html
<div id="content"><button>Click me</button></div>

<div class="box1"><strong>This is formatted text</strong></div>

<div class="box2">
  <div id="content"><button>Click me</button></div>
</div>

<div class="box3">Box 3 contents</div>
```

#### on

Update event listeners

```js
domk
  .one("div", {
    on: {
      click() {
        alert("Hi there");
      },
      mouseover(e) {
        console.log("You are hovering", e.target);
      },
      mouseout(e) {
        console.log("You leave", e.target);
      },
    },
  })
  .update();
```

#### prop

Update multiple properties at once

```js
domk.one("button", { prop: { disabled: true, value: "Click me" } }).update();
```

#### attr

Update multiple attributes at once

```js
domk.one("a", {
  attr: {
    href: "http://google.com",
    title: "Click me",
  },
});
```

#### children

Update the child node of the current node according to the specified model.

```js
domk
  .one(".list1", {
    children: {
      model: [1, 2, 3],
      update: (number) => ({ text: number }),
    },
  })
  .update();

domk
  .one(".list2", (letters) => ({
    children: {
      model: letters,
      update: (letter) => ({ text: letter }),
    },
  }))
  .update(["A", "B", "C"]);
```

**Before updating**

```html
<ul class="list1">
  <!-- LI element is used to templating -->
  <li></li>
</ul>

<ul class="list2">
  <!-- LI element is used to templating -->
  <li></li>
</ul>
```

**After updating**

```html
<ul class="list1">
  <li>1</li>
  <li>2</li>
  <li>3</li>
</ul>

<ul class="list2">
  <li>A</li>
  <li>B</li>
  <li>C</li>
</ul>
```

## Dependencies

Nothing
