import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius } from "../theme";
import type { Citation } from "../types";
import { AppText } from "./ui";

function inlineNodes(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Text key={`${keyPrefix}-b-${index}`} style={styles.bold}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <Text key={`${keyPrefix}-c-${index}`} style={styles.code}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return <Text key={`${keyPrefix}-t-${index}`}>{part}</Text>;
  });
}

export function MessageText({
  content,
  tone = "dark",
}: {
  content: string;
  tone?: "dark" | "light";
}) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const textColor = tone === "light" ? colors.white : colors.inkSoft;
  return (
    <View style={styles.block}>
      {lines.map((raw, index) => {
        const trimmed = raw.trim();
        if (!trimmed) return <View key={`gap-${index}`} style={styles.gap} />;
        const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
        const numberMatch = trimmed.match(/^(\d+[.)])\s+(.*)$/);
        const headingMatch = trimmed.match(/^#{1,4}\s+(.*)$/);
        const text = bulletMatch?.[1] ?? numberMatch?.[2] ?? headingMatch?.[1] ?? trimmed;
        const isHeading = Boolean(headingMatch);
        return (
          <View
            key={`line-${index}`}
            style={[styles.line, (bulletMatch || numberMatch) && styles.lineWithMarker]}
          >
            {bulletMatch ? <Text style={[styles.marker, { color: textColor }]}>•</Text> : null}
            {numberMatch ? <Text style={[styles.number, { color: textColor }]}>{numberMatch[1]}</Text> : null}
            <Text
              style={[
                styles.text,
                { color: textColor },
                isHeading && styles.heading,
                tone === "light" && styles.linkLight,
              ]}
            >
              {inlineNodes(text, `l${index}`)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function CitationChips({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  const unique = citations.filter(
    (citation, index, list) =>
      list.findIndex(
        (item) => item.document_title === citation.document_title && item.section === citation.section,
      ) === index,
  );
  return (
    <View style={styles.citations}>
      <View style={styles.citationHead}>
        <View style={styles.citationDot} />
        <AppText variant="tiny" style={styles.citationLabel}>
          Sumber knowledge base
        </AppText>
      </View>
      <View style={styles.citationRow}>
        {unique.slice(0, 4).map((citation, index) => (
          <View key={`${citation.document_id}-${index}`} style={styles.citationChip}>
            <Text style={styles.citationTitle} numberOfLines={1}>
              {citation.document_title}
            </Text>
            {citation.section ? (
              <Text style={styles.citationSection} numberOfLines={1}>
                {citation.section}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 3,
  },
  gap: {
    height: 5,
  },
  line: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 3,
  },
  lineWithMarker: {
    paddingLeft: 1,
  },
  marker: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: fonts.bold,
  },
  number: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: fonts.bold,
  },
  text: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 22,
    fontWeight: fonts.regular,
  },
  bold: {
    fontWeight: fonts.bold,
  },
  heading: {
    fontWeight: fonts.bold,
    fontSize: 15,
  },
  code: {
    fontFamily: "monospace",
    backgroundColor: "rgba(150,24,38,0.09)",
    borderRadius: 4,
    fontSize: 13,
  },
  linkLight: {
    opacity: 0.98,
  },
  citations: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  citationHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  citationDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  citationLabel: {
    fontWeight: fonts.bold,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  citationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  citationChip: {
    maxWidth: "100%",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cream,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  citationTitle: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: fonts.bold,
    color: colors.maroonDark,
  },
  citationSection: {
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.muted,
    maxWidth: 180,
  },
});
