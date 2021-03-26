import React from 'react';
import ReactDOM from 'react-dom';
import 'whatwg-fetch';

// in your app, you would use this:
//
//  import installCypressHooks from 'cypressautomocker/include-in-webapp';
//
// for this sample, we need to use relative paths:
import installCypressHooks from '../../include-in-webapp';

installCypressHooks();

import App from "./components/App";

ReactDOM.render(<App />, document.getElementById('content'));