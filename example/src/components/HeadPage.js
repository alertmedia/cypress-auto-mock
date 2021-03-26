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
      complete: data => {
        this.setState({
          lastResponseHeader: data.getResponseHeader('Counter'),
        });
      }
    });
  }
}