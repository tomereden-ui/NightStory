interface SectionHeaderProps {
  title: string;
  action?: { label: string; href: string };
}

export default function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 mb-3">
      <h2 className="text-white font-semibold text-sm tracking-wide">{title}</h2>
      {action && (
        <a href={action.href} className="text-purple-bright/60 text-xs hover:text-purple-bright transition-colors">
          {action.label} →
        </a>
      )}
    </div>
  );
}
