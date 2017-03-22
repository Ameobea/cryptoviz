//! An interactive limit orderbook visualization showing the locations of limit orders, trade executions, and price action.

import React from 'react';

class Orderbook extends React.Component {
  constructor(props) {
    super(props);
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
  canvasWidth: React.PropTypes.number
};

Orderbook.defaultProps = {
  canvasHeight: 600,
  canvasWidth: 900
};

export default Orderbook;
