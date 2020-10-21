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

## Advanced Usages

- [Todo App](https://codesandbox.io/s/domux-todo-2ltcr?file=/src/index.js)

## References

### domk(options)

Create a new Domk component with specified options.

- options (optional): A plain object has following properties
  - model (optional): A function returns current model or a model object
  - container (optional): A dom node or query selector string. By default, domk uses document as container
- return value: [Domk component](#domk-component)

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
- **updateFn**: A function retrieves 2 arguments model and context and returns updating specs.

### Domk component

An object contains all update specs for specified element

#### Domk.one(selector, updateFn) & Domk.all(selector, updateFn)

Perform the same as domk.all and domk.one

#### Domk.update(model, container)

#### Domk.update(container)

### domk.model(props)

### domk.model(props, reducer)

### domk.model(reducer)

### domk.nested(modelFn)

### domk.children(modelFn)

### domk.children(modelFn, component)

### domk.children(modelFn, updateFn)

### domk.children(modelFn, keyFn, component)

### domk.children(modelFn, keyFn, updateFn)

### Update specs

## Dependencies

Nothing
