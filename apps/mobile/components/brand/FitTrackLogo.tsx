import { Image, type ImageStyle, type StyleProp } from "react-native";

const FITTRACK_LOGO = require("../../assets/brand/fittrack-logo.png");

type FitTrackLogoProps = {
  size: number;
  style?: StyleProp<ImageStyle>;
};

export default function FitTrackLogo({ size, style }: FitTrackLogoProps) {
  return (
    <Image
      accessibilityElementsHidden
      accessible={false}
      importantForAccessibility="no"
      resizeMode="contain"
      source={FITTRACK_LOGO}
      style={[{ height: size, width: size }, style]}
      testID="fittrack-logo"
    />
  );
}
