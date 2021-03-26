import React from 'react';
import $ from 'jquery';

export default class HeadPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      lastResponseHeader: '',
    }
  }

  render() {
    return (
      <div>
        <h2>
          <button
            data-test="button-test-head-with-responseBody"
            type="button"
            onClick={this.onTestHeadWithResponseBody.bind(this)}>
            Head, with return responseBody
          </button>
        </h2>

        <h3>
          Last result:
          <span data-test="result-text" id="result">{this.state.lastMessage} </span>
        </h3>

        <h3>
          Response Header:
          <span data-text="response-header" id="response-header">{this.state.lastResponseHeader}</span>
        </h3>
      </div>
    )
  }

  onTestHeadWithResponseBody() {
    $.ajax({
      url: '/counter',
      type: 'HEAD',
      async: true,
      success: (message, text, response) => {
        console.log(message);
        console.log(text);
        console.log(response);
        console.log(response.getAllResponseHeaders());
        console.log(response.getResponseHeader('counter'));
      },
      complete: data => {
        console.log('onTestHeadWithResponseBody')
        console.log(data)
        console.log(data.getAllResponseHeaders())
        console.log(data.getResponseHeader('counter'))
        this.setState({
          lastResponseHeader: data.getResponseHeader('counter'),
        });
      }
    });
  }
}