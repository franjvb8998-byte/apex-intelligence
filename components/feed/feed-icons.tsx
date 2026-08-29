import type { ReactNode, SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  const { children, ...rest } = props;
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      width={14}
      height={14}
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconBolt(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path
        d="M9 1 3.5 9h4L7 15l5.5-8h-4L9 1Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

export function IconPulse(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path
        d="M1 8h3l1.5-4 3 8L10.5 6 12 8h3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

export function IconChart(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path
        d="M2 13V3M2 13h12M5 10v3M8 7v6M11 5v8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </Icon>
  );
}

export function IconAlert(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path
        d="M8 2 1.8 13h12.4L8 2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M8 6.5v3" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="11.2" r="0.6" fill="currentColor" />
    </Icon>
  );
}

export function IconStar(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path
        d="m8 1.8 1.7 3.5 3.8.6-2.8 2.7.7 3.8L8 10.6 4.6 12.4l.7-3.8-2.8-2.7 3.8-.6L8 1.8Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

export function IconClock(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4.5V8l2.4 1.6" stroke="currentColor" strokeWidth="1.3" />
    </Icon>
  );
}

export function IconFlag(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path
        d="M3 14V2.5h.5L8 5l4.5-2.5H13V10h-.5L8 12.5 3.5 10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

export function IconWallet(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect
        x="2"
        y="4"
        width="12"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M2 7h12" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="11" cy="10.2" r="0.8" fill="currentColor" />
    </Icon>
  );
}

export function IconBook(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path
        d="M3 3.5h10v9H5.5A1.5 1.5 0 0 0 4 14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M4 14V3.5" stroke="currentColor" strokeWidth="1.3" />
    </Icon>
  );
}
