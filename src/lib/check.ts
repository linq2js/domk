import domk from "./index";

domk({
  model: domk.model({
    count: 1,
    nodes: [{ title: "item 1" }, { title: "item 2" }],
  }),
}).one("span", (model) => ({
  text: model.count,
  children: {
    model: model.nodes,
    update: null,
  },
}));
