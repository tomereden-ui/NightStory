import Icon from "./Icon";

// Multi-chapter indicator shown on story/classic cards — the stacked-cards
// + sound glyph plus the chapter count, no pill/background frame around it.
export default function SeriesCountBadge({ count, size = "md" }: { count: number; size?: "sm" | "md" }) {
  const iconSize = size === "sm" ? 20 : 24;
  return (
    <span
      className="inline-flex items-center flex-shrink-0 font-medium"
      style={{ gap: 4, color: "#4fc3f7" }}
    >
      <Icon name="episodes" size={iconSize} strokeWidth={1.1} />
      <span className="text-fs-body leading-none">{count}</span>
    </span>
  );
}
