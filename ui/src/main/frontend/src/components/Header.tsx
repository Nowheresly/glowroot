import * as stylex from "@stylexjs/stylex";
import {ComponentProps} from "react";
import {colors} from "../tokens.stylex.ts";
import { FaCogs } from 'react-icons/fa';

type HeaderProps = {
    styles?: stylex.StyleXStyles;
} & ComponentProps<any>;


const NAV_STYLES = stylex.create({
    base: {
        backgroundColor: colors.navColor,
        color: "white",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 .3rem",
    }
})

const NAV_MENU_STYLES = stylex.create({
    base: {
        display: "flex",
        alignItems: "center",
    }
})

const NAV_BRAND_STYLES = stylex.create({
    base: {
        textShadow: "0 0 4px white",
        fontWeight: "600",
        fontSize: "1.5rem",
        paddingLeft: "3rem",
        paddingRight: "3rem",
    }
})
const NAV_LIST_STYLES = stylex.create({
    base: {
        display: "flex",
        listStyleType: "none",
    }
})

const NAV_LISTITEM_STYLES = stylex.create({
    base: {
        display: "flex",
        paddingRight: {
            ":last-child": "3rem",
        }
    }
})

const NAV_LISTITEMLINK_STYLES = stylex.create({
    base: {
        paddingLeft: "1rem",
        paddingRight: "1rem",
        paddingTop: ".6rem",
        paddingBottom: ".6rem",
        fontWeight: "600",
        textShadow: {
            default: "none",
            ":hover": "0 0 4px white",
        },

    }
})

export default function Header({...props}: HeaderProps) {

    return (
        <nav {...stylex.props(NAV_STYLES.base)} {...props}>
            <div {...stylex.props(NAV_MENU_STYLES.base)}>
                <span {...stylex.props(NAV_BRAND_STYLES.base)}>Glowroot</span>

                <ul {...stylex.props(NAV_LIST_STYLES.base)}>
                    <li {...stylex.props(NAV_LISTITEM_STYLES.base)}><a {...stylex.props(NAV_LISTITEMLINK_STYLES.base)}
                                                                       href="#">Transactions</a></li>
                    <li {...stylex.props(NAV_LISTITEM_STYLES.base)}><a {...stylex.props(NAV_LISTITEMLINK_STYLES.base)}
                                                                       href="#">Errors</a></li>
                    <li {...stylex.props(NAV_LISTITEM_STYLES.base)}><a {...stylex.props(NAV_LISTITEMLINK_STYLES.base)}
                                                                       href="#">JVM</a></li>
                    <li {...stylex.props(NAV_LISTITEM_STYLES.base)}><a {...stylex.props(NAV_LISTITEMLINK_STYLES.base)}
                                                                       href="#">Synthetic</a></li>
                    <li {...stylex.props(NAV_LISTITEM_STYLES.base)}><a {...stylex.props(NAV_LISTITEMLINK_STYLES.base)}
                                                                       href="#">Incidents</a></li>
                    <li {...stylex.props(NAV_LISTITEM_STYLES.base)}><a {...stylex.props(NAV_LISTITEMLINK_STYLES.base)}
                                                                       href="#">Reporting</a></li>
                </ul>
            </div>
            <ul {...stylex.props(NAV_LIST_STYLES.base)}>
                <li {...stylex.props(NAV_LISTITEM_STYLES.base)}><a {...stylex.props(NAV_LISTITEMLINK_STYLES.base)}
                                                                   href="#"><FaCogs /></a></li>
            </ul>
        </nav>
    );
}