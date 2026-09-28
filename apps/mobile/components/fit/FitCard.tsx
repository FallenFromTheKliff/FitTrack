import type { ReactNode } from "react";
import React from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, interpolate } from "react-native-reanimated";
import { ChevronRight, ChevronDown, Star, type LucideIcon } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useExpandCard } from "@/hooks/animations/ui/useExpandCard";
import { makeFitCardStyles } from "@/styles/components/FitStyles";

import { FitText, AnimatedFitText } from "@/components/fit/FitText";

type Props = {
    icon?: LucideIcon;
    iconSize?: number;
    label: string;
    subtitle?: string;
    subtitleContent?: ReactNode;
    subtitleAccessibilityLabel?: string;
    hasBorder?: boolean;
    hasDropdown?: boolean;
    noChevron?: boolean;
    iconBg?: string;
    trailingLabel?: string;
    trailingLabelColor?: string;
    progress?: number;
    onPress?: () => void;
    children?: ReactNode;
    statValue?: string;
    emoji?: string;
    avatarInitials?: string;
    selected?: boolean;
    selectedIndicatorColor?: string;
    rating?: number;
};

export default React.memo(function FitCard({
                                               icon: Icon, iconSize = 20,
                                               label, subtitle, subtitleContent,
                                               subtitleAccessibilityLabel,
                                               hasBorder = false,
                                               hasDropdown = false, noChevron = false,
                                               iconBg, trailingLabel, trailingLabelColor,
                                               progress, onPress, children, statValue,
                                               emoji, avatarInitials, selected, selectedIndicatorColor, rating
                                           }: Props) {
    const { colors } = useTheme();
    const { ic } = useThemeTransitionAnim();
    const { width } = useWindowDimensions();
    const isCompact = width < 360;
    const s = React.useMemo(() => makeFitCardStyles(colors), [colors]);
    const { bodyHeight, setBodyHeight, handleToggleExpand, anim, bodyHeightAnim, bodyOpacityAnim } = useExpandCard();
    const onBrand = colors.onBrand ?? "#FFFFFF";

    const chevronRotateStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${interpolate(anim.value, [0, 1], [0, 180])}deg` }]
    }));
    const dropdownStyle = useAnimatedStyle(() => ({
        maxHeight: interpolate(bodyHeightAnim.value, [0, 1], [0, bodyHeight || 500]),
        opacity: bodyOpacityAnim.value
    }));
    const rowBgStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.surface }));
    const borderOverlayStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.border }));
    const iconBadgeStyle = useAnimatedStyle(() => ({
        backgroundColor: ic.value.surfaceRaised,
        borderColor: ic.value.border
    }));
    const labelStyle = useAnimatedStyle(() => ({ color: ic.value.textPrimary }));
    const subtitleStyle = useAnimatedStyle(() => ({ color: ic.value.textMuted }));
    const dividerStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.border }));
    const statTileStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.surface }));
    const statValueStyle = useAnimatedStyle(() => ({ color: ic.value.textPrimary }));
    const statLabelStyle = useAnimatedStyle(() => ({ color: ic.value.textMuted }));

    const handlePress = () => {
        if (hasDropdown) handleToggleExpand();
        else onPress?.();
    };

    const badgeSize = iconSize > 20 ? iconSize + 22 : undefined;
    const iconBadgeSizeStyle = React.useMemo(
        () => (badgeSize ? { width: badgeSize, height: badgeSize } : undefined),
        [badgeSize]
    );
    if (statValue !== undefined) {
        return (
            <Animated.View style={[s.statTile, statTileStyle]}>
                {Icon
                    ? React.createElement(Icon as any, { size: iconSize, color: colors.brand, strokeWidth: 2 })
                    : null}
                <AnimatedFitText style={[s.statValue, statValueStyle]}>{statValue}</AnimatedFitText>
                <AnimatedFitText style={[s.statLabel, statLabelStyle]}>{label}</AnimatedFitText>
            </Animated.View>
        );
    }

    const showChevron = !noChevron && (hasDropdown || onPress !== undefined);
    const isInteractive = hasDropdown || onPress !== undefined;
    const subtitleLabel = subtitle ?? subtitleAccessibilityLabel;
    const renderedSubtitle = subtitleContent ?? subtitle;
    const hasTrailingContent = rating !== undefined || Boolean(trailingLabel);
    const accessibilityLabel = [label, subtitleLabel, trailingLabel]
        .filter(Boolean)
        .join(", ");

    const trailingContent = (
        <>
            {rating !== undefined ? (
                <View style={s.ratingPill}>
                    <Star size={13} color={colors.warning} strokeWidth={2} fill={colors.warning} />
                    <FitText style={[s.ratingText, { color: colors.textPrimary }]}>{rating}</FitText>
                </View>
            ) : null}
            {trailingLabel ? (
                <View
                    style={[
                        s.trailingPill,
                        {
                            backgroundColor: (trailingLabelColor ?? colors.brand) + "22",
                            borderColor: trailingLabelColor ?? colors.brand
                        }
                    ]}
                >
                    <FitText
                        style={[s.trailingPillText, { color: trailingLabelColor ?? colors.brand }]}
                    >
                        {trailingLabel}
                    </FitText>
                </View>
            ) : null}
        </>
    );

    const iconContent = emoji ? (
        <Text>{emoji}</Text>
    ) : avatarInitials ? (
        <Text style={[s.avatarInitials, { color: iconBg ? onBrand : colors.brand }]}>
            {avatarInitials}
        </Text>
    ) : Icon ? (
        React.createElement(Icon as any, {
            size: iconSize,
            color: iconBg ? onBrand : colors.brand,
            strokeWidth: 2
        })
    ) : null;

    return (
        <Animated.View style={rowBgStyle}>
            <Pressable
                style={[
                    s.row,
                    hasBorder && s.rowBorder,
                    selected && !selectedIndicatorColor ? s.rowSelected : undefined
                ]}
                onPress={handlePress}
                disabled={!isInteractive}
                accessibilityRole={isInteractive ? "button" : undefined}
                accessibilityLabel={isInteractive ? accessibilityLabel : undefined}
            >
                {selected && selectedIndicatorColor ? (
                    <View
                        style={[
                            s.rowSelectedIndicator,
                            { backgroundColor: selectedIndicatorColor }
                        ]}
                    />
                ) : null}
                {hasBorder && (
                    <Animated.View style={[s.rowBorderOverlay, borderOverlayStyle]} />
                )}
                {iconBg ? (
                    <View
                        style={[
                            s.iconBadge,
                            { backgroundColor: iconBg, borderColor: iconBg },
                            iconBadgeSizeStyle
                        ]}
                    >
                        {iconContent}
                    </View>
                ) : (
                    <Animated.View
                        style={[
                            s.iconBadge,
                            iconBadgeStyle,
                            iconBadgeSizeStyle
                        ]}
                    >
                        {iconContent}
                    </Animated.View>
                )}
                <View style={isCompact ? s.compactTextGroup : s.textGroup}>
                    <View style={isCompact ? s.compactLabelRow : s.labelRow}>
                        <AnimatedFitText style={[s.label, isCompact ? s.compactLabel : undefined, labelStyle]}>{label}</AnimatedFitText>
                        {!isCompact ? (
                            <View style={s.trailingRow}>{trailingContent}</View>
                        ) : null}
                    </View>
                    {isCompact && hasTrailingContent ? (
                        <View style={s.compactTrailingRow}>{trailingContent}</View>
                    ) : null}
                    {renderedSubtitle ? (
                        <AnimatedFitText style={[s.subtitle, subtitleStyle]}>
                            {renderedSubtitle}
                        </AnimatedFitText>
                    ) : null}
                    {progress !== undefined ? (
                        <View style={s.progressTrack}>
                            <View
                                style={[
                                    s.progressFill,
                                    {
                                        width: `${Math.min(progress, 1) * 100}%` as any,
                                        backgroundColor: trailingLabelColor ?? colors.brand
                                    }
                                ]}
                            />
                        </View>
                    ) : null}
                </View>
                {showChevron &&
                    (hasDropdown ? (
                        <Animated.View style={chevronRotateStyle}>
                            <ChevronDown size={20} color={colors.textMuted} strokeWidth={2} />
                        </Animated.View>
                    ) : (
                        <ChevronRight size={20} color={colors.textMuted} strokeWidth={2} />
                    ))}
            </Pressable>
            {hasDropdown && (
                <Animated.View style={[s.dropdownBody, dropdownStyle]}>
                    <View
                        style={s.dropdownInner}
                        onLayout={(e) => {
                            const h = e.nativeEvent.layout.height;
                            if (h > 0) setBodyHeight(h);
                        }}
                    >
                        <Animated.View style={[s.dropdownDivider, dividerStyle]} />
                        {children}
                    </View>
                </Animated.View>
            )}
        </Animated.View>
    );
});
