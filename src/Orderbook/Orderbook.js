//! An interactive limit orderbook visualization showing the locations of limit orders, trade executions, and price action.

import React from 'react';
import paper from 'paper';

class Orderbook extends React.Component {
  constructor(props) {
    super(props);

    this.handleBookModification = this.handleBookModification.bind(this);
    this.handleBookRemoval = this.handleBookRemoval.bind(this);
    this.handleNewTrade = this.handleNewTrade.bind(this);

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

  handleBookModification(
    {timestamp, price, newAmount, isBid}: {timestamp: number, price: number, newAmount: number, isBid: boolean}
  ) {
    // TODO
  }

  handleBookRemoval({timestamp, price, isBid}: {timestamp: number, price: number, isBid: boolean}) {
    // TODO
  }

  handleNewTrade({timestamp, price, wasBidFilled}: {timestamp: number, price: number, wasBidFilled: boolean}) {
    // TODO
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
  initialBook: React.PropTypes.arrayOf(React.PropTypes.shape({
    price: React.PropTypes.number.isRequired,
    volume: React.PropTypes.number.isRequired
  })).isRequired,
  bookModificationCallbackExecutor: React.PropTypes.func.isRequired,
  bookRemovalCallbackExecutor: React.PropTypes.func.isRequired,
  newTradeCallbackExecutor: React.PropTypes.func.isRequired,
};

Orderbook.defaultProps = {
  canvasHeight: 600,
  canvasWidth: 900,
};

export default Orderbook;
