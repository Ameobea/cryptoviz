//! An interactive limit orderbook visualization showing the locations of limit orders, trade executions, and price action.

import React from 'react';
import paper from 'paper';

import { getInitialPriceRange } from '../calc';
import { renderInitial } from './render';

class Orderbook extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      timeScale: 1000 * 60 * 5, // how much time to display on the viz in ms
      minTimestamp: null,
      maxTimestamp: null,
      minPrice: null,
      maxPrice: null,
      priceGranularity: 28, // the number of destinct price levels to mark on the visualization
      timeGranuality: 1000, // the min number of ms that can exist as a distinct unit
      // duplicated settings from props
      canvasHeight: props.canvasHeight,
      canvasWidht: props.canvasWidth,
      // visual settings
      backgroundColor: '#121212',
    };
  }

  componentWillMount() {
    // calculate initial zoom levels given the starting orderbook
    let {min, max} = getInitialPriceRange(this.props.curBook);
    this.setState({
      minTimestamp: this.props.initialTimestamp,
      maxTimestamp: this.props.initialTimestamp + this.state.timeScale,
      minPrice: min,
      maxPrice: max
    });
  }

  componentDidMount() {
    // initialize the PaperJS environment on the internal canvas
    this.paperscope = new paper.PaperScope();
    paper.setup(this.paperscope);

    // draw the initial version of the orderbook along with the axis and other markers
    renderInitial(this.state);
  }

  render() {
    return (
      <canvas
        data-paper-keepalive
        height={this.props.canvasHeight}
        ref={function(canvas){this.canvas = canvas;}.bind(this)}
        width={this.props.canvasWidth}
      />
    );
  }
}

Orderbook.propTypes = {
  canvasHeight: React.PropTypes.number,
  canvasWidth: React.PropTypes.number,
  curBook: React.PropTypes.object.isRequired,
  initialTimestamp: React.PropTypes.number.isRequired,
};

Orderbook.defaultProps = {
  canvasHeight: 600,
  canvasWidth: 900
};

export default Orderbook;
