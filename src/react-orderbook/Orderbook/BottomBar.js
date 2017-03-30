//! Settings and information displayed under the visualization

import React from 'react';

const BottomBar = ({vizState, onSettingChange}) => {
  return (
    <div id='bottomBar' style={{height: '10%'}}>
      <p id='footer'>{
        `CryptoViz by Casey Primozic \u00A9 ${new Date().getFullYear()}.  ` +
        'Please send feedback/Issues to '}<a href="mailto:me@ameo.link">me@ameo.link</a>
      </p>
    </div>
  );
};

export default BottomBar;
