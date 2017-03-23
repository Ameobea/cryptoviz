//! Misc. functions and constants used in multiple parts of the application

import React from 'react';

const ChangeShape = {
  modificiation: React.PropTypes.shape({
    price: React.PropTypes.number.isRequired,
    newAmount: React.PropTypes.number.isRequired,
    isBid: React.PropTypes.bool.isRequired
  }),
  removal: React.PropTypes.shape({
    price: React.PropTypes.number.isRequire,
    isBid: React.PropTypes.bool.isRequired
  }),
  newTrade: React.PropTypes.shape({
    price: React.PropTypes.number.isRequired,
    amountTraded: React.PropTypes.number.isRequired,
    amountRemaining: React.PropTypes.number.isRequired,
    wasBidFilled: React.PropTypes.bool.isRequired
  })
};

export { ChangeShape };
