// @types/plotly.js only declares the "plotly.js" module. The dist-min build is
// the same API in a prebuilt bundle, so point one at the other.
declare module "plotly.js-dist-min" {
  import type Plotly from "plotly.js";
  export * from "plotly.js";
  export default Plotly;
}
