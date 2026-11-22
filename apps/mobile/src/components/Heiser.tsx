import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";

import { colors } from "../theme";
import { MOBILE_HEISER_SVG } from "./heiser-svg";

function HeiserBase({
  width = 176,
  animated = true,
  glow = true,
}: {
  width?: number;
  animated?: boolean;
  glow?: boolean;
}) {
  const height = Math.round(width * 1.1875);
  const float = useRef(new Animated.Value(0)).current;
  const svg = useMemo(() => <SvgXml xml={MOBILE_HEISER_SVG} width="100%" height="100%" />, []);

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, float]);

  return (
    <View style={[styles.wrap, { width, height }]}>
      {glow ? (
        <>
          <View style={[styles.glowOuter, { width: width * 1.18, height: width * 1.18 }]} />
          <View style={[styles.glowInner, { width: width * 0.76, height: width * 0.76 }]} />
        </>
      ) : null}
      <Animated.View
        style={{
          width,
          height,
          transform: [
            {
              translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }),
            },
          ],
        }}
      >
        {svg}
      </Animated.View>
    </View>
  );
}

export const Heiser = memo(HeiserBase);

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  glowOuter: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(216,162,74,0.10)",
  },
  glowInner: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(150,24,38,0.07)",
    borderWidth: 1,
    borderColor: colors.line,
  },
});
