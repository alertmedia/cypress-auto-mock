import React from "react";

import Counter from "./Counter";
import HeadPage from "./HeadPage";

export default class App extends React.Component {
  render() {
    return (
      <div>
        <Counter />
        <HeadPage />
      </div>
    )
  }
}