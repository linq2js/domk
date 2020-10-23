import domk from "./index";
import model from "../model";

domk({
  model: model({
    count: 1,
    nodes: [{ title: "item 1" }, { title: "item 2" }],
  }),
})
  .one("span", (model) => ({
    text: model.count,
    children: {
      model: model.nodes,
      update: null,
    },
  }))
  .one("span", [(model) => model.count, domk()]);
