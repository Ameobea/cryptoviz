//! Misc. functions and constants used in multiple parts of the application

import React from 'react';
import PropTypes from 'prop-types';

const ChangeShape = {
  modificiation: PropTypes.shape({
    price: PropTypes.string.isRequired,
    newAmount: PropTypes.string.isRequired,
    isBid: PropTypes.bool.isRequired
  }),
  removal: PropTypes.shape({
    price: PropTypes.string.isRequire,
    isBid: PropTypes.bool.isRequired
  }),
  newTrade: PropTypes.shape({
    price: PropTypes.string.isRequired,
    amountTraded: PropTypes.string.isRequired,
    wasBidFilled: PropTypes.bool.isRequired
  })
};

export { ChangeShape };
