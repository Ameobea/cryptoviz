//! Functions for rendering the visualization's components on the canvas

import { getPixelPosition, getPricesFromBook } from '../calc';
const gpp = getPixelPosition;

type Orderbook = { [key: number]: {price: number, isBid: boolean} };

/**
 * Given the component's state and a reference to the canvas, renders the initial view of the orderbook given
 * the visualization.
 */
function renderInitial(state: {curBook: Orderbook, canvasHeight: number, canvasWidth: number}, scope: any) {
  // fill the background
  let rect = new scope.Path.Rectangle(0, 0, state.canvasWidth, state.canvasHeight);
  rect.fillColor = state.backgroundColor;

  // render the drawings to the view
  scope.view.draw();
}

export { renderInitial };
