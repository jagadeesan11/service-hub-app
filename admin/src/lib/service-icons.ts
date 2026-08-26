/**
 * GENERATED FILE - do not edit.
 * Source: scripts/service-icons.mjs
 * Regenerate: node scripts/generate-service-icons.mjs
 */

export interface IconCircle {
  cx: number;
  cy: number;
  r: number;
}

export interface ServiceIconShape {
  label: string;
  /** Normal-weight stroked paths. */
  paths?: string[];
  /** Drawn with a heavier stroke, for emphasis within the same icon. */
  heavyPaths?: string[];
  /** Dashed, for a layer that is meant to read as not-quite-there. */
  dashedPaths?: string[];
  circles?: IconCircle[];
}

export const SERVICE_ICONS: Record<string, ServiceIconShape> = {
  "car": {
    "label": "Car",
    "paths": [
      "M4 14 L5.5 9.2 A2 2 0 0 1 7.4 7.8 h9.2 a2 2 0 0 1 1.9 1.4 L20 14",
      "M2.6 14 h18.8 a1 1 0 0 1 1 1 v1.6 a1 1 0 0 1-1 1 h-1",
      "M8.6 17.6 h6.8",
      "M4.6 17.6 h-1 a1 1 0 0 1-1-1 V14"
    ],
    "circles": [
      {
        "cx": 7,
        "cy": 17.6,
        "r": 1.6
      },
      {
        "cx": 17,
        "cy": 17.6,
        "r": 1.6
      }
    ]
  },
  "bike": {
    "label": "Motorcycle",
    "paths": [
      "M6.2 16.6 L9.4 12 h4.4",
      "M9.6 11.9 q2 -2.2 4.6 -1.3",
      "M13.9 12 L16.3 10.2",
      "M14.8 9.7 h3.2",
      "M16.6 10.4 L17.8 16.6"
    ],
    "heavyPaths": [
      "M2.9 16.6 a3.3 3.3 0 1 0 6.6 0 a3.3 3.3 0 1 0 -6.6 0",
      "M14.5 16.6 a3.3 3.3 0 1 0 6.6 0 a3.3 3.3 0 1 0 -6.6 0"
    ]
  },
  "ppf": {
    "label": "Paint protection film",
    "paths": [
      "M4.5 15.4 L5.9 11.2 A1.8 1.8 0 0 1 7.6 10 h8.8 a1.8 1.8 0 0 1 1.7 1.2 L19.5 15.4",
      "M3.4 15.4 h17.2 a0.9 0.9 0 0 1 .9.9 v1.3 a0.9 0.9 0 0 1-.9.9 h-.9",
      "M9 18.5 h6",
      "M5 18.5 h-.6 a0.9 0.9 0 0 1-.9-.9 v-2.2"
    ],
    "dashedPaths": [
      "M2.8 11.6 L5.1 5.9 A3 3 0 0 1 7.9 4 h8.2 a3 3 0 0 1 2.8 1.9 l2.3 5.7"
    ],
    "circles": [
      {
        "cx": 7.4,
        "cy": 18.5,
        "r": 1.4
      },
      {
        "cx": 16.6,
        "cy": 18.5,
        "r": 1.4
      }
    ]
  },
  "ceramic": {
    "label": "Ceramic coating",
    "paths": [
      "M12 2.8 c0 0 4.4 5 4.4 8a4.4 4.4 0 1 1-8.8 0 C7.6 7.8 12 2.8 12 2.8 z",
      "M9.9 11.4 a2.1 2.1 0 0 0 2.1 2.1",
      "M2.5 20.2 h19"
    ],
    "circles": [
      {
        "cx": 5.2,
        "cy": 16.9,
        "r": 1.5
      },
      {
        "cx": 18.9,
        "cy": 16.2,
        "r": 1.9
      }
    ]
  },
  "accessories": {
    "label": "Accessories fitting",
    "paths": [
      "M15.6 3.4 a4.4 4.4 0 0 0-5.4 6 l-6.4 6.4 a2 2 0 0 0 2.8 2.8 l6.4-6.4 a4.4 4.4 0 0 0 6-5.4 l-2.7 2.7 -2.6-.7 -.7-2.6 z",
      "M18.2 14.2 l2.4 1.4 v2.8 l-2.4 1.4 -2.4-1.4 v-2.8 z"
    ]
  },
  "tyre": {
    "label": "Tyre painting",
    "paths": [
      "M12 3.6 A8.4 8.4 0 0 1 20.4 12"
    ],
    "heavyPaths": [
      "M12 3.6 A8.4 8.4 0 0 1 20.4 12"
    ],
    "circles": [
      {
        "cx": 12,
        "cy": 12,
        "r": 8.4
      },
      {
        "cx": 12,
        "cy": 12,
        "r": 3.3
      }
    ]
  },
  "wash": {
    "label": "Wash & detail",
    "paths": [
      "M6.5 10.5 h11 a1.6 1.6 0 0 1 1.6 1.6 v6.3 a1.6 1.6 0 0 1-1.6 1.6 h-11 a1.6 1.6 0 0 1-1.6-1.6 v-6.3 a1.6 1.6 0 0 1 1.6-1.6 z",
      "M8.4 10.5 V6.2 a2.2 2.2 0 0 1 2.2-2.2 h6.6",
      "M9.5 14 v3",
      "M12 14 v3",
      "M14.5 14 v3"
    ]
  }
};

export type ServiceIconKey = keyof typeof SERVICE_ICONS;

/** Every key an admin may choose, with a human label for the picker. */
export const SERVICE_ICON_OPTIONS = Object.entries(SERVICE_ICONS).map(([key, shape]) => ({
  key,
  label: shape.label,
}));

/** 24x24 is the grid every path above was drawn on. */
export const ICON_VIEWBOX = 24;
