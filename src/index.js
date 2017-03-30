import dva from 'dva';

// 1. Initialize
const app = dva();

// 4. Router
app.router(require('./router'));

// 5. Start
app.start('#root');
