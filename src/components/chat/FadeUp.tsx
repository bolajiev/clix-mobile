import { useRef } from "react"
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native"

// Subtle entry animation for new messages (P8): fades in + lifts 6px once on
// mount. Keys are stable per message, so streaming updates don't re-animate.
export function FadeUp({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const anim = useRef(new Animated.Value(0)).current
  useRef(
    Animated.timing(anim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(),
  )
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}
