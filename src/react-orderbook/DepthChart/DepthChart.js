//! An visualzation for limit orderbook data showing the current depth of market for bids and asks.  Contains controls for
//! zooming in and out and some other helper features.
// @flow

import React from 'react';
import PropTypes from 'prop-types';
// import paper from 'paper';

import { ChangeShape } from '../util';

/**
 * A visualization that draws a market depth visualization showing how much liquidity sits at various price levels.  For props,
 * it takes a canvas height and width as well as an object representing the current state of the orderbook as represented by
 * an object containing price:volume k:v pairs.
 */
class DepthChart extends React.Component {
  componentDidMount() {
    // initialize the PaperJS environment on the internal canvas
    // paper.setup(this.canvas);
  }

  componentWillReceiveProps(nextProps) {
    // TODO: Determine what kind of change occured and use the information supplied in the `change` prop to update the current
    //       visualization without redrawing it completely.  It should (optionally?) animate the points rather than just having
    //       them jump instantly as well.
    if(nextProps.change.modification) {
      // TODO
    } else if(nextProps.change.removal) {
      // TODO
    } else if(nextProps.change.newTrade) {
      // TODO
    }
  }

  shouldComponentUpdate(nextProps) {
    if(this.props.canvasHeight !== nextProps.canvasHeight || this.props.canvasWidth !== nextProps.canvasWidth) {
      return true;
    }

    return false;
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
  canvasHeight: PropTypes.number,
  canvasWidth: PropTypes.number,
  change: PropTypes.shape(ChangeShape),
  initialBook: PropTypes.arrayOf(PropTypes.shape({
    price: PropTypes.string.isRequired,
    volume: PropTypes.string.isRequired
  })).isRequired,
};

DepthChart.defaultProps = {
  canvasHeight: 600,
  canvasWidth: 900,
};

export default DepthChart;
