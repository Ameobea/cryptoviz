//! An visualzation for limit orderbook data showing the current depth of market for bids and asks.  Contains controls for
//! zooming in and out and some other helper features.
// @flow

import React from 'react';
import paper from 'paper';

class DepthChart extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      book: {},
    };
  }

  componentDidMount() {
    // register the callback callers to start receiving book updates
    this.props.bookModificationCallbackExecutor(this.handleBookModification);
    this.props.bookRemovalCallbackExecutor(this.handleBookRemoval);
    this.props.newTradeCallbackExecutor(this.handleNewTrade);

    // initialize the PaperJS environment on the internal canvas
    paper.setup(this.canvas);
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

DepthChart.propTypes = {
  canvasHeight: React.PropTypes.number,
  canvasWidth: React.PropTypes.number,
  initialBook: React.PropTypes.arrayOf(React.PropTypes.shape({
    price: React.PropTypes.number.isRequired,
    volume: React.PropTypes.number.isRequired
  })).isRequired,
  bookModificationCallbackExecutor: React.PropTypes.func.isRequired,
  bookRemovalCallbackExecutor: React.PropTypes.func.isRequired,
  newTradeCallbackExecutor: React.PropTypes.func.isRequired,
};

DepthChart.defaultProps = {
  canvasHeight: 600,
  canvasWidth: 900,
};

export default DepthChart;
