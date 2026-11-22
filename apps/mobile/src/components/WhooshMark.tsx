import Svg, { Circle, Path, Rect } from "react-native-svg";

export function WhooshMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Logo Whoosh AI">
      <Rect width="64" height="64" rx="16" fill="#730F1B" />
      <Path
        d="M32 8c-12 0-20 9-20 23s8 25 20 25 20-11 20-25S44 8 32 8Z"
        fill="#FFFDFA"
        stroke="#3B0B12"
        strokeWidth="2.5"
      />
      <Path d="M12 31c0-13 8-23 20-23s20 10 20 23H12Z" fill="#961826" />
      <Path
        d="M16 39c10 7 22 7 32 0"
        fill="none"
        stroke="#C8102E"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <Circle cx="25" cy="34" r="2.6" fill="#2D1719" />
      <Circle cx="39" cy="34" r="2.6" fill="#2D1719" />
      <Path d="M29 40q3 3 6 0" fill="none" stroke="#2D1719" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
