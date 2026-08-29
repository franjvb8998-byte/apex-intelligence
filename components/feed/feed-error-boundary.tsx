"use client";

import { Component, type ReactNode } from "react";
import { FeedCard } from "@/components/feed/feed-card";

type Props = {
  title: string;
  children: ReactNode;
};

type State = { failed: boolean };

export class FeedErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <FeedCard
          title={this.props.title}
          status="error"
          errorTitle="paneCrashed"
          errorDescription="paneCrashedDescription"
        />
      );
    }
    return this.props.children;
  }
}
