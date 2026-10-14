declare module 'react-helmet-async' {
  import * as React from 'react';

  export interface HelmetProps {
    children?: React.ReactNode;
    [key: string]: any;
  }

  export const Helmet: React.ComponentType<HelmetProps>;
  export const HelmetProvider: React.ComponentType<{ children?: React.ReactNode; [key: string]: any }>;
}

declare module 'react-image-crop' {
  import * as React from 'react';

  export type Crop = any;
  export type PixelCrop = any;
  export function centerCrop(...args: any[]): any;
  export function makeAspectCrop(...args: any[]): any;

  const ReactCrop: React.ComponentType<any>;
  export default ReactCrop;
}

declare module 'recharts' {
  import * as React from 'react';

  export type LegendProps = any;

  export const ResponsiveContainer: React.ComponentType<any>;
  export const AreaChart: React.ComponentType<any>;
  export const Area: React.ComponentType<any>;
  export const BarChart: React.ComponentType<any>;
  export const Bar: React.ComponentType<any>;
  export const LineChart: React.ComponentType<any>;
  export const Line: React.ComponentType<any>;
  export const PieChart: React.ComponentType<any>;
  export const Pie: React.ComponentType<any>;
  export const Cell: React.ComponentType<any>;
  export const XAxis: React.ComponentType<any>;
  export const YAxis: React.ComponentType<any>;
  export const Tooltip: React.ComponentType<any>;
  export const CartesianGrid: React.ComponentType<any>;
  export const Legend: React.ComponentType<any>;
  export const ReferenceLine: React.ComponentType<any>;
}

declare module 'input-otp' {
  import * as React from 'react';

  export const OTPInput: React.ForwardRefExoticComponent<any>;
  export const OTPInputContext: React.Context<{
    slots: Array<{
      char?: React.ReactNode;
      hasFakeCaret?: boolean;
      isActive?: boolean;
    }>;
  }>;
}
