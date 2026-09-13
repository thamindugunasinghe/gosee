// GoSee SVG Icon system — replaces all emoji with clean, professional vector icons.
// Uses react-native-svg for cross-platform rendering (native + web).

import React from "react";
import Svg, { Circle, Line, Path, Polyline, Rect } from "react-native-svg";

export type IconName =
  | "calendar"
  | "refresh-cw"
  | "hourglass"
  | "check-circle"
  | "map-pin"
  | "edit"
  | "clock"
  | "flag"
  | "rotate-cw"
  | "ban"
  | "party"
  | "lightbulb"
  | "mail"
  | "mail-open"
  | "eye"
  | "zap"
  | "chevron-left"
  | "chevron-right"
  | "check"
  | "x"
  | "inbox"
  | "file-text"
  | "alert-circle"
  | "send";

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Renders a Lucide-style SVG icon.
 * All icons are 24x24 viewBox, stroke-based, 2px default stroke.
 */
export default function Icon({ name, size = 20, color = "#F8FAFC", strokeWidth = 2 }: IconProps) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "calendar":
      return (
        <Svg {...props}>
          <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <Line x1="16" y1="2" x2="16" y2="6" />
          <Line x1="8" y1="2" x2="8" y2="6" />
          <Line x1="3" y1="10" x2="21" y2="10" />
        </Svg>
      );

    case "refresh-cw":
      return (
        <Svg {...props}>
          <Polyline points="23 4 23 10 17 10" />
          <Polyline points="1 20 1 14 7 14" />
          <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </Svg>
      );

    case "hourglass":
      return (
        <Svg {...props}>
          <Path d="M5 22h14" />
          <Path d="M5 2h14" />
          <Path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
          <Path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
        </Svg>
      );

    case "check-circle":
      return (
        <Svg {...props}>
          <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <Polyline points="22 4 12 14.01 9 11.01" />
        </Svg>
      );

    case "map-pin":
      return (
        <Svg {...props}>
          <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <Circle cx="12" cy="10" r="3" />
        </Svg>
      );

    case "edit":
      return (
        <Svg {...props}>
          <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </Svg>
      );

    case "clock":
      return (
        <Svg {...props}>
          <Circle cx="12" cy="12" r="10" />
          <Polyline points="12 6 12 12 16 14" />
        </Svg>
      );

    case "flag":
      return (
        <Svg {...props}>
          <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <Line x1="4" y1="22" x2="4" y2="15" />
        </Svg>
      );

    case "rotate-cw":
      return (
        <Svg {...props}>
          <Polyline points="23 4 23 10 17 10" />
          <Path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </Svg>
      );

    case "ban":
      return (
        <Svg {...props}>
          <Circle cx="12" cy="12" r="10" />
          <Line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </Svg>
      );

    case "party":
      // Star/sparkle icon as celebration indicator
      return (
        <Svg {...props}>
          <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </Svg>
      );

    case "lightbulb":
      return (
        <Svg {...props}>
          <Path d="M9 18h6" />
          <Path d="M10 22h4" />
          <Path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
        </Svg>
      );

    case "mail":
      return (
        <Svg {...props}>
          <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <Polyline points="22 6 12 13 2 6" />
        </Svg>
      );

    case "mail-open":
      return (
        <Svg {...props}>
          <Path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6z" />
          <Path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10" />
        </Svg>
      );

    case "eye":
      return (
        <Svg {...props}>
          <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <Circle cx="12" cy="12" r="3" />
        </Svg>
      );

    case "zap":
      return (
        <Svg {...props}>
          <Polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </Svg>
      );

    case "chevron-left":
      return (
        <Svg {...props}>
          <Polyline points="15 18 9 12 15 6" />
        </Svg>
      );

    case "chevron-right":
      return (
        <Svg {...props}>
          <Polyline points="9 18 15 12 9 6" />
        </Svg>
      );

    case "check":
      return (
        <Svg {...props}>
          <Polyline points="20 6 9 17 4 12" />
        </Svg>
      );

    case "x":
      return (
        <Svg {...props}>
          <Line x1="18" y1="6" x2="6" y2="18" />
          <Line x1="6" y1="6" x2="18" y2="18" />
        </Svg>
      );

    case "inbox":
      return (
        <Svg {...props}>
          <Polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <Path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </Svg>
      );

    case "file-text":
      return (
        <Svg {...props}>
          <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <Polyline points="14 2 14 8 20 8" />
          <Line x1="16" y1="13" x2="8" y2="13" />
          <Line x1="16" y1="17" x2="8" y2="17" />
          <Polyline points="10 9 9 9 8 9" />
        </Svg>
      );

    case "alert-circle":
      return (
        <Svg {...props}>
          <Circle cx="12" cy="12" r="10" />
          <Line x1="12" y1="8" x2="12" y2="12" />
          <Line x1="12" y1="16" x2="12.01" y2="16" />
        </Svg>
      );

    case "send":
      return (
        <Svg {...props}>
          <Line x1="22" y1="2" x2="11" y2="13" />
          <Polyline points="22 2 15 22 11 13 2 9 22 2" />
        </Svg>
      );

    default:
      return (
        <Svg {...props}>
          <Circle cx="12" cy="12" r="10" />
        </Svg>
      );
  }
}
