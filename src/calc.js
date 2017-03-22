//! Utility functions used for calculating values used for rendering the visualization
// @flow

/**
 * Given informatoin about the size and zoom of the visualization, calculates the X and Y positions of a certain
 * price/timestamp point on the canvas.  Returns a result like `{x: 882.12312, y: 299.399201}`.
 */
function getPixelPosition(
  minPrice: number, maxPrice: number, minTime: number, maxTime: number,
  canvasHeight: number, canvasWidth: number, price: number, timestamp: number
): {x: number, y: number} {
  let x = ((timestamp - minTime) / (maxTime - minTime)) * canvasWidth;
  let y = ((price - minPrice) / (maxTime - minTime)) * canvasHeight;
  return {x: x, y: y};
}

export { getPixelPosition };
