import * as stylex from "@stylexjs/stylex";
import {ComponentProps} from "react";
import {colors, spacing} from "../tokens.stylex.ts";

type ButtonProps = {
    variant?: "primary" | "danger";
    isLarge?: boolean;
    styles?: stylex.StyleXStyles;
} & ComponentProps<"button">;

const BUTTON_STYLES = stylex.create({
    base: {
        border: "none",
        background: "none",
        padding: ".5em 1em",
        borderRadius: spacing.borderRadius,
        cursor: "pointer",
    },
    primary: {
        color: "white",
        backgroundColor: {
            default: colors.primaryColor,
            ":hover": colors.primaryDarkColor,
            ":focus-within": colors.primaryDarkColor,
        },
    },
    danger: {
        color: "white",
        backgroundColor: "#FF0000",
    },
    large: {
        fontSize: "2rem",
    }
});


export function Button({variant = "primary", isLarge, styles, ...props}: ButtonProps) {

    return (
        <button {...stylex.props(
            BUTTON_STYLES.base,
            BUTTON_STYLES[variant],
            isLarge && BUTTON_STYLES.large,
            styles
        )} {...props} />
    );
}