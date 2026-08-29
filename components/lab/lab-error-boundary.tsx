"use client";

import { Component, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LabPanel } from "@/components/lab/lab-panel";

type Props = {
  title: string;
  children: ReactNode;
};

type State = { failed: boolean };

function LabCrashFallback({ title }: { title: string }) {
  const t = useTranslations("lab");
  return (
    <LabPanel
      title={title}
      status="error"
      errorTitle={t("paneCrashed")}
      errorDescription={t("paneCrashedDescription")}
    />
  );
}

export class LabErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <LabCrashFallback title={this.props.title} />;
    }
    return this.props.children;
  }
}
