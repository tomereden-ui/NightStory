import { ICONS, type IconName } from "@/lib/icons";

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}

export default function Icon({ name, size = 20, className, style, strokeWidth = 1.6 }: IconProps) {
  const C = ICONS[name];
  return <C size={size} className={className} style={style} strokeWidth={strokeWidth} />;
}
