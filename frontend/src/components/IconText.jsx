/** Icon + text for consistent styling across the platform */
export default function IconText({ icon: Icon, children, className = '' }) {
  return (
    <span className={`icon-text ${className}`}>
      {Icon && <Icon size={18} strokeWidth={2} />}
      {children}
    </span>
  );
}
