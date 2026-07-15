import Icon from "./Icon";

// Multi-chapter indicator shown on story/classic cards — stacked-cards+play
// glyph plus the chapter count. Sized with generous horizontal padding (not
// a fixed width) so a two-digit count (e.g. "12") never looks cramped next
// to a single-digit one.
export default function SeriesCountBadge({ count, size = "md" }: { count: number; size?: "sm" | "md" }) {
  const iconSize = size === "sm" ? 13 : 15;
  return (
    <span
      className="inline-flex items-center flex-shrink-0 rounded-full font-bold"
      style={{
        gap: 4,
        padding: size === "sm" ? "2px 7px" : "3px 8px",
        minWidth: size === "sm" ? 30 : 34,
        justifyContent: "center",
        background: "rgba(79,195,247,0.14)",
        border: "1px solid rgba(79,195,247,0.35)",
        color: "#4fc3f7",
      }}
    >
      <Icon name="episodes" size={iconSize} strokeWidth={1.8} />
      <span className="text-fs-body leading-none">{count}</span>
    </span>
  );
}
