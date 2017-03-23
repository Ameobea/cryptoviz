//! Functions for rendering the visualization's components on the canvas
// @flow

import { getPixelPosition, getPricesFromBook } from '../calc';
const gpp = getPixelPosition;

type Orderbook = { [key: number]: {price: number, isBid: boolean} };

/**
 * Given the component's state and a reference to the canvas, renders the initial view of the orderbook given
 * the visualization.
 */
function renderInitial(state: {curBook: Orderbook, canvasHeight: number, canvasWidth: number}, scope: any) {
  scope.activate();
  // fill in the background
  let bg = new scope.Path.Rectangle(new scope.Point(0, 0), new scope.Point(state.canvasWidth, state.canvasHeight));
  bg.fillColor = state.backgroundColor;

  // render the drawings to the view
  scope.view.draw();
}

/**
 * Given a change to the orderbook, updates the visualization
 */
function renderUpdate(change, curTimestamp: number) {
  if(change.modification) {
    // TODO
  } else if(change.removal) {
    // TODO
  } else if(change.newTrade) {
    // TODO
  }
}

export { renderInitial, renderUpdate };
